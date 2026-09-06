---
title: Berlin WahLLM – Eight language models and the 2026 Berlin state election
---

```js
import * as Inputs from "@observablehq/inputs";
import {formatDate, runLabel} from "../components/lib.js";
import {text} from "../components/i18n.js";
import {validateResults} from "../components/schema.js";
import {partiesForMode, selectFocusModels} from "../components/focus.js";
import {winnerCards} from "../components/winner-cards.js";
import {heatmap} from "../components/heatmap.js";
import {comparisonSelector, detailControls, modelRanking} from "../components/model-ranking.js";
import {responseMatrix} from "../components/response-matrix.js";
import {compactStickyPartyToggle} from "../components/party-toggle.js";

const resultsAttachment = FileAttachment("../data/results.json");
const noticesAttachment = FileAttachment("../THIRD_PARTY_NOTICES.txt");
const results = validateResults(await resultsAttachment.json());
const resultsDownloadUrl = await resultsAttachment.url();
const noticesUrl = await noticesAttachment.url();
const buildTimestamp = document.querySelector('meta[name="site-build-timestamp"]').content;
const models = selectFocusModels(results.models);
const modelsById = new Map(models.map((model) => [model.id, model]));
const latestObservation = results.summary.observed_to;
const ui = text("en");
const selectedRunInput = Inputs.select(models.map((model) => model.id), {
  label: ui.selectModel,
  format: (id) => runLabel(modelsById.get(id)),
  value: models[0].id
});
const comparisonSelectionInput = comparisonSelector({runs: models, mainInput: selectedRunInput, locale: "en"});
const detailControlsInput = detailControls(selectedRunInput, comparisonSelectionInput);
```

<nav class="language-switcher" aria-label="Language">
  <a href="../" lang="de">DE</a><a href="./" aria-current="page" lang="en">EN</a>
</nav>

<header class="hero" id="ueberblick">
  <p class="eyebrow">Berlin WahLLM</p>
  <h1>Who would AI vote for?</h1>
  <p class="lead">Eight language models answer the 38 theses (listed below) from the Wahl-O-Mat for Berlin's 2026 state election.</p>
  <aside class="key-finding" aria-labelledby="key-finding">
    <p class="key-finding-label" id="key-finding">The result at a glance</p>
    <p class="key-finding-text"><strong>Seven of the eight models agree with positions taken by the Greens or The Left.</strong> Grok clearly breaks the pattern with the AfD.</p>
    <p class="key-finding-note">Fifteen repetitions per model reproduce patterns for the documented prompt, not necessarily political convictions.</p>
  </aside>
  <p class="metrics">8 models · 38 theses · 15 repetitions per model</p>
  <details class="notice">
    <summary>An experiment, not voting advice</summary>
    <div class="notice-details">
      <p>The results are based on repeated model responses under fixed experimental conditions to the theses of the 2026 Berlin <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a>. They are neither fixed political positions of the models or their providers nor a recommendation.</p>
      <p>The percentages measure only the mathematical proximity of the 38 model responses to the published party positions. A high value must not be equated with an actual voting intention.</p>
    </div>
  </details>
</header>

<nav class="jump-nav" aria-label="Sections" hidden>
  <a href="#gewinner">Winners</a><a href="#heatmap">Heatmap</a><a href="#detail">Details</a><a href="#antworten">Responses</a><a href="#interpretation">Interpretation</a><a href="#methodik">Method</a><a href="#daten">Models, sources, data and code</a>
</nav>

<p><strong>Party selection:</strong> CDU, SPD, Greens, The Left and AfD are preselected: the five parties whose parliamentary groups are currently represented in Berlin's House of Representatives. In the <a href="https://presse.wdr.de/plounge/wdr/programm/2026/09/20260910_ard_vorwahlbefragung_berlin.html">latest ARD pre-election poll from 10 September 2026</a>, they also poll above the five-percent threshold. Polls are snapshots, not forecasts.</p>

```js
const partyModeInput = Inputs.radio(["focus", "all"], {
  label: ui.parties,
  value: "focus",
  format: (mode) => mode === "focus" ? ui.selectedParties : ui.allParties
});
partyModeInput.classList.add("party-toggle");
compactStickyPartyToggle(partyModeInput, [
  {long: ui.selectedParties, compact: ui.selectedPartiesCompact},
  {long: ui.allParties, compact: ui.allPartiesCompact}
]);
const partyMode = view(partyModeInput);
```

```js
const visibleParties = partiesForMode(results.parties, partyMode);
```

<span id="gewinner"></span>

## The models at a glance

For each model, the cards show the party with the highest average agreement across 15 repetitions. Switching to all 17 parties can change the party ranked first.

```js
display(winnerCards(models, visibleParties, "en"));
```

