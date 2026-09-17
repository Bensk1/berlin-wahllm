"""Export the controlled API experiments as deterministic website data."""

from __future__ import annotations

import argparse
import hashlib
from collections import Counter
from pathlib import Path
from typing import Iterable

import analysis
import analyze_api_experiments as api_analysis
import wahlomat


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "responses" / "api_experiments"
DEFAULT_OUTPUT = ROOT / "site" / "src" / "data" / "results.json"
SCHEMA_VERSION = 2

MODEL_LABELS = {
    "x-ai/grok-4.5": "Grok 4.5",
    "anthropic/claude-sonnet-4.6": "Claude Sonnet 4.6",
    "google/gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
    "openai/gpt-5.6-terra": "ChatGPT-5.6 Terra",
    "google/gemma-4-26b-a4b-it": "Gemma 4 26B",
    "mistralai/mistral-medium-3-5": "Mistral Medium 3.5",
    "z-ai/glm-5.3-flash": "GLM 5.3 Flash",
    "moonshotai/kimi-k3": "Kimi K3",
}


def _source_digest(
    report_digest: str,
    parties: Iterable[wahlomat.Party],
    theses: Iterable[wahlomat.Thesis],
) -> str:
    material = {
        "api_experiments": report_digest,
        "parties": [
            {"name": party.name, "positions": list(party.positions)} for party in parties
        ],
        "theses": [
            {"number": thesis.number, "text": thesis.text} for thesis in theses
        ],
    }
    digest = hashlib.sha256(analysis.canonical_json(material).encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def _ranked_agreements(
    rows: Iterable[dict[str, object]], party_names: tuple[str, ...]
) -> list[dict[str, object]]:
    rows_by_party = {str(row["party"]): row for row in rows}
    ordered_by_mean = sorted(
        rows_by_party.values(), key=lambda row: (-float(row["mean"]), str(row["party"]))
    )
    ranks: dict[str, int] = {}
    previous_mean: float | None = None
    previous_rank = 0
    for position, row in enumerate(ordered_by_mean, start=1):
        current_mean = float(row["mean"])
        if current_mean != previous_mean:
            previous_rank = position
            previous_mean = current_mean
        ranks[str(row["party"])] = previous_rank
    return [
        {
            **rows_by_party[party],
            "percentage": rows_by_party[party]["mean"],
            "rank": ranks[party],
        }
        for party in party_names
    ]


def build_site_export(
    documents: Iterable[tuple[Path, dict[str, object]]],
    parties: Iterable[wahlomat.Party],
    theses: Iterable[wahlomat.Thesis],
) -> dict[str, object]:
    document_list = tuple(documents)
    party_list = tuple(parties)
    thesis_list = tuple(theses)
    report = api_analysis.build_report(document_list, party_list)
    party_names = tuple(party.name for party in party_list)
    settings_by_model = {
        str(document["settings"]["model_id"]): document["settings"]
        for _, document in document_list
    }
    models = []
    status_counts: Counter[str] = Counter()
    observed_at: list[str] = []
    for summary in report["models"]:
        model_id = str(summary["model_id"])
        if model_id not in MODEL_LABELS:
            raise api_analysis.ApiAnalysisError(
                f"Keine Website-Bezeichnung für Modell {model_id!r}."
            )
        settings = settings_by_model[model_id]
        if not isinstance(settings.get("max_tokens"), int):
            raise api_analysis.ApiAnalysisError(
                f"Ungültiges Ausgabetokenlimit für Modell {model_id!r}."
            )
        if not isinstance(summary["observed_from"], str) or not isinstance(
            summary["observed_to"], str
        ):
            raise api_analysis.ApiAnalysisError(
                f"Fehlender Beobachtungszeitraum für Modell {model_id!r}."
            )
        status_counts.update(summary["status_counts"])
        model_observed_at = [
            value for value in (summary["observed_from"], summary["observed_to"])
            if isinstance(value, str)
        ]
        observed_at.extend(model_observed_at)
        model = {
            "id": summary["experiment_id"],
            "model": model_id,
            "display_name": MODEL_LABELS[model_id],
            "short_display_name": MODEL_LABELS[model_id],
            "provider_endpoint": summary["provider_endpoint"],
            "reasoning_effort": summary["reasoning_effort"],
            "temperature": summary["temperature"],
            "max_output_tokens": settings["max_tokens"],
            "attempt_count": summary["attempt_count"],
            "evaluable_run_count": summary["evaluable_run_count"],
            "status_counts": summary["status_counts"],
            "observed_from": summary["observed_from"],
            "observed_to": summary["observed_to"],
            "stability": summary["stability"],
            "agreements": _ranked_agreements(summary["parties"], party_names),
            "thesis_answers": summary["thesis_answers"],
            "runs": summary["runs"],
        }
        models.append(model)

    return {
        "schema_version": SCHEMA_VERSION,
        "source_digest": _source_digest(str(report["source_digest"]), party_list, thesis_list),
        "election": {
            "name": analysis.ELECTION_NAME,
            "thesis_count": wahlomat.THESIS_COUNT,
            "party_count": len(party_list),
        },
        "method": report["method"],
        "summary": {
            "model_count": len(models),
            "attempt_count": sum(int(model["attempt_count"]) for model in models),
            "evaluable_run_count": sum(
                int(model["evaluable_run_count"]) for model in models
            ),
            "status_counts": dict(sorted(status_counts.items())),
            "observed_from": min(observed_at),
            "observed_to": max(observed_at),
        },
        "parties": list(party_names),
        "theses": [
            {"number": thesis.number, "text": thesis.text} for thesis in thesis_list
        ],
        "models": models,
    }


def export_site_data(
    input_path: Path,
    dataset_path: Path,
    output_path: Path,
    theses_path: Path | None = None,
) -> None:
    documents = api_analysis.load_experiment_files(input_path)
    theses = wahlomat.load_theses(theses_path or wahlomat.THESIS_PATH)
    parties = wahlomat.load_parties(dataset_path, theses)
    export = build_site_export(documents, parties, theses)
    analysis.write_export_atomic(output_path, export)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Exportiert die kontrollierten API-Experimente für die Website."
    )
    parser.add_argument(
        "--input", type=Path, default=DEFAULT_INPUT, help="Verzeichnis der API-Experimente"
    )
    parser.add_argument("--dataset", type=Path, default=wahlomat.DATASET_PATH, help="Lokales XLSX")
    parser.add_argument("--theses", type=Path, help="Thesenquelle; standardmäßig PROMPT.md")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Website-JSON")
    args = parser.parse_args(argv)
    try:
        export_site_data(args.input, args.dataset, args.output, args.theses)
    except (api_analysis.ApiAnalysisError, wahlomat.WahlomatError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
