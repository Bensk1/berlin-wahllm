import {runLabel} from "./lib.js";

export const focusParties = ["CDU", "SPD", "GRÜNE", "Die Linke", "AfD"];

const partyLabels = new Map([["GRÜNE", "Grüne"]]);
const modelCollator = new Intl.Collator("de", {numeric: true, sensitivity: "base"});
const partyCollator = new Intl.Collator("de", {sensitivity: "base"});

export function partyLabel(party) {
  return partyLabels.get(party) || party;
}

export function sortParties(parties) {
  return [...parties].sort((left, right) => partyCollator.compare(partyLabel(left), partyLabel(right)) || left.localeCompare(right));
}

export function selectFocusModels(models) {
  if (models.length !== 8 || new Set(models.map((model) => model.id)).size !== 8) {
    throw new Error("Der Website-Export muss acht eindeutige Modelle enthalten.");
  }
  return [...models].sort((left, right) => modelCollator.compare(runLabel(left), runLabel(right)) || left.id.localeCompare(right.id));
}

export function partiesForMode(allParties, mode) {
  if (mode === "all") return [...allParties];
  const available = new Set(allParties);
  const missing = focusParties.filter((party) => !available.has(party));
  if (missing.length) throw new Error(`Fokusparteien fehlen: ${missing.join(", ")}.`);
  return [...focusParties];
}

export function winners(model, parties) {
  const visible = new Set(parties);
  const agreements = model.agreements.filter((agreement) => visible.has(agreement.party));
  if (!agreements.length) return [];
  const highest = Math.max(...agreements.map((agreement) => agreement.mean));
  return agreements.filter((agreement) => agreement.mean === highest);
}

export function firstPlaceCount(model, party, parties) {
  const visible = new Set(parties);
  return model.runs.reduce((count, run) => {
    const agreements = run.agreements.filter((agreement) => visible.has(agreement.party));
    const highest = Math.max(...agreements.map((agreement) => agreement.percentage));
    return count + Number(agreements.some((agreement) => agreement.party === party && agreement.percentage === highest));
  }, 0);
}

export function heatmapValues(models, parties) {
  const visible = new Set(parties);
  return models.flatMap((model) => model.agreements
    .filter((agreement) => visible.has(agreement.party))
    .map((agreement) => ({
      modelId: model.id,
      model,
      party: agreement.party,
      percentage: agreement.mean,
      rank: agreement.rank
    })));
}