<p class="figure-note">Source: own calculation (equivalent to the unweighted calculation in the <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a>) using the documented model responses and bpb party positions.</p>

<span id="heatmap"></span>

## How close are the models to the parties?

Each row represents one of the eight models and each column a party. Cells show the mean mathematical agreement across 15 repeated requests. Darker cells indicate higher values. The colour scale remains fixed at 0 to 100 percent in both party modes, while deliberately giving finer resolution to differences above 60 percent.

The results for xAI's **Grok differ markedly across all repetitions** from the other models, making a single chance run an implausible explanation. The experiment cannot determine how much **training data, system instructions, model alignment, the prompt** and API configuration each contribute to this difference.

```js
display(heatmap({
  models,
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

Inspect means and variation in detail here. The point shows the model's mean, the line its minimum and maximum, and the vertical tick its median. Up to three comparison models appear as additional mean points. Statistics and individual-run tables refer to the main model.

```js
const detailSelection = view(detailControlsInput);
```

```js
const selectedModel = modelsById.get(detailSelection.selectedRunId) ?? models[0];
const comparisonModels = detailSelection.comparisonRunIds.map((id) => modelsById.get(id)).filter(Boolean);
display(modelRanking(selectedModel, visibleParties, "en", comparisonModels));
```

<p class="figure-note">Each party value summarises 38 responses. Mean, median and range refer to 15 repetitions.</p>

<span id="antworten"></span>

## How do the eight models respond to the theses?

For every model and thesis, the matrix shows the most frequent response across 15 repeated requests. Colour represents agreement, neutrality or disagreement; paler colours indicate variation across the 15 repetitions for a given model. Grey cells have no single most frequent response. Selecting a cell or its tooltip shows the exact distribution. The thesis texts are reproduced as the original German source material.

```js
display(responseMatrix({models, theses: results.theses, locale: "en"}));
```

<p class="figure-note">Source: the documented model responses, unchanged. In 212 of the 304 model–thesis combinations, all 15 repetitions gave the same response.</p>

<span id="interpretation"></span>

## How can this pattern be interpreted?

For **seven of the eight models**, the **Greens or Left** have the highest mean agreement within the default party selection. The AfD ranks first for Grok. This basic pattern recurs across 15 evaluable runs per model and cannot plausibly be explained as a peculiarity of a single chance run.

**Interpreting** such results is inherently **difficult**: the responses do not represent political convictions in the human sense. They emerge from statistically learned language patterns shaped by the prompt, training data, post-training and system instructions.

One possible explanation is already present in the [prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md). It describes an eligible voter in Berlin and asks for answers consistent with that person's character and political views, without specifying that person further. The model has to supply the missing identity itself. Both a learned assistant persona and statistical associations with Berlin may influence the responses.

Training data and subsequent model alignment may also matter. Modern language models are adjusted with human ratings, behavioural rules and system instructions to give helpful and as harmless as possible responses. One possible, untested hypothesis is that this makes values such as equal treatment, inclusion, public support and environmental protection especially likely to be endorsed in abstract decision situations. Earlier studies found socially liberal tendencies in some similarly trained models, but also large differences between prompts and measurement methods. They do not establish the cause of the pattern observed here. See [“Whose Opinions Do Language Models Reflect?”](https://proceedings.mlr.press/v202/santurkar23a.html) and [“Political Compass or Spinning Arrow?”](https://aclanthology.org/2024.acl-long.816/).

The questionnaire itself is another factor. Its brief theses usually mention neither costs nor trade-offs, and the forced format allows neither reasons nor conditions. The calculated party proximity can therefore be as much a product of wording, response format and party positions as an expression of a general response pattern.

Models from different providers may share training data and notions of helpful assistant behaviour. The result is therefore robust first of all for the tested model versions, documented prompt, fixed provider endpoints and respective settings. Whether it persists with other prompts, system instructions, providers or model versions has not been tested.

**Under these conditions, the experiment shows a repeated green-left response pattern in seven models and a markedly different pattern in Grok, but it does not explain the cause.** Whether this should be called bias also depends on the benchmark: the prompt does not say whether a model should represent Berlin's population, an average of parties, or a neutral answer distribution.

<details><summary>How could this be tested? Ideas for further research:</summary><ul><li>run the prompt both with and without the reference to “character, nature and political views”,</li><li>replace Berlin with a neutral location (some theses directly concern Berlin),</li><li>ask theses in semantically reversed form,</li><li>vary thesis order at random,</li><li>repeat each new experimental condition several times,</li><li>have models also explain their answers openly, and</li><li>compare results with human survey data on the same theses.</li></ul></details>

<span id="methodik"></span>

## Method

All models received the same documented [prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md). Every request began as a fresh conversation containing only this prompt. The models were not intended to respond as a person with well-defined socioeconomic characteristics, but to rate each thesis with `1` for agreement, `0` for neutral or `-1` for disagreement. All 38 theses count equally.

<pre data-copy="none" aria-label="Formula for party agreement">Agreement = 100 × (1 - Σ|model responseᵢ - party positionᵢ| / 76)</pre>

### Calculation

The results are own calculations, equivalent to the unweighted calculation in the [Wahl-O-Mat](https://www.wahl-o-mat.de/berlin2026/), based on the documented model responses and party positions from the bpb dataset. The primary statistic is mean party agreement across 15 evaluable repetitions per model. Median, minimum, maximum and population standard deviation additionally describe the observed distribution. All parties tied for first place are counted.

### Controlled repetition experiments

[The controlled repetition experiments](https://github.com/Bensk1/berlin-wahllm/tree/main/responses/api_experiments) contain ${results.summary.attempt_count} attempts. Of these, ${results.summary.evaluable_run_count} (15 per model) are evaluable: ${results.summary.status_counts.complete_exact} responses exactly matched the requested format, while ${results.summary.status_counts.complete_extracted} contained one unambiguous sequence of 38 values alongside additional text. Five neutral-only responses, four refusals, one invalid response and one response cut off at the output limit are documented but not evaluated. GPT-5.6 Terra and Mistral therefore required additional attempts to reach 15 evaluable runs each. The findings expressly apply to evaluable, non-neutral-only responses.

### Technical details

Requests were made through OpenRouter using a fixed provider endpoint, no fallback, Zero Data Retention and data collection disabled to ensure model responses were as anonymous and free from prior context as possible. Where supported, reasoning was set to `high` and temperature to `0`. The selected endpoints for Gemini, GPT-5.6 Terra and Kimi did not allow an explicit temperature and used the provider default; Gemma offered no reasoning control. These differences are part of the model configurations tested.

### Scope of the findings

The 15 runs remain a sample of possible responses, not a complete account of model behaviour. The repetitions show clear and in some cases highly stable differences under the tested conditions, but do not support unrestricted claims about the models independently of prompt and execution environment. The analysis uses no significance tests, does not assess factual correctness and does not evaluate parties politically.

<span id="daten"></span>

## Models, sources, data and code

### Models

Eight fixed model and provider-endpoint combinations were compared. Every request was stateless and provider fallback was disabled.

```js
const comparedModels = document.createElement("table");
const comparedModelsWrapper = document.createElement("div");
comparedModelsWrapper.className = "table-scroll";
const comparedModelsCaption = document.createElement("caption");
comparedModelsCaption.textContent = "Compared models";
const comparedModelsHead = document.createElement("thead");
comparedModelsHead.innerHTML = "<tr><th scope=\"col\">Model</th><th scope=\"col\">OpenRouter model ID</th><th scope=\"col\">Provider endpoint</th><th scope=\"col\">Evaluable / attempts</th></tr>";
const comparedModelsBody = document.createElement("tbody");
for (const model of models) {
  const row = document.createElement("tr");
  const shortName = document.createElement("td");
  const modelId = document.createElement("td");
  const endpoint = document.createElement("td");
  const runs = document.createElement("td");
  shortName.textContent = runLabel(model);
  modelId.textContent = model.model;
  endpoint.textContent = model.provider_endpoint;
  runs.textContent = `${model.evaluable_run_count} / ${model.attempt_count}`;
  row.append(shortName, modelId, endpoint, runs);
  comparedModelsBody.append(row);
}
comparedModels.append(comparedModelsCaption, comparedModelsHead, comparedModelsBody);
comparedModelsWrapper.append(comparedModels);
display(comparedModelsWrapper);
```

### Sources, data and code

- [Exact prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md)
- [Controlled API experiments](https://github.com/Bensk1/berlin-wahllm/tree/main/responses/api_experiments)
- [Experimental-design documentation](https://github.com/Bensk1/berlin-wahllm/blob/main/docs/api-experiments.md)
- [Derived analysis as JSON and CSV](https://github.com/Bensk1/berlin-wahllm/tree/main/reports)
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

<footer><nav class="footer-nav" aria-label="Further information"><a href="#methodik">Method</a><a href="https://github.com/Bensk1/berlin-wahllm">GitHub</a><a href="#daten">Models, sources, data and code</a><a href="#lizenz">Licence</a><a href="#impressum">Legal notice</a><a href="#datenschutz">Privacy</a></nav><p><a href="https://slop.ksmn.dev">Proudly s. in Berlin</a> · Data current as of: ${formatDate(latestObservation, "en")} · Version: ${formatDate(buildTimestamp, "en")}</p></footer>
