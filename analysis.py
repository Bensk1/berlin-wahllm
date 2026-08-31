"""Validierung und abgeleitete Analyse der beobachteten Modellläufe."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Iterable, Literal

import wahlomat


ELECTION_NAME = "Abgeordnetenhauswahl Berlin 2026"
SCHEMA_VERSION = 1
_TIMESTAMP_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$"
)
_REQUIRED_FIELDS = frozenset(("vendor", "model", "timestamp", "anonymous"))
_OPTIONAL_FIELDS = frozenset((
    "display_name", "short_display_name", "note", "response", "response_blocked"
))


class AnalysisError(ValueError):
    """Ein erwarteter Fehler beim Validieren oder Analysieren von Beobachtungen."""


@dataclass(frozen=True)
class ObservedRun:
    vendor: str
    model: str
    observed_at: datetime
    anonymous: bool
    status: Literal["complete", "blocked"]
    answers: tuple[int, ...] | None = None
    note: str | None = None
    display_name: str | None = None
    short_display_name: str | None = None

    @property
    def id(self) -> str:
        payload: dict[str, object] = {
            "model": self.model,
            "observed_at": format_utc(self.observed_at),
            "status": self.status,
            "vendor": self.vendor,
        }
        if self.status == "complete":
            payload["answers"] = list(self.answers or ())
        else:
            payload["blocked"] = True
        digest = hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()
        return f"run-{digest[:24]}"


def canonical_json(value: object) -> str:
    """Serialisiert ohne bedeutungslose Leerzeichen und mit stabiler Schlüsselsortierung."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def format_utc(value: datetime) -> str:
    """Gibt eine UTC-Zeit als RFC3339-Zeit mit Z-Suffix aus."""
    utc_value = value.astimezone(timezone.utc)
    if utc_value.microsecond:
        return utc_value.isoformat(timespec="microseconds").replace("+00:00", "Z")
    return utc_value.isoformat(timespec="seconds").replace("+00:00", "Z")


def _normalise_text(value: object, field: str, index: int) -> str:
    if not isinstance(value, str):
        raise AnalysisError(f"Eintrag {index}: {field} muss Text sein.")
    normalized = unicodedata.normalize("NFC", value).strip()
    if not normalized:
        raise AnalysisError(f"Eintrag {index}: {field} darf nicht leer sein.")
    return normalized


def _parse_timestamp(value: object, index: int) -> datetime:
    if not isinstance(value, str) or not _TIMESTAMP_PATTERN.fullmatch(value):
        raise AnalysisError(
            f"Eintrag {index}: timestamp muss RFC3339 mit explizitem Offset sein."
        )
    try:
        timestamp = datetime.fromisoformat(value)
    except ValueError as exc:
        raise AnalysisError(f"Eintrag {index}: timestamp ist ungültig.") from exc
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise AnalysisError(
            f"Eintrag {index}: timestamp muss RFC3339 mit explizitem Offset sein."
        )
    return timestamp.astimezone(timezone.utc)


def _validate_item(item: object, index: int) -> ObservedRun:
    if not isinstance(item, dict):
        raise AnalysisError(f"Eintrag {index} muss ein JSON-Objekt sein.")
    fields = set(item)
    unknown = fields - _REQUIRED_FIELDS - _OPTIONAL_FIELDS
    if unknown:
        raise AnalysisError(f"Eintrag {index} enthält unbekannte Felder: {', '.join(sorted(unknown))}.")
    missing = _REQUIRED_FIELDS - fields
    if missing:
        raise AnalysisError(f"Eintrag {index} benötigt: {', '.join(sorted(missing))}.")

    vendor = _normalise_text(item["vendor"], "vendor", index)
    model = _normalise_text(item["model"], "model", index)
    observed_at = _parse_timestamp(item["timestamp"], index)
    anonymous = item["anonymous"]
    if type(anonymous) is not bool:
        raise AnalysisError(f"Eintrag {index}: anonymous muss true oder false sein.")

    note: str | None = None
    if "note" in item:
        note = _normalise_text(item["note"], "note", index)
    display_name: str | None = None
    if "display_name" in item:
        display_name = _normalise_text(item["display_name"], "display_name", index)
    short_display_name: str | None = None
    if "short_display_name" in item:
        short_display_name = _normalise_text(
            item["short_display_name"], "short_display_name", index
        )

    has_response = "response" in item
    has_blocked = "response_blocked" in item
    if has_response == has_blocked:
        raise AnalysisError(
            f"Eintrag {index} benötigt genau eines von response oder response_blocked=true."
        )
    if has_blocked:
        if item["response_blocked"] is not True:
            raise AnalysisError(f"Eintrag {index}: response_blocked muss true sein.")
        return ObservedRun(
            vendor, model, observed_at, anonymous, "blocked", note=note,
            display_name=display_name, short_display_name=short_display_name,
        )

    raw_answers = item["response"]
    if not isinstance(raw_answers, str):
        raise AnalysisError(f"Eintrag {index}: response muss Text sein.")
    try:
        answers = wahlomat.parse_answers(raw_answers)
    except wahlomat.WahlomatError as exc:
        raise AnalysisError(f"Ungültige Antwort in Eintrag {index} ({model}): {exc}") from exc
    return ObservedRun(
        vendor, model, observed_at, anonymous, "complete", answers, note, display_name,
        short_display_name,
    )


