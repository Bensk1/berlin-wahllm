"""Exportiert validierte Modellläufe als deterministische Website-Daten."""

from __future__ import annotations

import argparse
from pathlib import Path

import analysis
import wahlomat


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "responses" / "responses.json"
DEFAULT_OUTPUT = ROOT / "site" / "src" / "data" / "results.json"


def export_site_data(
    input_path: Path,
    dataset_path: Path,
    output_path: Path,
    theses_path: Path | None = None,
) -> None:
    """Validiert die Quellen, berechnet die Analyse und schreibt sie atomar."""
    observations = analysis.load_observations(input_path)
    theses = wahlomat.load_theses(theses_path or wahlomat.THESIS_PATH)
    parties = wahlomat.load_parties(dataset_path, theses)
    analysis.write_export_atomic(output_path, analysis.build_export(observations, parties, theses))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Exportiert die WahLLM-Analyse als Website-JSON.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Beobachtungen als JSON")
    parser.add_argument("--dataset", type=Path, default=wahlomat.DATASET_PATH, help="Lokales XLSX")
    parser.add_argument(
        "--theses", type=Path, help="Thesenquelle; standardmäßig PROMPT.md"
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Website-JSON")
    args = parser.parse_args(argv)
    try:
        export_site_data(args.input, args.dataset, args.output, args.theses)
    except (analysis.AnalysisError, wahlomat.WahlomatError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
