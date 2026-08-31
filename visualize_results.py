"""Erzeugt eine SVG-Übersicht der Wahl-O-Mat-Ergebnisse von Sprachmodellen."""

from __future__ import annotations

import argparse
import hashlib
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from xml.sax.saxutils import escape

import analysis
import wahlomat


DEFAULT_INPUT = Path(__file__).resolve().parent / "responses" / "responses.json"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "figures" / "wahlomat-vergleich.svg"
DEFAULT_SUBSET = ("SPD", "GRÜNE", "Die Linke", "CDU", "AfD", "FDP")
VENDOR_COLORS = {
    "anthropic": "#d96b45",
    "google": "#4276d0",
    "openai": "#1e9b83",
    "x": "#4b4b57",
}
FALLBACK_COLORS = ("#805ad5", "#bd4f84", "#16879a", "#b7791f")


class VisualizationError(ValueError):
    """Ein erwarteter Fehler beim Einlesen oder Visualisieren der Ergebnisse."""


@dataclass(frozen=True)
class ModelResponse:
    vendor: str
    model: str
    timestamp: str
    answers: tuple[int, ...]


@dataclass(frozen=True)
class ModelResult:
    response: ModelResponse
    agreements: tuple[Decimal, ...]


def load_responses(path: Path) -> tuple[ModelResponse, ...]:
    """Liest vollständige Modellantworten; blockierte Antworten bleiben außen vor."""
    try:
        observations = analysis.load_observations(path)
    except analysis.AnalysisError as exc:
        raise VisualizationError(str(exc)) from exc
    responses = [
        ModelResponse(run.vendor, run.model, analysis.format_utc(run.observed_at), run.answers or ())
        for run in observations
        if run.status == "complete"
    ]
    if not responses:
        raise VisualizationError("Die Ergebnisdatei enthält keine vollständigen Antworten.")
    return tuple(responses)


def calculate_model_results(
    responses: tuple[ModelResponse, ...], parties: tuple[wahlomat.Party, ...]
) -> tuple[ModelResult, ...]:
    """Berechnet die Übereinstimmung jeder vollständigen Antwort mit allen Parteien."""
    return tuple(
        ModelResult(response, _agreements_in_party_order(response.answers, parties))
        for response in responses
    )


def _agreements_in_party_order(
    answers: tuple[int, ...], parties: tuple[wahlomat.Party, ...]
) -> tuple[Decimal, ...]:
    calculated = wahlomat.calculate_results(answers, parties)
    agreement_by_party = {result.party.name: result.agreement for result in calculated}
    return tuple(agreement_by_party[party.name] for party in parties)


def _color_for_vendor(vendor: str) -> str:
    known_color = VENDOR_COLORS.get(vendor.casefold())
    if known_color:
        return known_color
    digest = hashlib.sha256(vendor.casefold().encode("utf-8")).digest()
    return FALLBACK_COLORS[digest[0] % len(FALLBACK_COLORS)]


def _heat_color(agreement: Decimal) -> str:
    low = (239, 241, 244)
    high = (24, 105, 124)
    progress = max(0.0, min(1.0, (float(agreement) - 20) / 55))
    eased = progress**0.8
    channels = tuple(round(start + (end - start) * eased) for start, end in zip(low, high))
    return "#" + "".join(f"{channel:02x}" for channel in channels)


def _model_label(response: ModelResponse) -> str:
    if response.model.casefold().startswith(response.vendor.casefold()):
        return response.model
    return f"{response.vendor} · {response.model}"


def _svg_text(value: str) -> str:
    return escape(value, {'"': "&quot;"})


