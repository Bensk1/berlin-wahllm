import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import analysis
import export_site_data
import wahlomat


def answers(value: int) -> str:
    return ",".join([str(value)] * 38)


def response(model: str, timestamp: str, value: int = 0) -> dict[str, object]:
    return {
        "vendor": "Example",
        "model": model,
        "timestamp": timestamp,
        "anonymous": False,
        "response": answers(value),
    }


PARTIES = (
    wahlomat.Party("Alpha", (0,) * 38),
    wahlomat.Party("Beta", (1,) * 38),
    wahlomat.Party("Gamma", (-1,) * 38),
)
THESES = tuple(wahlomat.Thesis(number, f"These {number}") for number in range(1, 39))


class ObservationValidationTests(unittest.TestCase):
    def write_json(self, data: object) -> Path:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / "responses.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    def test_loads_complete_and_blocked_runs_with_utc_normalisation(self) -> None:
        path = self.write_json(
            [
                response("complete", "2026-08-29T18:05:00+02:00"),
                {
                    "vendor": "Example",
                    "model": "blocked",
                    "timestamp": "2026-08-29T18:06:00+02:00",
                    "anonymous": True,
                    "note": " refused ",
                    "response_blocked": True,
                },
            ]
        )
        complete, blocked = analysis.load_observations(path)
        self.assertEqual(analysis.format_utc(complete.observed_at), "2026-08-29T16:05:00Z")
        self.assertEqual(blocked.status, "blocked")
        self.assertEqual(blocked.note, "refused")
        self.assertTrue(complete.id.startswith("run-"))
        self.assertEqual(len(complete.id), 28)

    def test_rejects_unknown_fields_bad_types_and_naive_timestamps(self) -> None:
        invalid_entries = (
            {**response("unknown", "2026-08-29T18:05:00+02:00"), "extra": 1},
            {**response("anonymous", "2026-08-29T18:05:00+02:00"), "anonymous": 1},
            response("naive", "2026-08-29T18:05:00"),
            {**response("both", "2026-08-29T18:05:00+02:00"), "response_blocked": True},
            {
                "vendor": "Example",
                "model": "blocked false",
                "timestamp": "2026-08-29T18:05:00+02:00",
                "anonymous": False,
                "response_blocked": False,
            },
        )
        for item in invalid_entries:
            with self.subTest(item=item):
                with self.assertRaises(analysis.AnalysisError):
                    analysis.load_observations(self.write_json([item]))

    def test_rejects_duplicate_deterministic_ids(self) -> None:
        entry = response("same", "2026-08-29T18:05:00+02:00")
        with self.assertRaisesRegex(analysis.AnalysisError, "Doppelte Lauf-ID"):
            analysis.load_observations(self.write_json([entry, entry]))

    def test_display_names_are_optional_nonempty_and_do_not_change_id(self) -> None:
        entry = response("technical-name", "2026-08-29T18:05:00+02:00")
        plain = analysis.load_observations(self.write_json([entry]))[0]
        named = analysis.load_observations(
            self.write_json([{
                **entry,
                "display_name": " Friendly name ",
                "short_display_name": " Friendly ",
            }])
        )[0]

        self.assertEqual(named.display_name, "Friendly name")
        self.assertEqual(named.short_display_name, "Friendly")
        self.assertEqual(named.id, plain.id)
        for field in ("display_name", "short_display_name"):
            for invalid in ("", "   ", None, 1):
                with self.subTest(field=field, invalid=invalid):
                    with self.assertRaises(analysis.AnalysisError):
                        analysis.load_observations(
                            self.write_json([{**entry, field: invalid}])
                        )


