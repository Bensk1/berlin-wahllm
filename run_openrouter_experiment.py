"""Run reproducible, stateless OpenRouter experiments."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import wahlomat


ROOT = Path(__file__).resolve().parent
PRIVATE_REQUEST_LOG = ROOT / ".private" / "openrouter-request-ids.json"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


@dataclass(frozen=True)
class ModelConfig:
    name: str
    model_id: str
    provider_endpoint: str
    reasoning_effort: str | None = "high"
    temperature: int | None = 0
    token_limit_parameter: str = "max_tokens"
    max_output_tokens: int = 4096
    note: str | None = None

    @property
    def output_path(self) -> Path:
        suffix = "high" if self.reasoning_effort == "high" else "no-reasoning-control"
        temperature = "t0" if self.temperature == 0 else "provider-temperature"
        return ROOT / "responses" / "api_experiments" / f"{self.name}_{suffix}_{temperature}.json"


MODEL_CONFIGS = {
    config.name: config
    for config in (
        ModelConfig("grok-4.5", "x-ai/grok-4.5", "xai/priority"),
        ModelConfig("sonnet-4.6", "anthropic/claude-sonnet-4.6", "amazon-bedrock/global"),
        ModelConfig(
            "gemini-3.5-flash-lite",
            "google/gemini-3.5-flash-lite",
            "google-vertex/global",
            temperature=None,
            note="Der ZDR-Endpunkt unterstützt keine explizite Temperatur; Provider-Default.",
        ),
        ModelConfig(
            "gpt-5.6-terra",
            "openai/gpt-5.6-terra",
            "azure",
            temperature=None,
            token_limit_parameter="max_completion_tokens",
            note="Der ZDR-Endpunkt unterstützt keine explizite Temperatur; Provider-Default.",
        ),
        ModelConfig(
            "gemma-4-26b",
            "google/gemma-4-26b-a4b-it",
            "google-vertex/global",
            reasoning_effort=None,
            note="Das Modell bietet kein konfigurierbares Reasoning-Level.",
        ),
        ModelConfig(
            "mistral-medium-3.5",
            "mistralai/mistral-medium-3-5",
            "mistral/zdr",
            max_output_tokens=8192,
            note="High reasoning benötigte im Vorversuch mehr als 4096 Ausgabetokens.",
        ),
        ModelConfig("glm-5.3-flash", "z-ai/glm-5.3-flash", "z-ai/fp8"),
        ModelConfig(
            "kimi-k3",
            "moonshotai/kimi-k3",
            "moonshotai/mxfp4",
            temperature=None,
            note="Der Moonshot-ZDR-Endpunkt unterstützt keine explizite Temperatur; Provider-Default.",
        ),
    )
}


class ExperimentError(RuntimeError):
    pass


_ANSWER_SEQUENCE = re.compile(
    r"(?<![\d-])(-?1|0)(?:\s*,\s*(-?1|0)){37}(?!\s*,\s*(?:-?1|0))(?!\d)"
)
EVALUABLE_STATUSES = frozenset(("complete_exact", "complete_extracted"))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def experiment_manifest(prompt: str, config: ModelConfig) -> dict[str, object]:
    prompt_sha256 = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    settings = {
        "interface": "api",
        "model_id": config.model_id,
        "provider_endpoint": config.provider_endpoint,
        "temperature": config.temperature,
        "reasoning_effort": config.reasoning_effort,
        "max_tokens": config.max_output_tokens,
        "conversation_context": "fresh",
        "personalization": "none",
        "content_retention": "zdr",
        "data_collection": "deny",
        "allow_fallbacks": False,
        "prompt_sha256": prompt_sha256,
    }
    if config.temperature is None:
        settings["requested_temperature"] = 0
    if config.token_limit_parameter != "max_tokens":
        settings["token_limit_parameter"] = config.token_limit_parameter
    if config.reasoning_effort is None:
        settings["requested_reasoning_effort"] = "high"
    if config.note is not None:
        settings["parameter_note"] = config.note
    experiment_hash = hashlib.sha256(canonical_json(settings).encode("utf-8")).hexdigest()[:16]
    return {
        "schema_version": 1,
        "experiment_id": (
            f"openrouter-grok-4.5-high-t0-{experiment_hash}"
            if config.name == "grok-4.5"
            else f"openrouter-{config.name}-{experiment_hash}"
        ),
        "created_at": utc_now(),
        "settings": settings,
        "runs": [],
    }


def request_payload(prompt: str, config: ModelConfig) -> dict[str, object]:
    payload: dict[str, object] = {
        "model": config.model_id,
        "messages": [{"role": "user", "content": prompt}],
        "provider": {
            "only": [config.provider_endpoint],
            "allow_fallbacks": False,
            "zdr": True,
            "data_collection": "deny",
            "require_parameters": True,
        },
        "usage": {"include": True},
    }
    payload[config.token_limit_parameter] = config.max_output_tokens
    if config.temperature is not None:
        payload["temperature"] = config.temperature
    if config.reasoning_effort is not None:
        payload["reasoning"] = {"effort": config.reasoning_effort, "exclude": True}
    return payload


def load_or_create(path: Path, prompt: str, config: ModelConfig) -> dict[str, Any]:
    expected = experiment_manifest(prompt, config)
    if not path.exists():
        return expected
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExperimentError(f"Experimentdatei kann nicht gelesen werden: {path}") from exc
    if not isinstance(document, dict) or document.get("settings") != expected["settings"]:
        raise ExperimentError("Die vorhandene Experimentdatei hat andere Einstellungen.")
    if not isinstance(document.get("runs"), list):
        raise ExperimentError("Die vorhandene Experimentdatei enthält keine gültige Laufsliste.")
    return document


def write_atomic(path: Path, document: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        temporary_path = Path(handle.name)
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    temporary_path.replace(path)


def store_private_request_id(experiment_id: object, replicate: int, request_id: object) -> None:
    if not isinstance(experiment_id, str) or not isinstance(request_id, str):
        return
    if PRIVATE_REQUEST_LOG.exists():
        try:
            entries = json.loads(PRIVATE_REQUEST_LOG.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ExperimentError("Private Request-ID-Datei kann nicht gelesen werden.") from exc
    else:
        entries = []
    if not isinstance(entries, list):
        raise ExperimentError("Private Request-ID-Datei muss eine JSON-Liste sein.")
    record = {
        "experiment_id": experiment_id,
        "replicate": replicate,
        "request_id": request_id,
    }
    if record not in entries:
        entries.append(record)
        write_atomic(PRIVATE_REQUEST_LOG, entries)


def call_openrouter(api_key: str, prompt: str, config: ModelConfig) -> tuple[dict[str, Any], int]:
    body = canonical_json(request_payload(prompt, config)).encode("utf-8")
    request = urllib.request.Request(
        OPENROUTER_URL,
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ExperimentError(f"OpenRouter antwortete mit HTTP {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise ExperimentError(f"OpenRouter-Anfrage fehlgeschlagen: {exc}") from exc
    if not isinstance(payload, dict):
        raise ExperimentError("OpenRouter lieferte keine JSON-Antwort.")
    return payload, round((time.monotonic() - started) * 1000)


def parse_run(
    payload: dict[str, Any], replicate: int, latency_ms: int, config: ModelConfig
) -> dict[str, object]:
    try:
        raw_response = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ExperimentError("OpenRouter-Antwort enthält keinen Modelltext.") from exc
    run: dict[str, object] = {
        "replicate": replicate,
        "observed_at": utc_now(),
        "request_id": payload.get("id"),
        "model_id": config.model_id,
        "reported_model_id": payload.get("model"),
        "provider": payload.get("provider"),
        "provider_endpoint": config.provider_endpoint,
        "temperature": config.temperature,
        "reasoning_effort": config.reasoning_effort,
        "latency_ms": latency_ms,
        "usage": payload.get("usage"),
        "finish_reason": payload.get("choices", [{}])[0].get("finish_reason"),
        "raw_response": raw_response,
    }
    if not isinstance(raw_response, str):
        run["status"] = "output_exhausted" if run["finish_reason"] == "length" else "blocked"
        run["validation_error"] = "Der Modelltext ist keine Zeichenkette."
        return run
    try:
        answers = wahlomat.parse_answers(raw_response.strip())
    except wahlomat.WahlomatError as exact_error:
        candidates = [match.group(0) for match in _ANSWER_SEQUENCE.finditer(raw_response)]
        if len(candidates) == 1:
            answers = wahlomat.parse_answers(candidates[0])
            run["status"] = "complete_extracted"
            run["extraction"] = "embedded"
        else:
            lowered = raw_response.casefold()
            refusal_markers = ("keine eigenen politischen", "keine politischen präferenzen")
            run["status"] = "refused" if any(marker in lowered for marker in refusal_markers) else "invalid"
            run["validation_error"] = str(exact_error)
            return run
    else:
        run["status"] = "complete_exact"
        run["extraction"] = "exact"
    run["answers"] = list(answers)
    if all(answer == 0 for answer in answers):
        run["status"] = "neutral_only"
    return run


def run_experiment(
    path: Path,
    target_runs: int,
    api_key: str,
    config: ModelConfig,
    target_valid_runs: int | None = None,
) -> dict[str, Any]:
    prompt = wahlomat.THESIS_PATH.read_text(encoding="utf-8")
    document = load_or_create(path, prompt, config)
    existing_replicates = [run.get("replicate", 0) for run in document["runs"]]
    next_replicate = max(existing_replicates, default=0) + 1
    if target_valid_runs is None:
        pending_replicates = range(next_replicate, target_runs + 1)
    else:
        valid_count = sum(run.get("status") in EVALUABLE_STATUSES for run in document["runs"])
        pending_replicates = range(next_replicate, next_replicate + max(30, target_valid_runs * 3))
        if valid_count >= target_valid_runs:
            return document
    for replicate in pending_replicates:
        payload, latency_ms = call_openrouter(api_key, prompt, config)
        run = parse_run(payload, replicate, latency_ms, config)
        store_private_request_id(document.get("experiment_id"), replicate, run.pop("request_id", None))
        document["runs"].append(run)
        write_atomic(path, document)
        usage = run.get("usage")
        cost = usage.get("cost") if isinstance(usage, dict) else None
        print(f"Lauf {replicate}: {run['status']}, Kosten: {cost!r} USD")
        if target_valid_runs is not None:
            valid_count += run["status"] in EVALUABLE_STATUSES
            if valid_count >= target_valid_runs:
                break
    else:
        if target_valid_runs is not None:
            raise ExperimentError(f"Nach 30 weiteren Versuchen fehlen weiterhin gültige Läufe für {config.name}.")
    return document


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=10)
    parser.add_argument("--valid-runs", type=int)
    parser.add_argument("--model", choices=tuple(MODEL_CONFIGS) + ("all",), default="grok-4.5")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.runs < 1:
        parser.error("--runs muss positiv sein")
    if args.valid_runs is not None and args.valid_runs < 1:
        parser.error("--valid-runs muss positiv sein")
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        parser.error("OPENROUTER_API_KEY ist nicht gesetzt")
    names = tuple(MODEL_CONFIGS) if args.model == "all" else (args.model,)
    if args.output is not None and len(names) != 1:
        parser.error("--output kann nicht zusammen mit --model all verwendet werden")
    for name in names:
        config = MODEL_CONFIGS[name]
        output = args.output or config.output_path
        print(f"Experiment {name}: {config.model_id} über {config.provider_endpoint}")
        run_experiment(output, args.runs, api_key, config, args.valid_runs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
