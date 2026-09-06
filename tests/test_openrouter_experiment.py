import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import run_openrouter_experiment as experiment


class OpenRouterExperimentTests(unittest.TestCase):
    config = experiment.MODEL_CONFIGS["grok-4.5"]

    def test_manifest_is_stable_except_for_creation_time(self) -> None:
        first = experiment.experiment_manifest("prompt", self.config)
        second = experiment.experiment_manifest("prompt", self.config)
        self.assertEqual(first["experiment_id"], second["experiment_id"])
        self.assertEqual(first["settings"], second["settings"])

    def test_request_is_stateless_and_privacy_restricted(self) -> None:
        payload = experiment.request_payload("prompt", self.config)
        self.assertEqual(payload["messages"], [{"role": "user", "content": "prompt"}])
        self.assertEqual(payload["temperature"], 0)
        self.assertEqual(payload["reasoning"]["effort"], "high")
        self.assertEqual(payload["provider"]["only"], ["xai/priority"])
        self.assertTrue(payload["provider"]["zdr"])
        self.assertFalse(payload["provider"]["allow_fallbacks"])

    def test_valid_response_is_normalized(self) -> None:
        raw = ",".join(["1"] + ["0"] * 37)
        run = experiment.parse_run(
            {
                "id": "generation-1",
                "model": "x-ai/grok-4.5-20260708",
                "provider": "xAI",
                "choices": [{"message": {"content": raw}}],
                "usage": {"prompt_tokens": 100, "completion_tokens": 20, "cost": 0.01},
            },
            1,
            123,
            self.config,
        )
        self.assertEqual(run["status"], "complete_exact")
        self.assertEqual(run["answers"], [1] + [0] * 37)
        self.assertEqual(run["replicate"], 1)

    def test_existing_manifest_must_match(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "experiment.json"
            path.write_text(json.dumps({"settings": {}, "runs": []}), encoding="utf-8")
            with self.assertRaises(experiment.ExperimentError):
                experiment.load_or_create(path, "prompt", self.config)

    def test_unsupported_controls_are_omitted_and_documented(self) -> None:
        config = experiment.MODEL_CONFIGS["gemma-4-26b"]
        payload = experiment.request_payload("prompt", config)
        manifest = experiment.experiment_manifest("prompt", config)
        self.assertNotIn("reasoning", payload)
        self.assertEqual(manifest["settings"]["requested_reasoning_effort"], "high")
        self.assertIsNone(manifest["settings"]["reasoning_effort"])

    def test_terra_uses_endpoint_token_limit_parameter(self) -> None:
        config = experiment.MODEL_CONFIGS["gpt-5.6-terra"]
        payload = experiment.request_payload("prompt", config)
        self.assertEqual(payload["max_completion_tokens"], 4096)
        self.assertNotIn("max_tokens", payload)

    def test_missing_model_text_is_recorded_as_blocked(self) -> None:
        run = experiment.parse_run(
            {"choices": [{"finish_reason": "length", "message": {"content": None}}]},
            1,
            123,
            self.config,
        )
        self.assertEqual(run["status"], "output_exhausted")

    def test_embedded_answer_sequence_is_valid_and_raw_text_is_preserved(self) -> None:
        answers = ", ".join(["1"] * 38)
        raw = f"Vorbemerkung.\n\n{answers}\n\nErklärung."
        run = experiment.parse_run(
            {"choices": [{"finish_reason": "stop", "message": {"content": raw}}]},
            1,
            123,
            self.config,
        )
        self.assertEqual(run["status"], "complete_extracted")
        self.assertEqual(run["answers"], [1] * 38)
        self.assertEqual(run["raw_response"], raw)

    def test_all_neutral_answer_is_not_evaluable(self) -> None:
        raw = ",".join(["0"] * 38)
        run = experiment.parse_run(
            {"choices": [{"finish_reason": "stop", "message": {"content": raw}}]},
            1,
            123,
            self.config,
        )
        self.assertEqual(run["status"], "neutral_only")
        self.assertNotIn(run["status"], experiment.EVALUABLE_STATUSES)


if __name__ == "__main__":
    unittest.main()
