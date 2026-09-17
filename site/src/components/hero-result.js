import {focusParties, partyLabel, winners} from "./focus.js";
import {percent, runLabel} from "./lib.js";

const copy = {
  de: {
    eyebrow: "Ergebnis auf einen Blick",
    models: "Modelle",
    focusFindingDetail: "Modelle: Grüne oder Linke.",
    exception: "Ausnahme",
    repetitions: "Mittelwert aus 15 Wiederholungen",
    download: "Grafik als hochauflösende PNG herunterladen",
    note: (partyCount) => `Je Modell ist die höchste mittlere Übereinstimmung innerhalb der aktuell ausgewählten ${partyCount} Parteien dargestellt.`
  },
  en: {
    eyebrow: "The result at a glance",
    models: "models",
    focusFindingDetail: "models: Greens or The Left.",
    exception: "Exception",
    repetitions: "Mean across 15 repetitions",
    download: "Download high-resolution PNG",
    note: (partyCount) => `For each model, the chart shows the highest mean agreement among the ${partyCount} parties currently selected.`
  }
};

const heroModelPriority = new Map([
  ["google/gemini-3.5-flash-lite", 0],
  ["openai/gpt-5.6-terra", 1],
  ["anthropic/claude-sonnet-4.6", 2],
  ["x-ai/grok-4.5", 3]
]);
const modelCollator = new Intl.Collator("de", {numeric: true, sensitivity: "base"});

function isFocusSelection(parties) {
  return parties.length === focusParties.length && focusParties.every((party) => parties.includes(party));
}

function localizedPartyLabel(party, locale) {
  if (locale !== "en") return party;
  return new Map([["Grüne", "Greens"], ["Die Linke", "The Left"]]).get(party) ?? party;
}

function cardPartyLabel(party, locale) {
  if (party === "Tierschutzpartei") return "Tierschutzp.";
  return localizedPartyLabel(party, locale);
}

function cardPartyClass(party) {
  return new Map([
    ["Die Linke", " hero-result-card-left"],
    ["Tierschutzpartei", " hero-result-card-tierschutz"],
    ["FDP", " hero-result-card-fdp"]
  ]).get(party) ?? "";
}

export function heroResultSummary(results, parties, locale = "de") {
  const ui = copy[locale] ?? copy.de;
  if (isFocusSelection(parties)) {
    const count = results.filter(({party}) => party === "Grüne" || party === "Die Linke").length;
    return {finding: `${count} ${locale === "en" ? "of" : "von"} ${results.length}`, detail: ui.focusFindingDetail};
  }

  const counts = new Map();
  for (const {party} of results) counts.set(party, (counts.get(party) ?? 0) + 1);
  const [party, count] = [...counts].sort((left, right) => right[1] - left[1] || modelCollator.compare(left[0], right[0]))[0];
  return {
    finding: `${count} ${locale === "en" ? "of" : "von"} ${results.length}`,
    detail: `${ui.models}: ${localizedPartyLabel(party, locale)}.`
  };
}

export function heroResultData(models, parties = focusParties) {
  const orderedModels = [...models].sort((left, right) =>
    (heroModelPriority.get(left.model) ?? Number.MAX_SAFE_INTEGER)
      - (heroModelPriority.get(right.model) ?? Number.MAX_SAFE_INTEGER)
      || modelCollator.compare(runLabel(left), runLabel(right))
      || left.id.localeCompare(right.id)
  );
  return orderedModels.map((model) => {
    const leadingAgreements = winners(model, parties);
    if (leadingAgreements.length !== 1) {
      throw new Error(`Die Ergebnisgrafik benötigt einen eindeutigen Spitzenwert für ${runLabel(model)}.`);
    }
    return {
      model: runLabel(model),
      party: partyLabel(leadingAgreements[0].party),
      value: leadingAgreements[0].mean,
      exception: isFocusSelection(parties) && leadingAgreements[0].party === "AfD"
    };
  });
}

export function heroResult({models, parties = focusParties, downloadUrl, locale = "de"}) {
  const ui = copy[locale] ?? copy.de;
  const results = heroResultData(models, parties);
  const summaryResult = heroResultSummary(results, parties, locale);
  const figure = document.createElement("figure");
  figure.className = "hero-result";
  figure.setAttribute("aria-label", `${summaryResult.finding} ${summaryResult.detail}`);

  const summary = document.createElement("div");
  summary.className = "hero-result-summary";
  summary.innerHTML = `
    <p class="hero-result-eyebrow">${ui.eyebrow}</p>
    <p class="hero-result-finding"><strong>${summaryResult.finding}</strong><span>${summaryResult.detail}</span></p>
    <p class="hero-result-repetitions">${ui.repetitions}</p>
  `;

  const grid = document.createElement("div");
  grid.className = "hero-result-grid";
  for (const result of results) {
    const card = document.createElement("div");
    const partyClass = cardPartyClass(result.party);
    card.className = `hero-result-card${partyClass}${result.exception ? " hero-result-card-exception" : ""}`;
    const modelName = document.createElement("span");
    modelName.className = "hero-result-model";
    modelName.textContent = result.model;
    const resultLine = document.createElement("span");
    resultLine.className = "hero-result-party";
    const displayedParty = cardPartyLabel(result.party, locale);
    const partyName = document.createElement("span");
    partyName.textContent = displayedParty;
    const value = document.createElement("span");
    value.className = "hero-result-value";
    value.textContent = ` ${percent(result.value, locale)}`;
    resultLine.append(partyName, value);
    card.append(modelName, resultLine);
    if (result.exception) {
      const exception = document.createElement("span");
      exception.className = "hero-result-exception";
      exception.textContent = ui.exception;
      card.append(exception);
    }
    grid.append(card);
  }

  const caption = document.createElement("figcaption");
  caption.className = "hero-result-caption";
  const note = document.createElement("span");
  note.textContent = ui.note(parties.length);
  caption.append(note);
  if (downloadUrl) {
    const download = document.createElement("a");
    download.className = "hero-result-download";
    download.href = downloadUrl;
    download.download = locale === "en" ? "berlin-wahllm-result-en.png" : "berlin-wahllm-ergebnis.png";
    download.textContent = ui.download;
    caption.append(download);
  }

  figure.append(summary, grid, caption);
  return figure;
}
