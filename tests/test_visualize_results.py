import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import visualize_results
import wahlomat


class ResponseLoadingTests(unittest.TestCase):
    def write_json(self, data: object) -> Path:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / "results.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    def test_load_responses_skips_blocked_entries(self) -> None:
        answers = ",".join(["0"] * 38)
        path = self.write_json([
            {"vendor": "openAI", "model": "test", "timestamp": "2026-01-01T10:00:00+01:00", "anonymous": True, "response": answers},
            {"vendor": "anthropic", "model": "blocked", "timestamp": "2026-01-01T10:00:00+01:00", "anonymous": False, "response_blocked": True},
        ])
        responses = visualize_results.load_responses(path)
        self.assertEqual([response.model for response in responses], ["test"])

    def test_load_responses_rejects_malformed_answers(self) -> None:
        path = self.write_json([
            {"vendor": "openAI", "model": "test", "timestamp": "2026-01-01T10:00:00+01:00", "anonymous": True, "response": "0,1"},
        ])
        with self.assertRaisesRegex(visualize_results.VisualizationError, "Ungültige Antwort"):
            visualize_results.load_responses(path)


class SvgRenderingTests(unittest.TestCase):
    def test_render_svg_contains_models_scores_and_party_names(self) -> None:
        parties = (
            wahlomat.Party("Alpha", (0,) * 38),
            wahlomat.Party("Beta", (1,) * 38),
        )
        response = visualize_results.ModelResponse("openAI", "Example", "2026-01-01T00:00:00Z", (0,) * 38)
        results = visualize_results.calculate_model_results((response,), parties)
        svg = visualize_results.render_svg(results, parties)
        self.assertIn("openAI · Example", svg)
        self.assertIn("Alpha", svg)
        self.assertIn("100.0%", svg)
        self.assertIn('fill="#1e9b83"', svg)
        self.assertIn("Anbieter bzw. Modellfamilie", svg)

    def test_render_svg_attributes_grok_output(self) -> None:
        parties = (wahlomat.Party("Alpha", (0,) * 38),)
        response = visualize_results.ModelResponse(
            "xAI", "Grok-4.5_fast", "2026-01-01T00:00:00Z", (0,) * 38
        )
        results = visualize_results.calculate_model_results((response,), parties)

        svg = visualize_results.render_svg(results, parties)

        self.assertIn("Created with Grok", svg)

    def test_render_svg_does_not_repeat_model_family(self) -> None:
        parties = (wahlomat.Party("Alpha", (0,) * 38),)
        response = visualize_results.ModelResponse(
            "GLM", "GLM-5.3-Flash", "2026-01-01T00:00:00Z", (0,) * 38
        )
        results = visualize_results.calculate_model_results((response,), parties)

        svg = visualize_results.render_svg(results, parties)

        self.assertIn(">GLM-5.3-Flash</text>", svg)
        self.assertNotIn("GLM · GLM-5.3-Flash", svg)


class FigureWritingTests(unittest.TestCase):
    def test_write_figure_limits_parties_to_subset(self) -> None:
        answers = ",".join(["0"] * 38)
        response_data = [{"vendor": "openAI", "model": "test", "timestamp": "2026-01-01T10:00:00+01:00", "anonymous": True, "response": answers}]
        parties = (
            wahlomat.Party("Alpha", (0,) * 38),
            wahlomat.Party("Beta", (1,) * 38),
        )
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "results.json"
            output_path = Path(directory) / "figure.svg"
            input_path.write_text(json.dumps(response_data), encoding="utf-8")
            with patch("visualize_results.wahlomat.load_parties", return_value=parties):
                visualize_results.write_figure(input_path, output_path, "beta")
            svg = output_path.read_text(encoding="utf-8")
        self.assertIn("Beta", svg)
        self.assertNotIn("Alpha", svg)


if __name__ == "__main__":
    unittest.main()
