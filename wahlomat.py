"""Berechnung der Übereinstimmung mit den Berliner Wahl-O-Mat-Daten."""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Iterable
from zipfile import BadZipFile, ZipFile
from xml.etree import ElementTree


THESIS_COUNT = 38
PARTY_COUNT = 17
VALID_POSITIONS = frozenset((-1, 0, 1))
POSITION_LABELS = {
    "Stimme nicht zu": -1,
    "Neutral": 0,
    "Stimme zu": 1,
}
DATASET_PATH = Path(__file__).resolve().parent / "datensatz" / "Wahl-O-Mat Berlin 2026_Datensatz.xlsx"
THESIS_PATH = Path(__file__).resolve().parent / "PROMPT.md"


class WahlomatError(ValueError):
    """Ein erwarteter Fehler beim Einlesen oder Auswerten der Daten."""


@dataclass(frozen=True)
class Thesis:
    number: int
    text: str


@dataclass(frozen=True)
class Party:
    name: str
    positions: tuple[int, ...]


@dataclass(frozen=True)
class Result:
    party: Party
    distance: int
    agreement: Decimal


def load_theses(path: Path = THESIS_PATH) -> tuple[Thesis, ...]:
    """Liest und validiert die nummerierten Thesen aus einer Markdown-Datei."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise WahlomatError(f"Thesen-Datei konnte nicht gelesen werden: {path}") from exc

    theses: list[Thesis] = []
    pattern = re.compile(r"^(\d+)\. (.+)$")
    for line in lines:
        match = pattern.fullmatch(line.strip())
        if match:
            theses.append(Thesis(int(match.group(1)), match.group(2)))
    expected_numbers = list(range(1, THESIS_COUNT + 1))
    if [thesis.number for thesis in theses] != expected_numbers:
        raise WahlomatError(f"Es werden genau die Thesen 1 bis {THESIS_COUNT} erwartet.")
    if any(not thesis.text for thesis in theses):
        raise WahlomatError("Eine These ist leer.")
    return tuple(theses)


def parse_answers(value: str) -> tuple[int, ...]:
    """Parst die kommaseparierten Nutzerpositionen."""
    fields = value.split(",")
    if len(fields) != THESIS_COUNT:
        raise WahlomatError(
            f"Es werden genau {THESIS_COUNT} Antworten erwartet, erhalten: {len(fields)}."
        )
    answers: list[int] = []
    for number, field in enumerate(fields, start=1):
        token = field.strip()
        if token not in {"-1", "0", "1"}:
            raise WahlomatError(
                f"Ungültige Antwort an Position {number}: {field!r}. Erlaubt sind -1, 0 und 1."
            )
        answers.append(int(token))
    return tuple(answers)


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _cell_value(cell: ElementTree.Element, shared_strings: list[str]) -> str:
    value = cell.find("{*}v")
    raw = "" if value is None or value.text is None else value.text
    if cell.attrib.get("t") == "s":
        try:
            return shared_strings[int(raw)]
        except (ValueError, IndexError) as exc:
            raise WahlomatError("Ungültiger Verweis auf eine Excel-Zeichenkette.") from exc
    if cell.attrib.get("t") == "inlineStr":
        return "".join(text.text or "" for text in cell.findall(".//{*}t"))
    return raw


def _worksheet_rows(xml: bytes, shared_strings: list[str]) -> list[list[str]]:
    try:
        root = ElementTree.fromstring(xml)
    except ElementTree.ParseError as exc:
        raise WahlomatError("Das Excel-Arbeitsblatt enthält ungültiges XML.") from exc
    rows: list[list[str]] = []
    for row in root.findall(".//{*}sheetData/{*}row"):
        cells = row.findall("{*}c")
        values: list[str] = []
        for cell in cells:
            reference = cell.attrib.get("r", "")
            match = re.search(r"([A-Z]+)\d+$", reference)
            if not match:
                raise WahlomatError("Eine Excel-Zelle hat keine gültige Adresse.")
            column = 0
            for character in match.group(1):
                column = column * 26 + ord(character) - ord("A") + 1
            while len(values) < column:
                values.append("")
            values[column - 1] = _cell_value(cell, shared_strings)
        rows.append(values)
    return rows


def _read_dataset_rows(path: Path) -> list[list[str]]:
    try:
        archive = ZipFile(path)
    except (OSError, BadZipFile) as exc:
        raise WahlomatError(f"Excel-Datei konnte nicht gelesen werden: {path}") from exc
    with archive:
        try:
            shared_root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = ["".join(node.text or "" for node in item.findall(".//{*}t"))
                              for item in shared_root.findall("{*}si")]
        except (KeyError, ElementTree.ParseError) as exc:
            raise WahlomatError("Die Excel-Datei enthält keine gültige sharedStrings-Tabelle.") from exc
        worksheet_names = [name for name in archive.namelist() if name.startswith("xl/worksheets/") and name.endswith(".xml")]
        for worksheet_name in sorted(worksheet_names):
            rows = _worksheet_rows(archive.read(worksheet_name), shared_strings)
            if rows and rows[0][:8] == [
                "Partei: Nr.", "Partei: Kurzbezeichnung", "Partei: Name", "These: Nr.",
                "These: Titel", "These: These", "Position: Position", "Position: Begründung",
            ]:
                return rows
    raise WahlomatError("Kein Wahl-O-Mat-Positionsblatt gefunden.")


def load_parties(path: Path = DATASET_PATH, theses: Iterable[Thesis] | None = None) -> tuple[Party, ...]:
    """Liest Parteien und Positionen und prüft ihre Übereinstimmung mit den Thesen."""
    expected_theses = tuple(theses) if theses is not None else None
    if expected_theses is not None and len(expected_theses) != THESIS_COUNT:
        raise WahlomatError(f"Es werden genau {THESIS_COUNT} Thesen benötigt.")
    rows = _read_dataset_rows(path)
    if len(rows) < 2:
        raise WahlomatError("Das Positionsblatt enthält keine Daten.")
    grouped: dict[str, list[tuple[int, int]]] = {}
    dataset_theses: dict[int, str] = {}
    for row_number, row in enumerate(rows[1:], start=2):
        if len(row) < 7:
            raise WahlomatError(f"Zeile {row_number} im Positionsblatt ist unvollständig.")
        short_name, thesis_number, thesis_text, position = (
            row[1].strip(), row[3].strip(), row[5].strip(), row[6].strip()
        )
        if not short_name:
            raise WahlomatError(f"Zeile {row_number} enthält keinen Parteinamen.")
        try:
            number = int(thesis_number)
        except ValueError as exc:
            raise WahlomatError(f"Ungültige Thesennummer in Zeile {row_number}.") from exc
        if number < 1 or number > THESIS_COUNT:
            raise WahlomatError(f"Ungültige Thesennummer {number} in Zeile {row_number}.")
        if expected_theses is not None and thesis_text != expected_theses[number - 1].text:
            raise WahlomatError(f"These {number} in Zeile {row_number} stimmt nicht mit thesen.md überein.")
        known_thesis = dataset_theses.setdefault(number, thesis_text)
        if known_thesis != thesis_text:
            raise WahlomatError(f"These {number} ist im Positionsblatt nicht konsistent.")
        if position not in POSITION_LABELS:
            raise WahlomatError(f"Ungültige Parteiposition in Zeile {row_number}: {position!r}.")
        grouped.setdefault(short_name, []).append((number, POSITION_LABELS[position]))
    if len(grouped) != PARTY_COUNT:
        raise WahlomatError(f"Es werden genau {PARTY_COUNT} Parteien erwartet, gefunden: {len(grouped)}.")
    if set(dataset_theses) != set(range(1, THESIS_COUNT + 1)):
        raise WahlomatError("Das Positionsblatt enthält nicht genau die Thesen 1 bis 38.")
    parties: list[Party] = []
    for name, entries in grouped.items():
        if len(entries) != THESIS_COUNT or {number for number, _ in entries} != set(range(1, THESIS_COUNT + 1)):
            raise WahlomatError(f"Partei {name!r} besitzt nicht genau eine Position je These.")
        positions = tuple(position for _, position in sorted(entries))
        if any(position not in VALID_POSITIONS for position in positions):
            raise WahlomatError(f"Partei {name!r} enthält eine ungültige Position.")
        parties.append(Party(name, positions))
    return tuple(parties)


def select_parties(parties: Iterable[Party], subset: str | None = None) -> tuple[Party, ...]:
    """Wählt Parteien anhand ihrer Kurzbezeichnung, ohne Groß-/Kleinschreibung."""
    available = tuple(parties)
    if subset is None:
        return available
    names = [name.strip() for name in subset.split(",")]
    if not names or any(not name for name in names):
        raise WahlomatError("Die Parteiauswahl darf keine leeren Namen enthalten.")
    lookup = {party.name.casefold(): party for party in available}
    unknown = [name for name in names if name.casefold() not in lookup]
    if unknown:
        raise WahlomatError(f"Unbekannte Partei(en): {', '.join(unknown)}.")
    selected_names = {name.casefold() for name in names}
    return tuple(party for party in available if party.name.casefold() in selected_names)


def calculate_results(answers: tuple[int, ...], parties: Iterable[Party]) -> tuple[Result, ...]:
    if len(answers) != THESIS_COUNT or any(answer not in VALID_POSITIONS for answer in answers):
        raise WahlomatError(f"Es werden {THESIS_COUNT} gültige Antworten benötigt.")
    results = []
    for party in parties:
        if len(party.positions) != THESIS_COUNT or any(position not in VALID_POSITIONS for position in party.positions):
            raise WahlomatError(f"Ungültige Positionen für Partei {party.name!r}.")
        distance = sum(abs(position - answer) for position, answer in zip(party.positions, answers))
        agreement = (Decimal(1) - Decimal(distance) / Decimal(2 * THESIS_COUNT)) * Decimal(100)
        results.append(Result(party, distance, agreement))
    return tuple(sorted(results, key=lambda result: -result.agreement))


def format_results(results: Iterable[Result]) -> str:
    lines = []
    for rank, result in enumerate(results, start=1):
        percentage = result.agreement.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
        percentage_text = f"{percentage:.1f}".replace(".", ",")
        lines.append(f"{rank}. {result.party.name}: {percentage_text} %")
    return "\n".join(lines)
