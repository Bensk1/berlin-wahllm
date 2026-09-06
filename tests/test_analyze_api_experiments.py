import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import analyze_api_experiments as analysis
import wahlomat


class ApiExperimentAnalysisTests(unittest.TestCase):
    parties = (
        wahlomat.Party("gleich", (1,) * 38),
        wahlomat.Party("neutral", (0,) * 38),
    )

    def document(self) -> dict[str, object]:
        return {
            "experiment_id": "test",
            "settings": {
                "model_id": "test/model",
                "provider_endpoint": "test",
                "reasoning_effort": "high",
                "temperature": 0,
            },
            "runs": [
                {"replicate": 1, "status": "complete_exact", "answers": [1] * 38},
                {"replicate": 2, "status": "complete_extracted", "answers": [1] * 19 + [0] * 19},
                {"replicate": 3, "status": "neutral_only", "answers": [0] * 38},
                {"replicate": 4, "status": "refused"},
            ],
        }

    def test_summarizes_only_evaluable_runs(self) -> None:
        summary = analysis.summarize_experiment(self.document(), self.parties)
        self.assertEqual(summary["attempt_count"], 4)
        self.assertEqual(summary["evaluable_run_count"], 2)
        equal = next(row for row in summary["parties"] if row["party"] == "gleich")
        self.assertEqual(equal["mean"], 87.5)
        self.assertEqual(equal["median"], 87.5)
        self.assertEqual(equal["minimum"], 75.0)
        self.assertEqual(equal["maximum"], 100.0)
        self.assertEqual(summary["thesis_answers"][0], {
            "number": 1,
            "agree": 2,
            "neutral": 0,
            "disagree": 0,
            "modal_answers": [1],
            "modal_count": 2,
        })
        self.assertEqual(summary["runs"][0]["answers"], [1] * 38)

    def test_tied_winners_are_all_counted(self) -> None:
        document = self.document()
        tied_parties = (
            wahlomat.Party("positiv", (1,) * 38),
            wahlomat.Party("negativ", (-1,) * 38),
        )
        document["runs"] = [
            {"replicate": 1, "status": "complete_exact", "answers": [0] * 38}
        ]
        summary = analysis.summarize_experiment(document, tied_parties)
        counts = {row["party"]: row["first_place_count"] for row in summary["parties"]}
        self.assertEqual(counts, {"positiv": 1, "negativ": 1})

    def test_pairwise_stability(self) -> None:
        summary = analysis.summarize_experiment(self.document(), self.parties)
        self.assertEqual(summary["stability"], {
            "pair_count": 1,
            "mean": 75.0,
            "minimum": 75.0,
            "maximum": 75.0,
        })

    def test_csv_contains_all_party_rows(self) -> None:
        report = {"models": [analysis.summarize_experiment(self.document(), self.parties)]}
        csv_text = analysis.render_csv(report)
        self.assertEqual(len(csv_text.splitlines()), 3)
        self.assertIn("standard_deviation", csv_text.splitlines()[0])


if __name__ == "__main__":
    unittest.main()