def load_observations(path: Path) -> tuple[ObservedRun, ...]:
    """Lädt strikt validierte Beobachtungen aus dem append-only JSON-Format."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise AnalysisError(f"Ergebnisdatei konnte nicht gelesen werden: {path}") from exc
    except json.JSONDecodeError as exc:
        raise AnalysisError(f"Ergebnisdatei enthält ungültiges JSON: {path}") from exc
    if not isinstance(data, list):
        raise AnalysisError("Die Ergebnisdatei muss eine JSON-Liste enthalten.")

    observations = tuple(_validate_item(item, index) for index, item in enumerate(data, start=1))
    ids = [observation.id for observation in observations]
    if len(ids) != len(set(ids)):
        duplicates = sorted({run_id for run_id in ids if ids.count(run_id) > 1})
        raise AnalysisError(f"Doppelte Lauf-ID(s): {', '.join(duplicates)}.")
    return observations


def stable_run_order(observations: Iterable[ObservedRun]) -> tuple[ObservedRun, ...]:
    """Sortiert Läufe gemäß dem öffentlichen Exportvertrag."""
    return tuple(sorted(observations, key=lambda run: (run.observed_at, run.vendor, run.model, run.id)))


def _percentage(value: Decimal) -> int | float:
    rounded = value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    if rounded == rounded.to_integral_value():
        return int(rounded)
    return float(rounded)


def _agreement_rows(
    answers: tuple[int, ...], parties: tuple[wahlomat.Party, ...]
) -> list[dict[str, object]]:
    calculated = wahlomat.calculate_results(answers, parties)
    by_name = {result.party.name: result for result in calculated}
    rank_by_distance: dict[int, int] = {}
    for position, result in enumerate(calculated, start=1):
        rank_by_distance.setdefault(result.distance, position)
    return [
        {
            "party": party.name,
            "percentage": _percentage(by_name[party.name].agreement),
            "rank": rank_by_distance[by_name[party.name].distance],
        }
        for party in parties
    ]


def _semantic_observation(run: ObservedRun) -> dict[str, object]:
    payload: dict[str, object] = {
        "anonymous": run.anonymous,
        "model": run.model,
        "observed_at": format_utc(run.observed_at),
        "status": run.status,
        "vendor": run.vendor,
    }
    if run.display_name is not None:
        payload["display_name"] = run.display_name
    if run.short_display_name is not None:
        payload["short_display_name"] = run.short_display_name
    if run.note is not None:
        payload["note"] = run.note
    if run.status == "complete":
        payload["answers"] = list(run.answers or ())
    else:
        payload["blocked"] = True
    return payload


def source_digest(
    observations: Iterable[ObservedRun],
    parties: Iterable[wahlomat.Party],
    theses: Iterable[wahlomat.Thesis],
) -> str:
    """Hash über sämtliche validierten, fachlich relevanten Eingaben."""
    payload = {
        "observations": [_semantic_observation(run) for run in stable_run_order(observations)],
        "parties": [
            {"name": party.name, "positions": list(party.positions)} for party in parties
        ],
        "theses": [
            {"number": thesis.number, "text": thesis.text} for thesis in theses
        ],
    }
    return "sha256:" + hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def _thesis_summary(observations: Iterable[ObservedRun]) -> list[dict[str, int]]:
    complete_runs = [run for run in observations if run.status == "complete"]
    return [
        {
            "number": number,
            "agree": sum(run.answers[number - 1] == 1 for run in complete_runs if run.answers),
            "neutral": sum(run.answers[number - 1] == 0 for run in complete_runs if run.answers),
            "disagree": sum(run.answers[number - 1] == -1 for run in complete_runs if run.answers),
        }
        for number in range(1, wahlomat.THESIS_COUNT + 1)
    ]


def _similarities(complete_runs: tuple[ObservedRun, ...]) -> list[dict[str, object]]:
    similarities: list[dict[str, object]] = []
    for left_index, left in enumerate(complete_runs):
        for right in complete_runs[left_index + 1 :]:
            distance = sum(abs(a - b) for a, b in zip(left.answers or (), right.answers or ()))
            percentage = (Decimal(1) - Decimal(distance) / Decimal(2 * wahlomat.THESIS_COUNT)) * 100
            similarities.append(
                {
                    "left_run_id": left.id,
                    "right_run_id": right.id,
                    "percentage": _percentage(percentage),
                }
            )
    return similarities


def build_export(
    observations: Iterable[ObservedRun],
    parties: Iterable[wahlomat.Party],
    theses: Iterable[wahlomat.Thesis],
) -> dict[str, object]:
    """Erzeugt den versionierten, ausschließlich abgeleiteten Website-Export."""
    ordered_observations = stable_run_order(observations)
    party_list = tuple(parties)
    thesis_list = tuple(theses)
    if not party_list:
        raise AnalysisError("Für den Export wird mindestens eine Partei benötigt.")
    for party in party_list:
        if not party.name or len(party.positions) != wahlomat.THESIS_COUNT:
            raise AnalysisError(f"Ungültige Partei für den Export: {party.name!r}.")
    if (
        len(thesis_list) != wahlomat.THESIS_COUNT
        or [thesis.number for thesis in thesis_list]
        != list(range(1, wahlomat.THESIS_COUNT + 1))
        or any(not thesis.text for thesis in thesis_list)
    ):
        raise AnalysisError(f"Für den Export werden genau {wahlomat.THESIS_COUNT} Thesen benötigt.")

    runs: list[dict[str, object]] = []
    complete_runs: list[ObservedRun] = []
    for run in ordered_observations:
        row: dict[str, object] = {
            "id": run.id,
            "vendor": run.vendor,
            "model": run.model,
            "observed_at": format_utc(run.observed_at),
            "anonymous": run.anonymous,
            "status": run.status,
        }
        if run.display_name is not None:
            row["display_name"] = run.display_name
        if run.short_display_name is not None:
            row["short_display_name"] = run.short_display_name
        if run.note is not None:
            row["note"] = run.note
        if run.status == "complete":
            answers = run.answers or ()
            row["answers"] = list(answers)
            row["agreements"] = _agreement_rows(answers, party_list)
            complete_runs.append(run)
        runs.append(row)

    return {
        "schema_version": SCHEMA_VERSION,
        "source_digest": source_digest(ordered_observations, party_list, thesis_list),
        "election": {
            "name": ELECTION_NAME,
            "thesis_count": wahlomat.THESIS_COUNT,
            "party_count": len(party_list),
        },
        "summary": {
            "observation_count": len(ordered_observations),
            "complete_count": len(complete_runs),
            "blocked_count": len(ordered_observations) - len(complete_runs),
        },
        "parties": [party.name for party in party_list],
        "theses": [
            {"number": thesis.number, "text": thesis.text} for thesis in thesis_list
        ],
        "runs": runs,
        "thesis_summary": _thesis_summary(ordered_observations),
        "similarities": _similarities(tuple(complete_runs)),
    }


def write_export_atomic(path: Path, export: dict[str, object]) -> None:
    """Schreibt den Export per Replace, damit Leser nie Teilinhalte sehen."""
    path.parent.mkdir(parents=True, exist_ok=True)
    contents = json.dumps(export, ensure_ascii=False, indent=2) + "\n"
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent, text=True)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(contents)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, path)
    except BaseException:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise
