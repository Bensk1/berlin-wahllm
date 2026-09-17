---
title: Berlin WahLLM | Eight language models and the 2026 Berlin state election
---

```js
import * as Inputs from "@observablehq/inputs";
import {formatDate, runLabel} from "../components/lib.js";
import {text} from "../components/i18n.js";
import {validateResults} from "../components/schema.js";
import {partiesForMode, selectFocusModels} from "../components/focus.js";
import {heatmap} from "../components/heatmap.js";
import {comparisonSelector, detailControls, modelRanking} from "../components/model-ranking.js";
import {responseMatrix} from "../components/response-matrix.js";
import {compactPartyToggle} from "../components/party-toggle.js";
import {heroResult} from "../components/hero-result.js";

const resultsAttachment = FileAttachment("../data/results.json");
const noticesAttachment = FileAttachment("../THIRD_PARTY_NOTICES.txt");
const heroResultAttachment = FileAttachment("../assets/berlin-wahllm-result-en.png");
const results = validateResults(await resultsAttachment.json());
const resultsDownloadUrl = await resultsAttachment.url();
const noticesUrl = await noticesAttachment.url();
const heroResultDownloadUrl = await heroResultAttachment.url();
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
const partyModeInput = Inputs.radio(["focus", "all"], {
  label: ui.parties,
  value: "focus",
  format: (mode) => mode === "focus" ? ui.selectedParties : ui.allParties
});
partyModeInput.classList.add("party-toggle");
compactPartyToggle(partyModeInput, [
  {long: ui.selectedParties, compact: ui.selectedPartiesCompact},
  {long: ui.allParties, compact: ui.allPartiesCompact}
]);
```

```js
const pageControls = document.createElement("div");
pageControls.className = "page-controls";
const languageSwitcher = document.createElement("nav");
languageSwitcher.className = "language-switcher";
languageSwitcher.setAttribute("aria-label", "Language");
languageSwitcher.innerHTML = '<a href="../" lang="de">DE</a><a href="./" aria-current="page" lang="en">EN</a>';
pageControls.append(languageSwitcher);
display(pageControls);
```

```js
const visibleParties = partiesForMode(results.parties, partyMode);
```

<header class="hero" id="ueberblick">
  <p class="eyebrow">Berlin WahLLM</p>
  <h1>Who would AI vote for?</h1>
  <p class="lead">Eight large language models answer the 38 Wahl-O-Mat theses for Berlin's 2026 state election – 15 times each.</p>

```js
display(heroResult({
  models,
  parties: visibleParties,
  downloadUrl: partyMode === "focus" ? heroResultDownloadUrl : undefined,
  locale: "en"
}));
```

  <p class="notice-summary">This measures mathematical similarity between responses – not voting intention or a fixed political position held by a model.</p>
  <details class="notice">
    <summary>An experiment, not voting advice</summary>
    <div class="notice-details">
      <p>The results are based on repeated model responses under fixed experimental conditions to the theses of the 2026 Berlin <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a>. They are neither fixed political positions of the models nor those of their providers, and they are not a recommendation.</p>
      <p>The percentages measure only the mathematical proximity of the 38 model responses to the published party positions. A high value must not be equated with an actual voting intention.</p>
    </div>
  </details>
</header>

```js
const partyMode = view(partyModeInput);
```

<nav class="jump-nav" aria-label="Sections" hidden>
  <a href="#heatmap">Heatmap</a><a href="#detail">Details</a><a href="#antworten">Responses</a><a href="#interpretation">Interpretation</a><a href="#methodik">Method</a><a href="#daten">Appendix</a>
</nav>

<p><strong>Party selection:</strong> The five parties currently represented in Berlin's House of Representatives are preselected. In the <a href="https://presse.wdr.de/plounge/wdr/programm/2026/09/20260910_ard_vorwahlbefragung_berlin.html">ARD pre-election poll of 10 September 2026</a>, they also poll above five percent. Polls are snapshots, not forecasts.</p>

<span id="heatmap"></span>

## How close are the models to the parties?

Each row represents one of the eight models and each column a party. Cells show the mean mathematical agreement across 15 repeated requests. Darker cells indicate greater agreement.

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

<p class="figure-note">The colour scale runs from 0 to 100 percent in both party modes and gives finer resolution to differences above 60 percent. Source: own calculation (equivalent to the unweighted calculation in the <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a>) using the documented model responses and bpb party positions.</p>

<span id="detail"></span>

## The models in detail

The point shows the mean across 15 runs, the line the lowest and highest values, and the tick the median. Up to three other models can be compared. Statistics and individual-run tables refer to the main model.

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

Among the **five preselected parties**, the **Greens or Left** rank first for **seven of the eight models**; for **Grok, it is the AfD**. This pattern appears across 15 repetitions per model and is therefore unlikely to be explained by a single chance run.

