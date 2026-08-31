import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  focusParties,
  focusRunIds,
  heatmapValues,
  partiesForMode,
  selectFocusRuns,
  sortParties,
  winners
} from "../src/components/focus.js";
import {formatDate, percent, runLabel} from "../src/components/lib.js";
import {comparisonRunIds, vendorMetadataLabel} from "../src/components/model-ranking.js";
import {matrixValues, thesisCard} from "../src/components/response-matrix.js";
import {translations} from "../src/components/i18n.js";
import siteConfig, {normalizeBasePath, normalizeSiteUrl} from "../observablehq.config.js";

const allParties = ["SPD", "GRÜNE", "CDU", "AfD", "FDP", "Die Linke", "Volt"];
const run = (model, agreements = [], id = `id-${model}`) => ({id, model, status: "complete", agreements});
const repositoryResults = JSON.parse(
  await readFile(new URL("../src/data/results.json", import.meta.url), "utf8")
);

test("Fokusläufe entsprechen den ersten acht Quelldatensätzen", () => {
  assert.deepEqual(focusRunIds, [
    "run-1e590181a9419f7daa83ccb6",
    "run-b409007d1454ffc9b75ba635",
    "run-e9342fbd48b66ccefc75f222",
    "run-97948da3bac10a380c22aaed",
    "run-7f90a32468860e822b7ab43b",
    "run-f337233ece2803bca885a357",
    "run-b9557d5f9656ae7dd0e80509",
    "run-c313a2da2e588fa102da589b"
  ]);
  assert.deepEqual(focusParties, ["CDU", "FDP", "AfD", "SPD", "Die Linke", "GRÜNE"]);
});

test("Fokusläufe existieren vollständig im Repository-Export", () => {
  assert.deepEqual(
    selectFocusRuns(repositoryResults.runs).map(({id}) => id).sort(),
    [...focusRunIds].sort()
  );
});

test("Kurzbezeichnungen haben vor vollständigen Anzeigenamen Vorrang", () => {
  assert.equal(runLabel({model: "technical-name", display_name: "Vollständiger Name", short_display_name: "Kurzname"}), "Kurzname");
});

test("GLM wird als Modellfamilie statt als Anbieter bezeichnet", () => {
  assert.equal(vendorMetadataLabel("GLM"), "Modellfamilie");
  assert.equal(vendorMetadataLabel("OpenAI"), "Anbieter");
});

test("Vergleichsauswahl bleibt eindeutig, begrenzt und entfernt das Hauptmodell", () => {
  assert.deepEqual(comparisonRunIds(["b", "a", "b", "main", "c"], "main"), ["b", "a", "c"]);
  assert.deepEqual(comparisonRunIds(["b", "a"], "b"), ["a"]);
  assert.deepEqual(comparisonRunIds(["a", "b", "c", "d"], "none"), ["a", "b", "c"]);
});

test("selectFocusRuns verdrahtet konkrete Läufe und sortiert sichtbare Namen alphabetisch", () => {
  const labels = ["Grok 4.5", "Sonnet-4.6", "Gemini-3.5", "ChatGPT-5.6-Terra", "Gemma4:26b", "Vibe/Mistral", "GLM-5.3", "Kimi-K2.6"];
  const selected = focusRunIds.map((id, index) => ({...run(index < 2 ? "duplicate-name" : `model-${index}`, [], id), short_display_name: labels[index]}));
  const runs = [
    run("duplicate-name", [], "run-other-observation"),
    ...selected.toReversed(),
    {...run("blocked", [], "run-blocked"), status: "blocked"}
  ];
  assert.deepEqual(selectFocusRuns(runs).map(runLabel), ["ChatGPT-5.6-Terra", "Gemini-3.5", "Gemma4:26b", "GLM-5.3", "Grok 4.5", "Kimi-K2.6", "Sonnet-4.6", "Vibe/Mistral"]);
});

test("selectFocusRuns lehnt fehlende und blockierte Fokusläufe ab", () => {
  const selected = focusRunIds.map((id, index) => run(`model-${index}`, [], id));
  assert.throws(() => selectFocusRuns(selected.slice(1)), /Vollständiger Fokuslauf fehlt/);
  assert.throws(
    () => selectFocusRuns([{...selected[0], status: "blocked"}, ...selected.slice(1)]),
    /Vollständiger Fokuslauf fehlt/
  );
});

test("Parteienmodus startet mit Fokusreihenfolge und kann alle Parteien zeigen", () => {
  assert.deepEqual(partiesForMode(allParties, "focus"), focusParties);
  assert.deepEqual(partiesForMode(allParties, "all"), allParties);
});

test("Heatmap-Parteien werden nach ihren sichtbaren deutschen Namen sortiert", () => {
  assert.deepEqual(sortParties(focusParties), ["AfD", "CDU", "Die Linke", "FDP", "GRÜNE", "SPD"]);
  assert.deepEqual(focusParties, ["CDU", "FDP", "AfD", "SPD", "Die Linke", "GRÜNE"]);
});

test("Gewinnerermittlung erhält echte Gleichstände", () => {
  const candidate = run("example", [
    {party: "CDU", percentage: 70},
    {party: "SPD", percentage: 75},
    {party: "GRÜNE", percentage: 75},
    {party: "Volt", percentage: 90}
  ]);
  assert.deepEqual(winners(candidate, focusParties).map(({party}) => party), ["SPD", "GRÜNE"]);
  assert.deepEqual(winners(candidate, allParties).map(({party}) => party), ["Volt"]);
});

test("Heatmap-Daten besitzen einen direkten runId-Kanal", () => {
  const candidate = run("example", [{party: "CDU", percentage: 70, rank: 1}]);
  assert.deepEqual(heatmapValues([candidate], ["CDU"]), [{
    runId: candidate.id,
    run: candidate,
    party: "CDU",
    percentage: 70,
    rank: 1
  }]);
});

test("Matrixdaten verbinden jede Antwort mit dem vollständigen Thesentext", () => {
  const candidate = {...run("example"), display_name: "Example", short_display_name: "Kurz", answers: [1, -1]};
  const values = matrixValues([candidate], [
    {number: 1, text: "Erste These."},
    {number: 2, text: "Zweite These."}
  ]);
  assert.deepEqual(values.map(({thesis, thesisText, label}) => ({thesis, thesisText, label})), [
    {thesis: 1, thesisText: "Erste These.", label: "Zustimmung"},
    {thesis: 2, thesisText: "Zweite These.", label: "Ablehnung"}
  ]);
});

test("englische UI-Texte und Formate werden lokalisiert", () => {
  assert.deepEqual(Object.keys(translations.en).sort(), Object.keys(translations.de).sort());
  assert.equal(percent(12.5, "en"), "12.5 %");
  assert.equal(percent(12.5, "de"), "12,5 %");
  assert.match(formatDate("2026-01-02T10:30:00Z", "en"), /2 Jan 2026/);
  assert.match(formatDate("2026-01-02T10:30:00Z", "de"), /02\.01\.2026|2\. Jan\. 2026/);
  const values = matrixValues([{...run("example"), answers: [1, 0, -1]}], [
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
