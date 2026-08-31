import {runLabel} from "./lib.js";

export const focusRunIds = [
  "run-1e590181a9419f7daa83ccb6",
  "run-b409007d1454ffc9b75ba635",
  "run-e9342fbd48b66ccefc75f222",
  "run-97948da3bac10a380c22aaed",
  "run-7f90a32468860e822b7ab43b",
  "run-f337233ece2803bca885a357",
  "run-b9557d5f9656ae7dd0e80509",
  "run-c313a2da2e588fa102da589b"
];

export const focusParties = ["CDU", "FDP", "AfD", "SPD", "Die Linke", "GRÜNE"];

const partyLabels = new Map([["GRÜNE", "Grüne"]]);
const modelCollator = new Intl.Collator("de", {numeric: true, sensitivity: "base"});
const partyCollator = new Intl.Collator("de", {sensitivity: "base"});

export function partyLabel(party) {
  return partyLabels.get(party) || party;
}

export function sortParties(parties) {
  return [...parties].sort((left, right) => partyCollator.compare(partyLabel(left), partyLabel(right)) || left.localeCompare(right));
}

export function selectFocusRuns(runs) {
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const selectedRuns = focusRunIds.map((id) => {
    const run = runsById.get(id);
    if (!run || run.status !== "complete") {
      throw new Error(`Vollständiger Fokuslauf fehlt: ${id}.`);
    }
    return run;
  });
  return selectedRuns.sort((left, right) => modelCollator.compare(runLabel(left), runLabel(right)) || left.id.localeCompare(right.id));
}

export function partiesForMode(allParties, mode) {
  if (mode === "all") return [...allParties];
  const available = new Set(allParties);
  const missing = focusParties.filter((party) => !available.has(party));
  if (missing.length) throw new Error(`Fokusparteien fehlen: ${missing.join(", ")}.`);
  return [...focusParties];
}

export function winners(run, parties) {
  const visible = new Set(parties);
  const agreements = run.agreements.filter((agreement) => visible.has(agreement.party));
  if (!agreements.length) return [];
  const highest = Math.max(...agreements.map((agreement) => agreement.percentage));
  return agreements.filter((agreement) => agreement.percentage === highest);
}

export function heatmapValues(runs, parties) {
  const visible = new Set(parties);
  return runs.flatMap((run) => run.agreements
    .filter((agreement) => visible.has(agreement.party))
    .map((agreement) => ({
      runId: run.id,
      run,
      party: agreement.party,
      percentage: agreement.percentage,
      rank: agreement.rank
    })));
}
