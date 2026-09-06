import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  firstPlaceCount,
  focusParties,
  heatmapValues,
  partiesForMode,
  selectFocusModels,
  sortParties,
  winners
} from "../src/components/focus.js";
import {formatDate, percent, runLabel} from "../src/components/lib.js";
import {comparisonRunIds} from "../src/components/model-ranking.js";
import {matrixValues, thesisCard} from "../src/components/response-matrix.js";
import {translations} from "../src/components/i18n.js";
import {validateResults} from "../src/components/schema.js";
import siteConfig, {normalizeBasePath, normalizeSiteUrl} from "../observablehq.config.js";

const allParties = ["SPD", "GRÜNE", "CDU", "AfD", "FDP", "Die Linke", "Volt"];
const model = (name, agreements = [], id = `id-${name}`) => ({id, model: name, agreements, runs: []});
const repositoryResults = JSON.parse(
  await readFile(new URL("../src/data/results.json", import.meta.url), "utf8")
);

test("Website-Export enthält die acht kontrollierten Modellkonfigurationen", () => {
  assert.equal(validateResults(repositoryResults), repositoryResults);
  assert.equal(repositoryResults.schema_version, 2);
  assert.equal(repositoryResults.models.length, 8);
  assert.equal(repositoryResults.summary.evaluable_run_count, 120);
  assert.deepEqual(focusParties, ["CDU", "SPD", "GRÜNE", "Die Linke", "AfD"]);
});

test("Modelle werden nach sichtbaren Namen sortiert", () => {
  assert.deepEqual(selectFocusModels(repositoryResults.models).map(runLabel), [
    "Gemini 3.5 Flash-Lite", "Gemma 4 26B", "GLM 5.3 Flash", "GPT-5.6 Terra",
    "Grok 4.5", "Kimi K3", "Mistral Medium 3.5", "Sonnet 4.6"
  ]);
});

test("Fünferauswahl bildet die ausgewiesene Kernaussage ab", () => {
  const winnerByModel = new Map(repositoryResults.models.map((candidate) => [
    candidate.short_display_name,
    winners(candidate, focusParties).map(({party}) => party)
  ]));
  assert.deepEqual(winnerByModel.get("Grok 4.5"), ["AfD"]);
  assert.equal([...winnerByModel.entries()].filter(([name]) => name !== "Grok 4.5").every(([, parties]) =>
    parties.every((party) => party === "GRÜNE" || party === "Die Linke")
  ), true);
});

test("Kurzbezeichnungen haben vor vollständigen Anzeigenamen Vorrang", () => {
  assert.equal(runLabel({model: "technical-name", display_name: "Vollständiger Name", short_display_name: "Kurzname"}), "Kurzname");
});

test("Vergleichsauswahl bleibt eindeutig, begrenzt und entfernt das Hauptmodell", () => {
  assert.deepEqual(comparisonRunIds(["b", "a", "b", "main", "c"], "main"), ["b", "a", "c"]);
  assert.deepEqual(comparisonRunIds(["b", "a"], "b"), ["a"]);
  assert.deepEqual(comparisonRunIds(["a", "b", "c", "d"], "none"), ["a", "b", "c"]);
});

test("selectFocusModels lehnt eine falsche Zahl und doppelte IDs ab", () => {
  const models = Array.from({length: 8}, (_, index) => model(`model-${index}`));
  assert.throws(() => selectFocusModels(models.slice(1)), /acht eindeutige Modelle/);
  assert.throws(() => selectFocusModels([{...models[0]}, {...models[0]}, ...models.slice(2)]), /acht eindeutige Modelle/);
});

test("Parteienmodus startet mit Fokusreihenfolge und kann alle Parteien zeigen", () => {
  assert.deepEqual(partiesForMode(allParties, "focus"), focusParties);
  assert.deepEqual(partiesForMode(allParties, "all"), allParties);
});

test("Heatmap-Parteien werden nach ihren sichtbaren deutschen Namen sortiert", () => {
  assert.deepEqual(sortParties(focusParties), ["AfD", "CDU", "Die Linke", "GRÜNE", "SPD"]);
  assert.deepEqual(focusParties, ["CDU", "SPD", "GRÜNE", "Die Linke", "AfD"]);
});

test("Gewinnerermittlung erhält echte Gleichstände", () => {
  const candidate = model("example", [
    {party: "CDU", mean: 70},
    {party: "SPD", mean: 75},
    {party: "GRÜNE", mean: 75},
    {party: "Volt", mean: 90}
  ]);
  assert.deepEqual(winners(candidate, focusParties).map(({party}) => party), ["SPD", "GRÜNE"]);
  assert.deepEqual(winners(candidate, allParties).map(({party}) => party), ["Volt"]);
});

test("Heatmap-Daten besitzen einen direkten modelId-Kanal", () => {
  const candidate = model("example", [{party: "CDU", mean: 70, rank: 1}]);
  assert.deepEqual(heatmapValues([candidate], ["CDU"]), [{
    modelId: candidate.id,
    model: candidate,
    party: "CDU",
    percentage: 70,
    rank: 1
  }]);
});

test("Erstplatzierungen werden für den sichtbaren Parteienmodus berechnet", () => {
  const candidate = {...model("example"), runs: [
    {agreements: [{party: "SPD", percentage: 80}, {party: "GRÜNE", percentage: 80}, {party: "Volt", percentage: 90}]},
    {agreements: [{party: "SPD", percentage: 70}, {party: "GRÜNE", percentage: 75}, {party: "Volt", percentage: 60}]}
  ]};
  assert.equal(firstPlaceCount(candidate, "SPD", ["SPD", "GRÜNE"]), 1);
  assert.equal(firstPlaceCount(candidate, "GRÜNE", ["SPD", "GRÜNE"]), 2);
  assert.equal(firstPlaceCount(candidate, "Volt", allParties), 1);
});