def render_svg(results: tuple[ModelResult, ...], parties: tuple[wahlomat.Party, ...]) -> str:
    """Rendert eine kompakte Übersicht mit Spitzenwerten und vollständiger Heatmap."""
    party_order = tuple(
        index
        for index, _ in sorted(
            enumerate(parties),
            key=lambda item: (
                -sum(float(row.agreements[item[0]]) for row in results) / len(results),
                item[1].name.casefold(),
            ),
        )
    )
    ordered_parties = tuple(parties[index] for index in party_order)
    width = 1860
    title_height = 238
    row_height = 42
    footer_height = 100
    height = title_height + len(results) * row_height + footer_height
    label_x = 60
    dot_start_x = 500
    dot_end_x = 785
    matrix_x = 1020
    cell_width = 43
    matrix_y = title_height
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title description">',
        "<title id=\"title\">Wahl-O-Mat: Vergleich der Modellantworten</title>",
        "<desc id=\"description\">Punktdiagramm der besten Parteienübereinstimmung und Heatmap der ausgewählten Parteien.</desc>",
        f'<rect width="{width}" height="{height}" fill="#fbfaf8"/>',
        "<style>text { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #17202a; } .muted { fill: #66717f; } .tiny { font-size: 12px; } .small { font-size: 14px; } .label { font-size: 15px; font-weight: 600; } .heading { font-size: 17px; font-weight: 700; letter-spacing: .02em; } </style>",
        "<text x=\"60\" y=\"58\" font-size=\"31px\" font-weight=\"750\" letter-spacing=\"-.04em\">Wahl-O-Mat: politische Nähe der Modelle</text>",
        f'<text class="muted small" x="60" y="88">{len(results)} vollständige Antworten · 38 Thesen · Berliner Abgeordnetenhauswahl 2026</text>',
        f'<line x1="60" y1="116" x2="{width - 60}" y2="116" stroke="#dce1e6"/>',
        "<text class=\"heading\" x=\"60\" y=\"145\">MODELL</text>",
        "<text class=\"heading\" x=\"500\" y=\"145\">BESTE ÜBEREINSTIMMUNG</text>",
        f'<text class="heading" x="{matrix_x}" y="145">ÜBEREINSTIMMUNG NACH PARTEI</text>',
    ]
    for index, party in enumerate(ordered_parties):
        x = matrix_x + index * cell_width + cell_width / 2
        parts.append(
            f'<text class="tiny muted" transform="translate({x:.1f} 224) rotate(-38)" text-anchor="start">{_svg_text(party.name)}</text>'
        )
    for row_index, result in enumerate(results):
        y = matrix_y + row_index * row_height
        center_y = y + row_height / 2
        original_scores = result.agreements
        top_index = max(range(len(parties)), key=lambda index: original_scores[index])
        top_score = original_scores[top_index]
        dot_x = dot_start_x + float(top_score) / 100 * (dot_end_x - dot_start_x)
        vendor_color = _color_for_vendor(result.response.vendor)
        if row_index % 2:
            parts.append(f'<rect x="48" y="{y}" width="{width - 96}" height="{row_height}" rx="7" fill="#f4f5f5"/>')
        parts.extend(
            (
                f'<circle cx="{label_x}" cy="{center_y:.1f}" r="5" fill="{vendor_color}"/>',
                f'<text class="label" x="76" y="{center_y + 5:.1f}">{_svg_text(_model_label(result.response))}</text>',
                f'<line x1="{dot_start_x}" y1="{center_y:.1f}" x2="{dot_end_x}" y2="{center_y:.1f}" stroke="#d7dde3" stroke-width="3" stroke-linecap="round"/>',
                f'<circle cx="{dot_x:.1f}" cy="{center_y:.1f}" r="8" fill="{vendor_color}" stroke="#fbfaf8" stroke-width="3"/>',
                f'<text class="small" x="{dot_end_x + 18}" y="{center_y + 5:.1f}" font-weight="700">{_svg_text(parties[top_index].name)} <tspan class="muted" font-weight="500">{float(top_score):.1f}%</tspan></text>',
            )
        )
        for column_index, party_index in enumerate(party_order):
            x = matrix_x + column_index * cell_width
            score = original_scores[party_index]
            parts.append(
                f'<rect x="{x + 3}" y="{y + 5}" width="{cell_width - 6}" height="{row_height - 10}" rx="5" fill="{_heat_color(score)}"><title>{_svg_text(result.response.model)} · {_svg_text(parties[party_index].name)}: {float(score):.1f}%</title></rect>'
            )
    legend_y = height - 43
    parts.extend(
        (
            f'<text class="tiny muted" x="60" y="{legend_y}">Farbe zeigt Anbieter bzw. Modellfamilie · Punkte zeigen die jeweils höchste Übereinstimmung.</text>',
            f'<text class="tiny muted" x="{matrix_x}" y="{legend_y}">niedrig</text>',
            f'<defs><linearGradient id="scale" x1="0%" x2="100%"><stop offset="0%" stop-color="{_heat_color(Decimal(20))}"/><stop offset="100%" stop-color="{_heat_color(Decimal(75))}"/></linearGradient></defs>',
            f'<rect x="{matrix_x + 51}" y="{legend_y - 11}" width="180" height="10" rx="5" fill="url(#scale)"/>',
            f'<text class="tiny muted" x="{matrix_x + 243}" y="{legend_y}">hoch</text>',
        )
    )
    if any(result.response.model.casefold().startswith("grok") for result in results):
        parts.append(
            f'<text class="tiny muted" x="60" y="{height - 18}">Grok-Ausgabe: Created with Grok.</text>'
        )
    parts.append("</svg>")
    return "\n".join(parts)


def write_figure(input_path: Path, output_path: Path, subset: str | None = None) -> None:
    """Lädt Antworten und schreibt die SVG-Grafik an das angegebene Ziel."""
    responses = load_responses(input_path)
    available_parties = wahlomat.load_parties()
    parties = wahlomat.select_parties(available_parties, subset)
    results = calculate_model_results(responses, parties)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_svg(results, parties), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Visualisiert Wahl-O-Mat-Modellantworten als SVG.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="JSON-Datei mit Modellantworten")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Zielpfad der SVG-Datei")
    parser.add_argument(
        "--subset",
        nargs="?",
        const=", ".join(DEFAULT_SUBSET),
        help="Kommagetrennte Parteiauswahl; ohne Wert: SPD, GRÜNE, Die Linke, CDU, AfD, FDP",
    )
    args = parser.parse_args(argv)
    try:
        write_figure(args.input, args.output, args.subset)
    except (VisualizationError, wahlomat.WahlomatError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
