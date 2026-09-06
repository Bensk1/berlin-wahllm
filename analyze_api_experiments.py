"""Create deterministic summaries of the controlled API experiments."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import tempfile
from collections import Counter
from pathlib import Path
from statistics import mean, median, pstdev
from typing import Iterable

import run_openrouter_experiment as experiments
import wahlomat


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "responses" / "api_experiments"
DEFAULT_JSON = ROOT / "reports" / "api-experiment-summary.json"
DEFAULT_CSV = ROOT / "reports" / "api-experiment-summary.csv"
SCHEMA_VERSION = 1
MODEL_ORDER = tuple(experiments.MODEL_CONFIGS)


class ApiAnalysisError(ValueError):
    pass


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def rounded(value: float) -> float:
    return round(value + 1e-12, 1)


def load_experiment_files(directory: Path) -> tuple[tuple[Path, dict[str, object]], ...]:
    documents: dict[str, tuple[Path, dict[str, object]]] = {}
    for path in sorted(directory.glob("*.json")):
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ApiAnalysisError(f"Experimentdatei kann nicht gelesen werden: {path}") from exc
        if not isinstance(document, dict) or not isinstance(document.get("settings"), dict):
            raise ApiAnalysisError(f"Ungültiges Experimentmanifest: {path}")
        model_id = document["settings"].get("model_id")
        config = next(
            (candidate for candidate in experiments.MODEL_CONFIGS.values()
             if candidate.model_id == model_id),
            None,
        )
        if config is None:
            raise ApiAnalysisError(f"Unbekannte Modell-ID in {path}: {model_id!r}")
        if config.name in documents:
            raise ApiAnalysisError(f"Mehrere Experimentdateien für {config.name}.")
        if not isinstance(document.get("runs"), list):
            raise ApiAnalysisError(f"Ungültige Laufsliste: {path}")
        documents[config.name] = (path, document)
    missing = [name for name in MODEL_ORDER if name not in documents]
    if missing:
        raise ApiAnalysisError(f"Fehlende Experimente: {', '.join(missing)}")
    return tuple(documents[name] for name in MODEL_ORDER)


def agreement_percentage(answers: tuple[int, ...], party: wahlomat.Party) -> float:
    result = wahlomat.calculate_results(answers, (party,))[0]
    return float(result.agreement)


def summarize_experiment(
    document: dict[str, object], parties: tuple[wahlomat.Party, ...]
) -> dict[str, object]:
    settings = document["settings"]
    assert isinstance(settings, dict)
    raw_runs = document["runs"]
    assert isinstance(raw_runs, list)
    evaluable = [
        run for run in raw_runs
        if isinstance(run, dict) and run.get("status") in experiments.EVALUABLE_STATUSES
    ]
    if not evaluable:
        raise ApiAnalysisError(f"Keine auswertbaren Läufe für {settings.get('model_id')}.")

    party_values = {party.name: [] for party in parties}
    winner_counts: Counter[str] = Counter()
    run_rows: list[dict[str, object]] = []
    answer_vectors: list[tuple[int, ...]] = []
    for run in sorted(evaluable, key=lambda item: int(item["replicate"])):
        answers = tuple(run.get("answers", ()))
        try:
            wahlomat.parse_answers(",".join(str(answer) for answer in answers))
        except wahlomat.WahlomatError as exc:
            raise ApiAnalysisError(
                f"Ungültige Antworten in Replikation {run.get('replicate')}."
            ) from exc
        answer_vectors.append(answers)
        agreements = {party.name: agreement_percentage(answers, party) for party in parties}
        best = max(agreements.values())
        winners = [party.name for party in parties if agreements[party.name] == best]
        winner_counts.update(winners)
        for party in parties:
            party_values[party.name].append(agreements[party.name])
        run_rows.append({
            "replicate": run["replicate"],
            "observed_at": run.get("observed_at"),
            "status": run["status"],
            "answers": list(answers),
            "agreements": [
                {"party": party.name, "percentage": rounded(agreements[party.name])}
                for party in parties
            ],
            "winning_parties": winners,
        })

    summaries = []
    for party in parties:
        values = party_values[party.name]
        summaries.append({
            "party": party.name,
            "mean": rounded(mean(values)),
            "median": rounded(median(values)),
            "minimum": rounded(min(values)),
            "maximum": rounded(max(values)),
            "standard_deviation": rounded(pstdev(values)),
            "first_place_count": winner_counts[party.name],
        })
    summaries.sort(key=lambda row: (-float(row["mean"]), str(row["party"])))

    similarities = []
    for index, left in enumerate(answer_vectors):
        for right in answer_vectors[index + 1:]:
            distance = sum(abs(a - b) for a, b in zip(left, right))
            similarities.append(100 * (1 - distance / (2 * wahlomat.THESIS_COUNT)))
    stability = {
        "pair_count": len(similarities),
        "mean": rounded(mean(similarities)) if similarities else 100.0,
        "minimum": rounded(min(similarities)) if similarities else 100.0,
        "maximum": rounded(max(similarities)) if similarities else 100.0,
    }
    statuses = Counter(
        str(run.get("status")) for run in raw_runs if isinstance(run, dict)
    )
    observed_at = sorted(
        str(run["observed_at"])
        for run in raw_runs
        if isinstance(run, dict) and isinstance(run.get("observed_at"), str)
    )
    thesis_answers = []
    for index in range(wahlomat.THESIS_COUNT):
        counts = Counter(answers[index] for answers in answer_vectors)
        modal_count = max(counts.values())
        thesis_answers.append({
            "number": index + 1,
            "agree": counts[1],
            "neutral": counts[0],
            "disagree": counts[-1],
            "modal_answers": [
                answer for answer in (-1, 0, 1) if counts[answer] == modal_count
            ],
            "modal_count": modal_count,
        })
    return {
        "experiment_id": document.get("experiment_id"),
        "model_id": settings.get("model_id"),
        "provider_endpoint": settings.get("provider_endpoint"),
        "reasoning_effort": settings.get("reasoning_effort"),
        "temperature": settings.get("temperature"),
        "attempt_count": len(raw_runs),
        "evaluable_run_count": len(evaluable),
        "status_counts": dict(sorted(statuses.items())),
        "observed_from": observed_at[0] if observed_at else None,
        "observed_to": observed_at[-1] if observed_at else None,
        "stability": stability,
        "runs": run_rows,
        "thesis_answers": thesis_answers,
        "parties": summaries,
    }


def build_report(
    documents: Iterable[tuple[Path, dict[str, object]]],
    parties: tuple[wahlomat.Party, ...],
) -> dict[str, object]:
    material = []
    summaries = []
    for path, document in documents:
        material.append({"path": path.name, "document": document})
        summaries.append(summarize_experiment(document, parties))
    source_digest = hashlib.sha256(canonical_json(material).encode("utf-8")).hexdigest()
    return {
        "schema_version": SCHEMA_VERSION,
        "source_digest": f"sha256:{source_digest}",
        "method": {
            "agreement": "100 * (1 - sum(abs(model_position - party_position)) / 76)",
            "evaluable_statuses": sorted(experiments.EVALUABLE_STATUSES),
            "neutral_only_excluded": True,
            "standard_deviation": "population",
            "ties": "all tied parties count as first place",
        },
        "models": summaries,
    }


def render_csv(report: dict[str, object]) -> str:
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow((
        "model_id", "party", "mean", "median", "minimum", "maximum",
        "standard_deviation", "first_place_count", "evaluable_runs", "attempts",
    ))
    for model in report["models"]:
        for party in model["parties"]:
            writer.writerow((
                model["model_id"], party["party"], party["mean"], party["median"],
                party["minimum"], party["maximum"], party["standard_deviation"],
                party["first_place_count"], model["evaluable_run_count"],
                model["attempt_count"],
            ))
    return output.getvalue()


def write_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        temporary_path = Path(handle.name)
        handle.write(content)
        handle.flush()
    temporary_path.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    args = parser.parse_args()
    documents = load_experiment_files(args.input)
    parties = wahlomat.load_parties(theses=wahlomat.load_theses())
    report = build_report(documents, parties)
    write_atomic(args.json, json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    write_atomic(args.csv, render_csv(report))
    print(f"{len(report['models'])} Modelle: {args.json} und {args.csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