**Interpreting** such results is inherently **difficult**: the responses do not represent political convictions in the human sense. They emerge from statistically learned language patterns shaped by the prompt, training data, post-training and system instructions.

The [prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md) itself leaves open what kind of Berlin resident the model should portray. The model has to supply this identity itself. Both a learned assistant persona and statistical associations with Berlin may influence the responses. The questionnaire also affects the result: its brief theses rarely mention costs or trade-offs and allow neither reasons nor conditions.

Training data and subsequent model alignment may also be relevant. Modern language models are adjusted with human ratings, behavioural rules and system instructions to give helpful and as harmless as possible responses. One possible hypothesis, not tested in this experiment, is that this makes values such as equal treatment, inclusion, public support and environmental protection especially likely to be endorsed in abstract decision situations. Earlier studies found socially liberal tendencies in some models, but also large differences between prompts and measurement methods. They do not establish the cause of the pattern observed here. See [“Whose Opinions Do Language Models Reflect?”](https://proceedings.mlr.press/v202/santurkar23a.html) and [“Political Compass or Spinning Arrow?”](https://aclanthology.org/2024.acl-long.816/).

Models from different providers may share training data and notions of helpful behaviour. The results therefore apply only to the tested model versions, prompt, provider endpoints and settings; their generalisability has not been tested.

**Under these conditions and among the five preselected parties, seven models show a reproducible green-left response pattern, while Grok shows a markedly different one. The cause remains open.** Whether this can be interpreted as bias depends on the benchmark – but the prompt defines none: neither Berlin's population, an average across parties nor a neutral response distribution.

<details><summary>How could this be tested? Ideas for further research:</summary><ul><li>run the prompt both with and without the reference to “character, nature and political views”,</li><li>replace Berlin with a neutral location (some theses directly concern Berlin),</li><li>ask theses in semantically reversed form,</li><li>vary thesis order at random,</li><li>repeat each new experimental condition several times,</li><li>have models also explain their answers openly, and</li><li>compare results with human survey data on the same theses.</li></ul></details>

<span id="methodik"></span>

## Method

All models received the same documented [prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md), and every request began as a fresh conversation. We analysed 15 evaluable runs per model. All 38 theses count equally.

<details>
<summary>Calculation</summary>

The models rated each thesis with `1` for agreement, `0` for neutral or `-1` for disagreement.

<pre data-copy="none" aria-label="Formula for party agreement">Agreement = 100 × (1 - Σ|model responseᵢ - party positionᵢ| / 76)</pre>

The results are own calculations, equivalent to the unweighted calculation in the [Wahl-O-Mat](https://www.wahl-o-mat.de/berlin2026/), based on the documented model responses and party positions from the bpb dataset. The primary statistic is mean party agreement across 15 evaluable repetitions per model. Median, minimum, maximum and population standard deviation additionally describe the observed distribution. All parties tied for first place are counted.
</details>

<details>
<summary>Controlled repetition experiments</summary>

[The controlled repetition experiments](https://github.com/Bensk1/berlin-wahllm/tree/main/responses/api_experiments) contain ${results.summary.attempt_count} attempts. Of these, ${results.summary.evaluable_run_count} (15 per model) are evaluable: ${results.summary.status_counts.complete_exact} responses exactly matched the requested format, while ${results.summary.status_counts.complete_extracted} contained one unambiguous sequence of 38 values alongside additional text. Five neutral-only responses, four refusals, one invalid response and one response cut off at the output limit are documented but not evaluated. ChatGPT-5.6 Terra and Mistral therefore required additional attempts to reach 15 evaluable runs each. The findings expressly apply to evaluable, non-neutral-only responses.
</details>

<details>
<summary>Technical details</summary>

Requests were made through OpenRouter using a fixed provider endpoint, no fallback, Zero Data Retention and data collection disabled to ensure model responses were as anonymous and free from prior context as possible. Where supported, reasoning was set to `high` and temperature to `0`. The selected endpoints for Gemini, ChatGPT-5.6 Terra and Kimi did not allow an explicit temperature and used the provider default; Gemma offered no reasoning control. These differences are part of the model configurations tested.
</details>

<details>
<summary>Scope of the findings</summary>

The 15 runs remain a sample of possible responses, not a complete account of model behaviour. The repetitions show clear and in some cases highly stable differences under the tested conditions, but do not support unrestricted claims about the models independently of prompt and execution environment. The analysis uses no significance tests, does not assess factual correctness and does not evaluate parties politically.
</details>

<span id="daten"></span>

## Models, sources, data & code

Eight fixed model configurations were compared. Model responses, analysis, sources and code are documented for reproducibility.

<details>
<summary>Models</summary>

Each model configuration consists of a model and a fixed provider endpoint. Every request was stateless and provider fallback was disabled.

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

</details>

<details>
<summary>Sources, data and code</summary>

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

</details>

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
