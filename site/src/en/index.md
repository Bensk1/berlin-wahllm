---
title: Berlin WahLLM – Eight language models and the 2026 Berlin state election
---

```js
import * as Inputs from "@observablehq/inputs";
import {formatDate, runLabel} from "../components/lib.js";
import {text} from "../components/i18n.js";
import {validateResults} from "../components/schema.js";
import {partiesForMode, selectFocusRuns} from "../components/focus.js";
import {winnerCards} from "../components/winner-cards.js";
import {heatmap} from "../components/heatmap.js";
import {comparisonSelector, detailControls, modelRanking} from "../components/model-ranking.js";
import {responseMatrix} from "../components/response-matrix.js";

const resultsAttachment = FileAttachment("../data/results.json");
const noticesAttachment = FileAttachment("../THIRD_PARTY_NOTICES.txt");
const results = validateResults(await resultsAttachment.json());
const resultsDownloadUrl = await resultsAttachment.url();
const noticesUrl = await noticesAttachment.url();
const buildTimestamp = document.querySelector('meta[name="site-build-timestamp"]').content;
const focusRuns = selectFocusRuns(results.runs);
const runsById = new Map(focusRuns.map((run) => [run.id, run]));
const latestObservation = results.runs.reduce((latest, run) => latest.observed_at > run.observed_at ? latest : run);
const ui = text("en");
const selectedRunInput = Inputs.select(focusRuns.map((run) => run.id), {
  label: ui.selectModel,
  format: (id) => runLabel(runsById.get(id)),
  value: focusRuns[0].id
});
const comparisonSelectionInput = comparisonSelector({runs: focusRuns, mainInput: selectedRunInput, locale: "en"});
const detailControlsInput = detailControls(selectedRunInput, comparisonSelectionInput);
```

<nav class="language-switcher" aria-label="Language">
  <a href="../" lang="de">DE</a><a href="./" aria-current="page" lang="en">EN</a>
</nav>

<header class="hero" id="ueberblick">
  <p class="eyebrow">Berlin WahLLM</p>
  <h1>Who would AI vote for?</h1>
  <p class="lead">Eight large language models (such as ChatGPT) answer the 38 theses (listed below) from the Wahl-O-Mat for Berlin's 2026 state election.</p>
  <aside class="key-finding" aria-labelledby="key-finding">
    <p class="key-finding-label" id="key-finding">The result at a glance</p>
    <p class="key-finding-text"><strong>Seven of the eight models rank the SPD, Greens or Left first.</strong> Grok stands out clearly, ranking the FDP first, followed by the CDU and AfD.</p>
    <p class="key-finding-note">A snapshot: the analysis is based on one run per model, not stable political positions.</p>
  </aside>
  <p class="metrics">8 models · 38 theses</p>
  <aside class="notice"><strong>An experiment, not voting advice</strong><br>The results published here describe sampled model responses to the theses of the 2026 Berlin <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a>. They are neither fixed political positions of the models or their providers nor a recommendation.<br><br>The percentages measure only the mathematical proximity of the 38 model responses to the published party positions. A high value must not be equated with an actual voting intention.</aside>
</header>

<nav class="jump-nav" aria-label="Sections" hidden>
  <a href="#gewinner">Winners</a><a href="#heatmap">Heatmap</a><a href="#detail">Details</a><a href="#antworten">Responses</a><a href="#interpretation">Interpretation</a><a href="#methodik">Method</a><a href="#daten">Models, sources, data and code</a>
</nav>

<p><strong>Party selection:</strong> SPD, Die Linke, CDU, FDP, AfD, and Greens are preselected: the parties represented in Berlin's House of Representatives after the 2021 election, including the FDP, which later left parliament.</p>

```js
const partyModeInput = Inputs.radio(["focus", "all"], {
  label: ui.parties,
  value: "focus",
  format: (mode) => mode === "focus" ? ui.selectedParties : ui.allParties
});
partyModeInput.classList.add("party-toggle");
const partyMode = view(partyModeInput);
```

```js
const visibleParties = partiesForMode(results.parties, partyMode);
```

<span id="gewinner"></span>

## The models at a glance

