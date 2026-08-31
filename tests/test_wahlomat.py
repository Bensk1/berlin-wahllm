import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import wahlomat


class AnswerTests(unittest.TestCase):
    def test_accepts_exactly_38_valid_answers(self) -> None:
        answers = wahlomat.parse_answers(",".join(["-1", "0", "1"] * 12 + ["0", "1"]))
        self.assertEqual(len(answers), 38)

    def test_rejects_wrong_length_and_invalid_values(self) -> None:
        for value in ("0" * 38, ",".join(["0"] * 37), ",".join(["0"] * 39), ",".join(["0"] * 37 + [""])):
            with self.subTest(value=value):
                with self.assertRaises(wahlomat.WahlomatError):
                    wahlomat.parse_answers(value)

    def test_accepts_whitespace_around_values(self) -> None:
        answers = wahlomat.parse_answers(" , ".join([" 0 "] * 38))
        self.assertEqual(answers, (0,) * 38)


class CalculationTests(unittest.TestCase):
    def party(self, name: str, positions: tuple[int, ...]) -> wahlomat.Party:
        return wahlomat.Party(name, positions)

    def test_identical_and_opposite_positions(self) -> None:
        answers = (1,) * 38
        results = wahlomat.calculate_results(
            answers,
            [self.party("gleich", answers), self.party("entgegengesetzt", (-1,) * 38)],
        )
        self.assertEqual(results[0].agreement, 100)
        self.assertEqual(results[1].agreement, 0)

    def test_neutral_position_has_distance_one(self) -> None:
        result = wahlomat.calculate_results((1,) + (0,) * 37, [self.party("x", (0,) * 38)])[0]
        self.assertEqual(result.distance, 1)
        self.assertEqual(str(result.agreement), "98.68421052631578947368421053")

    def test_ties_keep_dataset_order_and_round_half_up(self) -> None:
        parties = [self.party("zuerst", (0,) * 38), self.party("danach", (0,) * 38)]
        results = wahlomat.calculate_results((0,) * 38, parties)
        self.assertEqual([result.party.name for result in results], ["zuerst", "danach"])
        self.assertEqual(wahlomat.format_results([results[0]]), "1. zuerst: 100,0 %")


class DatasetTests(unittest.TestCase):
    def test_prompt_contains_exactly_the_numbered_theses(self) -> None:
        theses = wahlomat.load_theses()
        self.assertEqual(len(theses), 38)
        self.assertEqual(theses[0].number, 1)
        self.assertTrue(theses[0].text.startswith("Das Land Berlin"))

    @unittest.skipUnless(
        os.environ.get("WAHLOMAT_RUN_LOCAL_INTEGRATION") == "1",
        "benötigt den lokalen, nicht versionierten Wahl-O-Mat-Datensatz",
    )
    def test_real_dataset_has_expected_shape(self) -> None:
        parties = wahlomat.load_parties()
        self.assertEqual(len(parties), 17)
        self.assertTrue(all(len(party.positions) == 38 for party in parties))
        self.assertTrue(all(position in {-1, 0, 1} for party in parties for position in party.positions))

    def test_dataset_thesis_mismatch_is_rejected(self) -> None:
        rows = [
            ["Partei: Nr.", "Partei: Kurzbezeichnung", "Partei: Name", "These: Nr.", "These: Titel", "These: These", "Position: Position", "Position: Begründung"],
        ]
        rows.extend([["1", f"P{i}", "", str(number), "", "falsch", "Stimme zu", ""] for i in range(17) for number in range(1, 39)])
        with patch("wahlomat._read_dataset_rows", return_value=rows):
            with self.assertRaisesRegex(wahlomat.WahlomatError, "stimmt nicht"):
                wahlomat.load_parties(
                    theses=tuple(wahlomat.Thesis(number, "korrekt") for number in range(1, 39))
                )

    def test_dataset_internal_thesis_mismatch_is_rejected_without_theses_file(self) -> None:
        rows = [
            ["Partei: Nr.", "Partei: Kurzbezeichnung", "Partei: Name", "These: Nr.", "These: Titel", "These: These", "Position: Position", "Position: Begründung"],
        ]
        rows.extend(
            ["1", f"P{i}", "", str(number), "", "abweichend" if i == 1 and number == 1 else "gleich", "Stimme zu", ""]
            for i in range(17)
            for number in range(1, 39)
        )
        with patch("wahlomat._read_dataset_rows", return_value=rows):
            with self.assertRaisesRegex(wahlomat.WahlomatError, "nicht konsistent"):
                wahlomat.load_parties()

    def test_party_selection_is_case_insensitive_and_keeps_dataset_order(self) -> None:
        parties = tuple(wahlomat.Party(name, (0,) * 38) for name in ("SPD", "CDU", "Die Linke"))
        selected = wahlomat.select_parties(parties, " die linke, spd ")
        self.assertEqual([party.name for party in selected], ["SPD", "Die Linke"])

    def test_party_selection_rejects_unknown_and_empty_names(self) -> None:
        parties = (wahlomat.Party("SPD", (0,) * 38),)
        for subset in ("", "SPD,", "unbekannt"):
            with self.subTest(subset=subset):
                with self.assertRaises(wahlomat.WahlomatError):
                    wahlomat.select_parties(parties, subset)


if __name__ == "__main__":
    unittest.main()