class ExportTests(unittest.TestCase):
    def observations(self) -> tuple[analysis.ObservedRun, ...]:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "responses.json"
            path.write_text(
                json.dumps(
                    [
                        response("later", "2026-08-29T18:06:00+02:00", 1),
                        {
                            "vendor": "Example",
                            "model": "blocked",
                            "timestamp": "2026-08-29T18:05:30+02:00",
                            "anonymous": True,
                            "response_blocked": True,
                        },
                        response("first", "2026-08-29T18:05:00+02:00", 0),
                    ]
                ),
                encoding="utf-8",
            )
            return analysis.load_observations(path)

    def test_export_has_contract_order_ranks_and_similarities(self) -> None:
        export = analysis.build_export(self.observations(), PARTIES, THESES)
        self.assertEqual(export["schema_version"], 1)
        self.assertEqual(export["election"], {
            "name": "Abgeordnetenhauswahl Berlin 2026",
            "thesis_count": 38,
            "party_count": 3,
        })
        self.assertEqual(export["summary"], {
            "observation_count": 3,
            "complete_count": 2,
            "blocked_count": 1,
        })
        runs = export["runs"]
        self.assertEqual([run["model"] for run in runs], ["first", "blocked", "later"])
        self.assertEqual(runs[0]["observed_at"], "2026-08-29T16:05:00Z")
        self.assertNotIn("answers", runs[1])
        self.assertNotIn("agreements", runs[1])
        self.assertEqual(runs[0]["agreements"], [
            {"party": "Alpha", "percentage": 100, "rank": 1},
            {"party": "Beta", "percentage": 50, "rank": 2},
            {"party": "Gamma", "percentage": 50, "rank": 2},
        ])
        self.assertEqual(len(export["thesis_summary"]), 38)
        self.assertEqual(export["theses"][0], {"number": 1, "text": "These 1"})
        self.assertEqual(export["thesis_summary"][0], {
            "number": 1,
            "agree": 1,
            "neutral": 1,
            "disagree": 0,
        })
        self.assertEqual(len(export["similarities"]), 1)
        self.assertEqual(export["similarities"][0]["percentage"], 50)

    def test_source_digest_covers_party_positions(self) -> None:
        observations = self.observations()
        changed_parties = (wahlomat.Party("Alpha", (1,) * 38),) + PARTIES[1:]
        self.assertNotEqual(
            analysis.source_digest(observations, PARTIES, THESES),
            analysis.source_digest(observations, changed_parties, THESES),
        )

    def test_display_names_are_exported_and_change_source_digest_only(self) -> None:
        entry = response("technical-name", "2026-08-29T18:05:00+02:00")
        plain_path = ObservationValidationTests.write_json(self, [entry])
        named_path = ObservationValidationTests.write_json(
            self, [{
                **entry,
                "display_name": "Friendly name",
                "short_display_name": "Friendly",
            }]
        )
        plain = analysis.load_observations(plain_path)
        named = analysis.load_observations(named_path)

        export = analysis.build_export(named, PARTIES, THESES)
        self.assertEqual(export["runs"][0]["display_name"], "Friendly name")
        self.assertEqual(export["runs"][0]["short_display_name"], "Friendly")
        self.assertEqual(plain[0].id, named[0].id)
        self.assertNotEqual(
            analysis.source_digest(plain, PARTIES, THESES),
            analysis.source_digest(named, PARTIES, THESES),
        )

    def test_source_digest_covers_thesis_text(self) -> None:
        changed_theses = (wahlomat.Thesis(1, "Geändert"),) + THESES[1:]
        self.assertNotEqual(
            analysis.source_digest(self.observations(), PARTIES, THESES),
            analysis.source_digest(self.observations(), PARTIES, changed_theses),
        )

    def test_repository_export_contains_all_observations(self) -> None:
        observations = analysis.load_observations(export_site_data.DEFAULT_INPUT)
        export = analysis.build_export(observations, PARTIES, THESES)

        self.assertEqual(export["summary"], {
            "observation_count": 28,
            "complete_count": 24,
            "blocked_count": 4,
        })

    def test_atomic_write_and_export_wrapper_are_byte_identical(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            input_path = base / "responses.json"
            input_path.write_text(json.dumps([response("only", "2026-08-29T18:05:00+02:00")]), encoding="utf-8")
            output_path = base / "nested" / "results.json"
            with (
                patch("export_site_data.wahlomat.load_parties", return_value=PARTIES),
                patch("export_site_data.wahlomat.load_theses", return_value=THESES),
            ):
                export_site_data.export_site_data(input_path, base / "source.xlsx", output_path)
                first = output_path.read_bytes()
                export_site_data.export_site_data(input_path, base / "source.xlsx", output_path)
            self.assertEqual(output_path.read_bytes(), first)
            self.assertEqual(json.loads(first)["parties"], ["Alpha", "Beta", "Gamma"])
            self.assertFalse(list(output_path.parent.glob(".results.json.*")))


if __name__ == "__main__":
    unittest.main()