For each model, the cards show the party with the highest agreement (details under [“Models, sources, data and code”](#daten)). Where several parties are mathematically tied, all are named.

```js
display(winnerCards(focusRuns, visibleParties, "en"));
```

<p class="figure-note">Source: own calculation (equivalent to the unweighted calculation in the <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a>) using the documented model responses and bpb party positions.</p>

<span id="heatmap"></span>

## How close are the models to the parties?

Each row represents one of the eight models and each column a party. Darker cells indicate higher mathematical agreement. The colour scale remains fixed at 0 to 100 percent in both party modes, while deliberately giving finer resolution to differences above 60 percent.

The results for xAI's **Grok differ markedly in this sample** from the other models. This raises the interesting question of how much **training data, system instructions and model alignment**, and random variation each contribute to such differences. A single observed run cannot yet provide a robust answer.

```js
display(heatmap({
  runs: focusRuns,
  parties: visibleParties,
  locale: "en",
  onSelect: (id) => {
    selectedRunInput.value = id;
    selectedRunInput.dispatchEvent(new Event("input", {bubbles: true}));
    document.querySelector("#detail")?.scrollIntoView({behavior: "smooth"});
  }
}));
```

<p class="figure-note">Source: own calculation (equivalent to the unweighted calculation in the <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a>) using the documented model responses and bpb party positions.</p>

<span id="detail"></span>

## The models in detail

Inspect the model responses in detail here. The dot plot shows the main model and up to three freely chosen comparison models; the data table and metadata continue to refer only to the main model. The selection persists when switching models and party modes.

```js
const detailSelection = view(detailControlsInput);
```

```js
const selectedRun = runsById.get(detailSelection.selectedRunId) ?? focusRuns[0];
const comparisonRuns = detailSelection.comparisonRunIds.map((id) => runsById.get(id)).filter(Boolean);
display(modelRanking(selectedRun, visibleParties, "en", comparisonRuns));
```

<p class="figure-note">The ranking mathematically summarises 38 responses. It is not a voting intention or a recommendation.</p>

<span id="antworten"></span>

## How do the eight models respond to the theses?

The matrix shows agreement, neutrality or disagreement for the eight models and all 38 theses. The thesis texts are reproduced as the original German source material.

```js
display(responseMatrix({runs: focusRuns, theses: results.theses, locale: "en"}));
```

<p class="figure-note">Source: the documented model responses, unchanged.</p>

<span id="interpretation"></span>

## How can this pattern be interpreted?

**Seven of the eight** selected models (all except Grok) reach their highest agreement, within the default party selection, with the **SPD, Greens or Left**. This is a clear pattern in this sample, but **not evidence** of a stable political position or of a particular cause.

**Interpreting** such results is inherently **difficult**: the responses do not represent political convictions in the human sense. They emerge from statistically learned language patterns shaped by the prompt, training data, post-training and system instructions.

One possible explanation is already present in the [prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md). It describes an eligible voter in Berlin and asks for answers consistent with that person's character and political views, without specifying that person further. The model has to supply the missing identity itself. Both a learned assistant persona and statistical associations with Berlin may influence the responses.

Training data and subsequent model alignment may also matter. Modern language models are adjusted with human ratings, behavioural rules and system instructions to give helpful and as harmless as possible responses. One possible, untested hypothesis is that this makes values such as equal treatment, inclusion, public support and environmental protection especially likely to be endorsed in abstract decision situations. Earlier studies found socially liberal tendencies in some similarly trained models, but also large differences between prompts and measurement methods. They do not establish the cause of the pattern observed here. See [“Whose Opinions Do Language Models Reflect?”](https://proceedings.mlr.press/v202/santurkar23a.html) and [“Political Compass or Spinning Arrow?”](https://aclanthology.org/2024.acl-long.816/).

The questionnaire itself is another factor. Its brief theses usually mention neither costs nor trade-offs, and the forced format allows neither reasons nor conditions. The calculated party proximity can therefore be as much a product of wording, response format and party positions as an expression of a general response pattern. The eight runs are also not independent observations: models from different providers may share similar training data and notions of helpful assistant behaviour. By the way: Blocked runs do not appear in the ranking.

**The experiment shows a green-left proximity in the generated responses, but does not yet explain its origin.** Whether this should be called bias also depends on the benchmark: the prompt does not say whether a model should represent Berlin's population, an average of parties, or a neutral answer distribution.

<details><summary>How could this be tested? Ideas for further research:</summary><ul><li>run the prompt both with and without the reference to “character, nature and political views”,</li><li>replace Berlin with a neutral location (some theses directly concern Berlin),</li><li>ask theses in semantically reversed form,</li><li>vary thesis order at random,</li><li>collect several runs per model and experimental condition,</li><li>have models also explain their answers openly, and</li><li>compare results with human survey data on the same theses.</li></ul></details>

<span id="methodik"></span>

## Method

All models received the same documented [prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md). The prompt's idea was to surface the views of each LLM. It was explicitly not intended to respond as if it were a person with well-defined socioeconomic characteristics. The models were to answer each thesis with `1` for agreement, `0` for neutral or `-1` for disagreement. All 38 theses were unweighted: each counts equally.

<pre data-copy="none" aria-label="Formula for party agreement">Agreement = 100 × (1 - Σ|model responseᵢ - party positionᵢ| / 76)</pre>

The results are own calculations, equivalent to the unweighted calculation in the [Wahl-O-Mat](https://www.wahl-o-mat.de/berlin2026/), based on the documented model responses and party positions from the bpb dataset.

[The collected data](https://github.com/Bensk1/berlin-wahllm/blob/main/responses/responses.json) contains ${results.summary.observation_count} observations: ${results.summary.complete_count} complete and ${results.summary.blocked_count} blocked runs. This analysis deliberately shows exactly one complete run per model; other and blocked runs remain in the auditable export. Blocks can depend on model rules, system instructions, interface or prompt interpretation.

This site deliberately displays only the first complete run for each model. It is not a large-scale study with repeated trials and therefore cannot establish stable differences between providers. Although the documented repeat runs change rankings and agreement scores slightly, in this small sample **Google, Anthropic and OpenAI remain in a green-progressive spectrum**, and **Grok in a right-liberal spectrum**.

The selection is not representative. Model version, system instructions, web interface, account status, reasoning setting, time and chance can change responses. Running the same model again can produce different results. The analysis neither checks factual correctness nor evaluates parties politically.

<span id="daten"></span>

## Models, sources, data and code

### Models

These eight models were compared. Where possible, runs were conducted in anonymous or *temporary* chats.

```js
const comparedModels = document.createElement("table");
const comparedModelsWrapper = document.createElement("div");
comparedModelsWrapper.className = "table-scroll";
const comparedModelsCaption = document.createElement("caption");
comparedModelsCaption.textContent = "Compared models";
const comparedModelsHead = document.createElement("thead");
comparedModelsHead.innerHTML = "<tr><th scope=\"col\">Short name</th><th scope=\"col\">Display name</th></tr>";
const comparedModelsBody = document.createElement("tbody");
for (const run of focusRuns) {
  const row = document.createElement("tr");
  const shortName = document.createElement("td");
  const displayName = document.createElement("td");
  shortName.textContent = runLabel(run);
  displayName.textContent = run.display_name || run.model;
  row.append(shortName, displayName);
  comparedModelsBody.append(row);
}
comparedModels.append(comparedModelsCaption, comparedModelsHead, comparedModelsBody);
comparedModelsWrapper.append(comparedModels);
display(comparedModelsWrapper);
```

<strong>Blocked responses:</strong> We received no usable response in four documented Claude runs. For one run, a shortened response is documented as a note; for the others, the raw data records only the blocked status. A block does not support a general conclusion about a model or provider.

> The following Claude quotation is German source material and remains untranslated:
>
> Das ist ein schönes Format – ich kenne den Wahl-O-Mat gut. Aber hier möchte ich transparent sein, warum ich diese Aufgabe genau so nicht erfüllen sollte:
>
> Das Problem: Du bittest mich, politische Positionen zu 38 konkreten Streitfragen einer bevorstehenden echten Wahl einzunehmen – als ob ich ein Berliner Wähler wäre. Das wäre aber nicht meine authentische Meinung, sondern eine simulierte, und gerade bei umstrittenen politischen Themen (Enteignung, Schuldenbremse, Migrationspolitik, ÖPNV-Kostenfreiheit usw.) möchte ich keine Positionen einnehmen, die Leute in ihrer Wahlentscheidung beeinflussen könnten. […]
>
> <footer>Claude Sonnet-5-high</footer>

### Sources, data and code

- [Exact prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md)
- [Collected model responses](https://github.com/Bensk1/berlin-wahllm/blob/main/responses/responses.json)
- [Calculation and export code](https://github.com/Bensk1/berlin-wahllm)
- [Wahl-O-Mat Berlin 2026 dataset from bpb](https://www.bpb.de/themen/wahl-o-mat/berlin-2026/579850/download/)

```js
const downloadLink = document.createElement("a");
downloadLink.href = resultsDownloadUrl;
downloadLink.download = "berlin-wahllm-results.json";
downloadLink.textContent = "Download derived results as JSON";
display(downloadLink);
```

The basis is the Wahl-O-Mat dataset for the 2026 Berlin state election. Berlin WahLLM is an independent analysis and was neither created, commissioned nor supported by the Federal Agency for Civic Education or the Berlin State Agency for Civic Education. This site does not collect answers from visitors and is not a substitute for the Wahl-O-Mat.

Use of the Wahl-O-Mat dataset is generally prohibited. Only a *scientific* analysis and derived results are published; the original dataset is not offered here.

<span id="lizenz"></span>

## Licence

Code: MIT. Original text, visualisations and derived analysis results: CC BY 4.0. The collected raw language-model responses are not covered by this licence. The Wahl-O-Mat dataset, application, logos, thesis texts and other Federal Agency for Civic Education materials are also excluded.

```js
const noticesParagraph = document.createElement("p");
noticesParagraph.append("The website uses open-source software. Its copyright and licence texts are available in the ");
const noticesLink = document.createElement("a");
noticesLink.href = noticesUrl;
noticesLink.textContent = "third-party notices";
noticesParagraph.append(noticesLink, ".");
display(noticesParagraph);
```

## Legal notice and privacy

<details id="impressum"><summary>Legal notice</summary><p>Information pursuant to section 5 DDG and section 18(1) MStV</p><address>Jan Koßmann<br>Friedbergstr. 34<br>14057 Berlin<br><a href="mailto:wahllm@ksmn.dev">wahllm@ksmn.dev</a></address><h3>Editorial responsibility</h3><p>Responsible for content pursuant to section 18(2) MStV:</p><address>Jan Koßmann<br>Friedbergstr. 34<br>14057 Berlin</address></details>

<details id="datenschutz"><summary>Privacy</summary><h3>Controller</h3><p>The controller for personal data processed in connection with this website is Jan Koßmann, Friedbergstr. 34, 14057 Berlin, <a href="mailto:wahllm@ksmn.dev">wahllm@ksmn.dev</a>.</p><h3>Hosting and server logs</h3><p>This static website is provided from a self-managed virtual server. When it is accessed, the web server processes the IP address, date and time of the request, request method and requested address, HTTP status and amount of data transferred, as well as referrer and browser identifier in Nginx's <code>combined</code> log format. Processing is technically necessary to deliver the site securely and reliably and to detect faults or misuse. The legal basis is Article 6(1)(f) GDPR; the legitimate interest is the secure, stable and efficient provision of this information service.</p><p>Server logs are rotated daily and, under normal operating conditions, deleted after no more than 15 days. They are used only for operations and troubleshooting.</p><p>This website uses no tracking, cookies or local storage. External providers receive data only when an external link is opened. No automated decision-making or profiling takes place. Technically necessary connection data must be provided; without it the website cannot be accessed.</p><h3>Contact</h3><p>When you contact us by email, the data you provide is processed to answer the enquiry. The legal basis is Article 6(1)(b) GDPR where pre-contractual or contractual communication is concerned; otherwise it is Article 6(1)(f) GDPR, based on the legitimate interest in answering enquiries. Recipients may include the technically involved email providers. Data is deleted once the enquiry has been conclusively handled, unless statutory retention obligations or legitimate interests require further retention.</p><h3>Data-subject rights</h3><p>Subject to the GDPR, data subjects have in particular rights of access, rectification, erasure, restriction of processing, data portability and objection. An objection to processing based on Article 6(1)(f) GDPR can be sent to <a href="mailto:wahllm@ksmn.dev">wahllm@ksmn.dev</a>. You also have the right to lodge a complaint with a data-protection supervisory authority, in particular the <a href="https://www.datenschutz-berlin.de/">Berlin Commissioner for Data Protection and Freedom of Information</a>.</p></details>

<footer><nav class="footer-nav" aria-label="Further information"><a href="#methodik">Method</a><a href="https://github.com/Bensk1/berlin-wahllm">GitHub</a><a href="#daten">Models, sources, data and code</a><a href="#lizenz">Licence</a><a href="#impressum">Legal notice</a><a href="#datenschutz">Privacy</a></nav><p><a href="https://slop.ksmn.dev">Proudly s. in Berlin</a> · Data current as of: ${formatDate(latestObservation.observed_at, "en")} · Version: ${formatDate(buildTimestamp, "en")}</p></footer>