test("Matrixdaten verbinden jede Antwort mit dem vollständigen Thesentext", () => {
  const candidate = {...model("example"), display_name: "Example", short_display_name: "Kurz", evaluable_run_count: 15, thesis_answers: [
    {agree: 12, neutral: 2, disagree: 1, modal_answers: [1], modal_count: 12},
    {agree: 5, neutral: 5, disagree: 5, modal_answers: [-1, 0, 1], modal_count: 5}
  ]};
  const values = matrixValues([candidate], [
    {number: 1, text: "Erste These."},
    {number: 2, text: "Zweite These."}
  ]);
  assert.deepEqual(values.map(({thesis, thesisText, label, consensus}) => ({thesis, thesisText, label, consensus})), [
    {thesis: 1, thesisText: "Erste These.", label: "Zustimmung", consensus: 0.8},
    {thesis: 2, thesisText: "Zweite These.", label: "Uneindeutig", consensus: 1 / 3}
  ]);
});

test("englische UI-Texte und Formate werden lokalisiert", () => {
  assert.deepEqual(Object.keys(translations.en).sort(), Object.keys(translations.de).sort());
  assert.equal(translations.de.providerDefault, "Standard (0 nicht konfigurierbar)");
  assert.equal(translations.en.providerDefault, "default (0 not configurable)");
  assert.equal(percent(12.5, "en"), "12.5 %");
  assert.equal(percent(12.5, "de"), "12,5 %");
  assert.match(formatDate("2026-01-02T10:30:00Z", "en"), /2 Jan 2026/);
  assert.match(formatDate("2026-01-02T10:30:00Z", "de"), /02\.01\.2026|2\. Jan\. 2026/);
  const values = matrixValues([{...model("example"), evaluable_run_count: 15, thesis_answers: [
    {agree: 15, neutral: 0, disagree: 0, modal_answers: [1], modal_count: 15},
    {agree: 0, neutral: 15, disagree: 0, modal_answers: [0], modal_count: 15},
    {agree: 0, neutral: 0, disagree: 15, modal_answers: [-1], modal_count: 15}
  ]}], [
    {number: 1, text: "Deutsche Quellthese."}, {number: 2, text: "Zweite."}, {number: 3, text: "Dritte."}
  ], "en");
  assert.deepEqual(values.map(({label, thesisText}) => ({label, thesisText})), [
    {label: "Agree", thesisText: "Deutsche Quellthese."},
    {label: "Neutral", thesisText: "Zweite."},
    {label: "Disagree", thesisText: "Dritte."}
  ]);
});

test("beide Sprachseiten und die Hreflang-Metadaten sind konfiguriert", async () => {
  const englishPage = await readFile(new URL("../src/en/index.md", import.meta.url), "utf8");
  const germanHead = siteConfig.head({path: "/index"});
  const englishHead = siteConfig.head({path: "/en/index"});
  assert.match(englishPage, /locale: "en"/);
  assert.match(englishPage, /The thesis texts are reproduced as the original German source material\./);
  assert.ok(siteConfig.pages.some(({path}) => path === "/en/"));
  assert.equal(siteConfig.base, "/");
  assert.match(germanHead, /canonical" href="https:\/\/wahl\.ksmn\.dev\/"/);
  assert.match(englishHead, /canonical" href="https:\/\/wahl\.ksmn\.dev\/en\/"/);
  assert.match(englishHead, /hreflang="de"/);
  assert.match(englishHead, /hreflang="en"/);
  assert.match(germanHead, /og:image[^>]+berlin-wahllm-preview\.png/);
  assert.match(germanHead, /og:image:width" content="1200"/);
  assert.match(germanHead, /og:image:height" content="630"/);
  assert.match(germanHead, /twitter:card" content="summary_large_image"/);
  assert.match(germanHead, /og:image" content="https:\/\/wahl\.ksmn\.dev\/berlin-wahllm-preview\.png"/);
});

test("Hosting-Buildparameter werden an der Konfigurationsgrenze validiert", () => {
  assert.equal(normalizeBasePath("/berlin-wahllm/"), "/berlin-wahllm/");
  assert.equal(normalizeSiteUrl("https://example.org/project/"), "https://example.org/project");
  assert.throws(() => normalizeBasePath("berlin-wahllm"), /WAHLLM_BASE_PATH/);
  assert.throws(() => normalizeBasePath("//example/"), /WAHLLM_BASE_PATH/);
  assert.throws(() => normalizeSiteUrl("not-a-url"), /WAHLLM_SITE_URL/);
  assert.throws(() => normalizeSiteUrl("http://example.org"), /WAHLLM_SITE_URL/);
  assert.throws(() => normalizeSiteUrl("https://user:secret@example.org"), /WAHLLM_SITE_URL/);
  assert.throws(() => normalizeSiteUrl("https://example.org/?preview=1"), /WAHLLM_SITE_URL/);
});

test("Thesenkarte kann mit der Übersetzungsfunktion gerendert werden", () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => ({
      tagName,
      children: [],
      append(...children) { this.children.push(...children); },
      setAttribute(name, value) { this[name] = value; },
      addEventListener() {}
    })
  };
  try {
    const {card} = thesisCard([{number: 1, text: "Deutscher Quellentext."}], "en");
    assert.equal(card["aria-label"], "Selected thesis");
    assert.equal(card.children[1].textContent, "Thesis 1 of 1");
    assert.equal(card.children[2].textContent, "Deutscher Quellentext.");
  } finally {
    globalThis.document = originalDocument;
  }
});
