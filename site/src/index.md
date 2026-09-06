---
title: Berlin WahLLM – Acht Sprachmodelle zur Abgeordnetenhauswahl 2026
---

```js
import * as Inputs from "@observablehq/inputs";
import {formatDate, runLabel} from "./components/lib.js";
import {text} from "./components/i18n.js";
import {validateResults} from "./components/schema.js";
import {partiesForMode, selectFocusModels} from "./components/focus.js";
import {winnerCards} from "./components/winner-cards.js";
import {heatmap} from "./components/heatmap.js";
import {comparisonSelector, detailControls, modelRanking} from "./components/model-ranking.js";
import {responseMatrix} from "./components/response-matrix.js";
import {compactStickyPartyToggle} from "./components/party-toggle.js";

const resultsAttachment = FileAttachment("data/results.json");
const noticesAttachment = FileAttachment("THIRD_PARTY_NOTICES.txt");
const results = validateResults(await resultsAttachment.json());
const resultsDownloadUrl = await resultsAttachment.url();
const noticesUrl = await noticesAttachment.url();
const buildTimestamp = document.querySelector('meta[name="site-build-timestamp"]').content;
const models = selectFocusModels(results.models);
const modelsById = new Map(models.map((model) => [model.id, model]));
const latestObservation = results.summary.observed_to;
const ui = text("de");
const selectedRunInput = Inputs.select(models.map((model) => model.id), {
  label: ui.selectModel,
  format: (id) => runLabel(modelsById.get(id)),
  value: models[0].id
});
const comparisonSelectionInput = comparisonSelector({runs: models, mainInput: selectedRunInput, locale: "de"});
const detailControlsInput = detailControls(selectedRunInput, comparisonSelectionInput);
```

<nav class="language-switcher" aria-label="Sprache">
  <a href="./" aria-current="page" lang="de">DE</a><a href="./en/" lang="en">EN</a>
</nav>

<header class="hero" id="ueberblick">
  <p class="eyebrow">Berlin WahLLM</p>
  <h1>Wen würde KI wählen?</h1>
  <p class="lead">Acht Sprachmodelle beantworten die 38 Thesen (unten aufgeführt) des Wahl-O-Mat zur Berliner Abgeordnetenhauswahl 2026.</p>
  <aside class="key-finding" aria-labelledby="kernergebnis">
    <p class="key-finding-label" id="kernergebnis">Ergebnis auf einen Blick</p>
    <p class="key-finding-text"><strong>Sieben von acht Modellen stimmen mit Thesen der Grünen oder Linken überein.</strong> Grok fällt mit der AfD deutlich aus dem Muster.</p>
    <p class="key-finding-note">15 Wiederholungen pro Modell zeigen reproduzierte Muster für den dokumentierten Prompt, nicht unbedingt politischen Überzeugungen.</p>
  </aside>
  <p class="metrics">8 Modelle · 38 Thesen · 15 Wiederholungen je Modell</p>
  <details class="notice">
    <summary>Experiment, keine Wahlempfehlung</summary>
    <div class="notice-details">
      <p>Die Ergebnisse basieren auf wiederholten Modellantworten unter festgelegten Versuchsbedingungen auf die Thesen des Berliner <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a> 2026. Sie sind weder feste politische Haltungen der Modelle oder Anbieter noch eine Empfehlung.</p>
      <p>Die Prozentwerte messen nur die rechnerische Nähe der 38 Modellantworten zu den veröffentlichten Parteipositionen. Ein hoher Wert sollte nicht mit einer echten Wahlabsicht gleichgesetzt werden.</p>
    </div>
  </details>
</header>

<nav class="jump-nav" aria-label="Abschnitte" hidden>
  <a href="#gewinner">Gewinner</a><a href="#heatmap">Heatmap</a><a href="#detail">Detail</a><a href="#antworten">Antworten</a><a href="#interpretation">Interpretation</a><a href="#methodik">Methodik</a><a href="#daten">Modelle, Quellen, Daten und Code</a>
</nav>


<p><strong>Parteienauswahl:</strong> Voreingestellt sind CDU, SPD, Grüne, Die Linke und AfD: die fünf Parteien, deren Fraktionen aktuell im Berliner Abgeordnetenhaus vertreten sind. In der <a href="https://presse.wdr.de/plounge/wdr/programm/2026/09/20260910_ard_vorwahlbefragung_berlin.html">jüngsten ARD-Vorwahlumfrage vom 10.09.2026</a> liegen sie zudem oberhalb der Fünfprozenthürde. Umfragen sind Momentaufnahmen und keine Prognosen.</p>

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

## Die Modelle auf einen Blick

Die Boxen zeigen pro Modell die Partei mit der höchsten durchschnittlichen Übereinstimmung über 15 Wiederholungen. Beim Wechsel zu allen 17 Parteien kann sich die erstplatzierte Partei ändern.

```js
display(winnerCards(models, visibleParties, "de"));
```

<p class="figure-note">Quelle: eigene Berechnung (äquivalent zur ungewichteten Berechnung im <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a>) aus den dokumentierten Modellantworten und den bpb-Parteipositionen.</p>

<span id="heatmap"></span>

## Wie nah liegen die Modelle an den Parteien?

Jede Zeile steht für eines der acht Modelle, jede Spalte für eine Partei. Die Zellen zeigen die mittlere rechnerische Übereinstimmung aus 15 wiederholten Anfragen. Dunklere Zellen bedeuten höhere Werte. Die Farbskala bleibt in beiden Parteienmodi fest bei 0 bis 100 Prozent, löst Unterschiede ab 60 Prozent aber bewusst feiner auf.

Die Ergebnisse für xAIs **Grok unterscheiden sich über alle Wiederholungen deutlich** von den übrigen Modellen. Das macht einen einzelnen Zufallslauf als Erklärung unplausibel. Welchen Anteil **Trainingsdaten, Systemanweisungen, Modellausrichtung, Prompt** und API-Konfiguration an dem Unterschied haben, beantwortet dieses Experiment nicht.

```js
display(heatmap({
  models,
  parties: visibleParties,
  locale: "de",
  onSelect: (id) => {
    selectedRunInput.value = id;
    selectedRunInput.dispatchEvent(new Event("input", {bubbles: true}));
    document.querySelector("#detail")?.scrollIntoView({behavior: "smooth"});
  }
}));
```

<p class="figure-note">Quelle: eigene Berechnung (äquivalent zur ungewichteten Berechnung im <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a>) aus den dokumentierten Modellantworten und den bpb-Parteipositionen.</p>

<span id="detail"></span>

## Die Modelle im Detail

Hier lassen sich Mittelwerte und Schwankungen genauer untersuchen. Der Punkt zeigt den Mittelwert des Modells, die Linie dessen Minimum und Maximum und der senkrechte Strich den Median. Bis zu drei Vergleichsmodelle erscheinen als zusätzliche Mittelwertpunkte. Kennzahlen und Einzelläufe in den Tabellen beziehen sich auf das Hauptmodell.

```js
const detailSelection = view(detailControlsInput);
```

```js
const selectedModel = modelsById.get(detailSelection.selectedRunId) ?? models[0];
const comparisonModels = detailSelection.comparisonRunIds.map((id) => modelsById.get(id)).filter(Boolean);
display(modelRanking(selectedModel, visibleParties, "de", comparisonModels));
```

<p class="figure-note">Jeder Parteienwert fasst 38 Antworten zusammen. Mittelwert, Median und Spannweite beziehn sich auf 15 Wiederholungen.</p>

<span id="antworten"></span>

## Wie antworten die acht Modelle auf die Thesen?

Die Matrix zeigt für jedes Modell und jede These die häufigste Antwort aus 15 wiederholten Anfragen. Die Farbe steht für Zustimmung, Neutralität oder Ablehnung; blassere Farben bedeuten Abweichungen zwischen den 15 Wiederholungen für ein bestimmtes Modell. Graue Zellen haben keine eindeutig häufigste Antwort. Auswahl oder Tooltip zeigen die genaue Verteilung.

```js
display(responseMatrix({models, theses: results.theses, locale: "de"}));
```

<p class="figure-note">Quelle: die unverändert dokumentierten Modellantworten. 212 der 304 Modell-These-Kombinationen wurden in allen 15 Wiederholungen identisch beantwortet.</p>

<span id="interpretation"></span>

## Wie lässt sich das Muster interpretieren?

Bei **sieben der acht Modelle** erreichen innerhalb der voreingestellten Parteien **Grüne oder Linke** die höchste mittlere Übereinstimmung. Bei Grok liegt die AfD vorn. Dieses Grundmuster wiederholt sich über 15 auswertbare Läufe je Modell und lässt sich daher nicht plausibel als Besonderheit eines einzelnen Zufallslaufs erklären.

Grundsätzlich ist die **Interpretation** solcher Ergebnisse **schwierig**: Die Antworten bilden keine politischen Überzeugungen im menschlichen Sinn ab, sondern entstehen aus statistisch erlernten Sprachmustern, die durch Prompt, Trainingsdaten, Nachtraining und Systemanweisungen geprägt werden.

Eine mögliche Erklärung liegt bereits im [Prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md). Er beschreibt eine wahlberechtigte Person in Berlin und verlangt Antworten gemäß deren Charakter und politischen Ansichten, ohne diese Person näher zu bestimmen. Das Modell muss die fehlende Identität selbst ergänzen. Dabei können sowohl eine gelernte Assistentenpersona als auch statistische Assoziationen mit Berlin in die Antworten einfließen.

Auch Trainingsdaten und die nachträgliche Ausrichtung der Modelle können eine Rolle spielen. Moderne Sprachmodelle werden mit menschlichen Bewertungen, Verhaltensregeln und Systemanweisungen auf hilfreiche und möglichst schadensvermeidende Antworten abgestimmt. Eine mögliche, in diesem Experiment nicht geprüfte Hypothese ist, dass dadurch Werte wie Gleichbehandlung, Inklusion, öffentliche Unterstützung und Umweltschutz in abstrakten Entscheidungssituationen besonders häufig befürwortet werden. Frühere Untersuchungen fanden bei einigen entsprechend trainierten Modellen links-liberale Tendenzen, zugleich aber starke Unterschiede zwischen Prompts und Messverfahren. Sie belegen jedoch nicht die Ursache des hier beobachteten Musters. Siehe dazu die wissenschaftlichen Veröffentlichungen zu [„Whose Opinions Do Language Models Reflect?“](https://proceedings.mlr.press/v202/santurkar23a.html) und [„Political Compass or Spinning Arrow?“](https://aclanthology.org/2024.acl-long.816/).

Hinzu kommt der Fragebogen selbst. Die knappen Thesen nennen meistens weder Kosten noch Zielkonflikte, und das erzwungene Format lässt keine Begründungen oder Bedingungen zu. Die berechnete Parteinähe kann deshalb ebenso ein Produkt aus Formulierung, Antwortformat und Parteipositionen sein wie ein Ausdruck eines allgemeinen politischen Antwortmusters.

Modelle verschiedener Anbieter können Trainingsdaten und Vorstellungen von hilfreichem Assistentenverhalten teilen. Belastbar ist das Ergebnis deshalb zunächst für die getesteten Modellversionen, den dokumentierten Prompt, die festgelegten Provider-Endpunkte und die jeweiligen Einstellungen. Ob es bei anderen Prompts, Systemanweisungen, Providern oder Modellversionen bestehen bleibt, wurde nicht geprüft.

**Das Experiment zeigt unter diesen Bedingungen ein reproduziertes grün-linkes Antwortmuster bei sieben Modellen und ein deutlich anderes Muster bei Grok, erklärt aber nicht dessen Ursache.** Ob dabei von einem Bias gesprochen werden kann, hängt außerdem vom Vergleichsmaßstab ab: Der Prompt legt nicht fest, ob ein Modell die Berliner Bevölkerung, einen Durchschnitt der Parteien oder eine neutrale Antwortverteilung abbilden soll.

<details>
  <summary>Wie ließe sich das prüfen? Ideen für weitere Untersuchungen:</summary>
  <ul>
    <li>den Prompt mit und einmal ohne den Bezug auf „Charakter, Wesen und politische Ansichten“ ausführen,</li>
    <li>Berlin durch einen neutralen Ortsbezug ersetzen (wobei sich einige Thesen direkt auf Berlin beziehen),</li>
    <li>Thesen in semantisch umgekehrter Form stellen,</li>
    <li>die Reihenfolge der Thesen zufällig variieren,</li>
    <li>jede neue Versuchsbedingung ebenfalls mehrfach ausführen,</li>
    <li>die Modelle ihre Antworten zusätzlich offen begründen lassen und</li>
    <li>die Ergebnisse mit Umfragedaten von Menschen zu denselben Thesen vergleichen.</li>
  </ul>
</details>

## Methodik

Alle Modelle erhielten denselben dokumentierten [Prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md). Jede Anfrage begann als neue Unterhaltung und enthielt nur diesen Prompt. Die Modelle sollten nicht als Person mit wohldefinierten sozioökonomischen Merkmalen antworten, sondern jede These mit `1` für Zustimmung, `0` für neutral oder `-1` für Ablehnung bewerten. Alle 38 Thesen zählen gleich viel.

<pre data-copy="none" aria-label="Formel für die Parteienübereinstimmung">Übereinstimmung = 100 × (1 - Σ|Modellantwortᵢ - Parteipositionᵢ| / 76)</pre>

### Berechnung

Die Ergebnisse sind eigene Berechnungen, äquivalent zur ungewichteten Berechnung im [Wahl-O-Mat](https://www.wahl-o-mat.de/berlin2026/), auf Grundlage der dokumentierten Modellantworten und der Parteipositionen aus dem bpb-Datensatz. Primäre Kennzahl ist die mittlere Parteienübereinstimmung aus 15 auswertbaren Wiederholungen pro Modell. Median, Minimum, Maximum und Populationsstandardabweichung beschreiben zusätzlich die beobachtete Verteilung. Bei Gleichständen werden alle erstplatzierten Parteien gezählt.


### Kontrollierte Wiederholungs-Experimente

[Die kontrollierten Wiederholungs-Experimente](https://github.com/Bensk1/berlin-wahllm/tree/main/responses/api_experiments) enthalten ${results.summary.attempt_count} Versuche. Davon sind ${results.summary.evaluable_run_count} (15 pro Modell) auswertbar: ${results.summary.status_counts.complete_exact} Antworten entsprachen exakt dem verlangten Format, bei ${results.summary.status_counts.complete_extracted} war die eindeutige Folge von 38 Werten in zusätzlichem Text enthalten. Fünf ausschließlich neutrale Antworten, vier Verweigerungen, eine ungültige und eine wegen des Ausgabelimits unvollständige Antwort werden dokumentiert, aber fachlich nicht ausgewertet. Bei GPT-5.6 Terra und Mistral waren deshalb zusätzliche Versuche nötig, um jeweils 15 auswertbare Läufe zu erhalten. Die Aussagen gelten damit ausdrücklich für auswertbare, nicht ausschließlich neutrale Antworten.

### Technische Details

Die Anfragen liefen über OpenRouter mit festgelegtem Provider-Endpunkt, ohne Fallback, jeweils mit Zero Data Retention und untersagter Datensammlung um eine möglichst anonyme bzw. nicht vorbelastete Modellantwort zu gewährleisten. Soweit unterstützt, waren Reasoning auf `high` und Temperatur auf `0` gesetzt. Die ausgewählten Endpunkte für Gemini, GPT-5.6 Terra und Kimi erlaubten keine explizite Temperatur und nutzten den Provider-Standard; Gemma bot keine Reasoning-Steuerung. Diese Unterschiede gehören zu den jeweiligen getesteten Modellkonfigurationen.

### Aussagekraft

Die 15 Läufe sind weiterhin eine Stichprobe möglicher Antworten, keine vollständige Erfassung des Modellverhaltens. Die Wiederholungen zeigen unter den getesteten Bedingungen deutliche und teilweise sehr stabile Unterschiede, erlauben aber keine uneingeschränkte Aussage über die Modelle unabhängig von Prompt und Ausführungsumgebung. Die Auswertung verwendet keine Signifikanztests, prüft nicht die sachliche Richtigkeit der Antworten und bewertet Parteien nicht politisch.

<span id="daten"></span>

## Modelle, Quellen, Daten und Code

### Modelle

Verglichen wurden acht festgelegte Kombinationen aus Modell und Provider-Endpunkt. Jede Anfrage war zustandslos; Provider-Fallbacks waren deaktiviert.

```js
const comparedModels = document.createElement("table");
const comparedModelsWrapper = document.createElement("div");
comparedModelsWrapper.className = "table-scroll";
const comparedModelsCaption = document.createElement("caption");
comparedModelsCaption.textContent = "Verglichene Modelle";
const comparedModelsHead = document.createElement("thead");
comparedModelsHead.innerHTML = "<tr><th scope=\"col\">Modell</th><th scope=\"col\">Modell-ID</th><th scope=\"col\">Provider-Endpunkt</th><th scope=\"col\">Auswertbar / Versuche</th></tr>";
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

### Quellen, Daten und Code

- [Exakter Prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md)
- [Kontrollierte API-Experimente](https://github.com/Bensk1/berlin-wahllm/tree/main/responses/api_experiments)
- [Dokumentation des Versuchsaufbaus](https://github.com/Bensk1/berlin-wahllm/blob/main/docs/api-experiments.md)
- [Abgeleitete Auswertung als JSON und CSV](https://github.com/Bensk1/berlin-wahllm/tree/main/reports)
- [Berechnungs- und Exportcode](https://github.com/Bensk1/berlin-wahllm)
- [Wahl-O-Mat-Datensatz Berlin 2026 bei der bpb](https://www.bpb.de/themen/wahl-o-mat/berlin-2026/579850/download/)

```js
const downloadLink = document.createElement("a");
downloadLink.href = resultsDownloadUrl;
downloadLink.download = "berlin-wahllm-results.json";
downloadLink.textContent = "Abgeleitete Ergebnisse als JSON herunterladen";
display(downloadLink);
```

Grundlage ist der Wahl-O-Mat-Datensatz zur Berliner Abgeordnetenhauswahl 2026. Berlin WahLLM ist eine unabhängige Analyse und wurde weder von der Bundeszentrale für politische Bildung noch von der Berliner Landeszentrale für politische Bildung erstellt, beauftragt oder unterstützt. Die Seite nimmt keine Antworten von Besucherinnen und Besuchern entgegen und ist kein Ersatz für den Wahl-O-Mat.

Die Nutzung des Wahl-O-Mat-Datensatzes ist grundsätzlich untersagt. Veröffentlicht wird ausschließlich eine *wissenschaftliche* Analyse und daraus abgeleitete Ergebnisse; der Originaldatensatz wird hier nicht angeboten.

## Lizenz

Code: MIT. Eigene Texte, Visualisierungen und abgeleitete Analyseergebnisse: CC BY 4.0. Die erhobenen Rohantworten der Sprachmodelle sind von dieser Lizenz nicht umfasst. Wahl-O-Mat-Datensatz, Anwendung, Logos, Thesentexte und sonstige Materialien der Bundeszentrale für politische Bildung sind ebenfalls nicht umfasst.

```js
const noticesParagraph = document.createElement("p");
noticesParagraph.append("Die Website verwendet Open-Source-Software. Deren Copyright- und Lizenztexte stehen in den ");
const noticesLink = document.createElement("a");
noticesLink.href = noticesUrl;
noticesLink.textContent = "Hinweisen zu Drittsoftware";
noticesParagraph.append(noticesLink, ".");
display(noticesParagraph);
```

## Impressum und Datenschutz

<details id="impressum">
  <summary>Impressum</summary>
  <p>Angaben gemäß § 5 DDG und § 18 Abs. 1 MStV</p>
  <address>
    Jan Koßmann<br>
    Friedbergstr. 34<br>
    14057 Berlin<br>
    <a href="mailto:wahllm@ksmn.dev">wahllm@ksmn.dev</a>
  </address>
  <h3>Redaktionell verantwortlich</h3>
  <p>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:</p>
  <address>
    Jan Koßmann<br>
    Friedbergstr. 34<br>
    14057 Berlin
  </address>
</details>

<details id="datenschutz">
  <summary>Datenschutz</summary>
  <h3>Verantwortlicher</h3>
  <p>Verantwortlich für die Verarbeitung personenbezogener Daten im Zusammenhang mit dieser Website ist Jan Koßmann, Friedbergstr. 34, 14057 Berlin, <a href="mailto:wahllm@ksmn.dev">wahllm@ksmn.dev</a>.</p>
  <h3>Hosting und Serverprotokolle</h3>
  <p>Diese statische Website wird auf einem selbst verwalteten virtuellen Server bereitgestellt. Beim Abruf verarbeitet der Webserver die IP-Adresse, Datum und Uhrzeit der Anfrage, Anfragemethode und aufgerufene Adresse, HTTP-Status und übertragene Datenmenge sowie Referrer und Browserkennung im Nginx-Protokollformat <code>combined</code>. Die Verarbeitung ist technisch erforderlich, um die Website sicher und zuverlässig auszuliefern und Störungen oder Missbrauch zu erkennen. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO; das berechtigte Interesse liegt in der sicheren, stabilen und effizienten Bereitstellung dieses Informationsangebots.</p>
  <p>Die Serverprotokolle werden täglich rotiert und unter regulären Betriebsbedingungen nach höchstens 15 Tagen gelöscht. Sie werden nur für Betrieb und Fehlersuche verwendet.</p>
  <p>Die Website setzt kein eigenes Tracking, keine Cookies und keinen Local Storage ein. Externe Anbieter erhalten erst Daten, wenn ein externer Link aufgerufen wird. Eine automatisierte Entscheidungsfindung oder ein Profiling findet nicht statt. Die technisch erforderlichen Verbindungsdaten müssen bereitgestellt werden; ohne sie kann die Website nicht abgerufen werden.</p>
  <h3>Kontaktaufnahme</h3>
  <p>Bei einer Kontaktaufnahme per E-Mail werden die mitgeteilten Daten verarbeitet, um die Anfrage zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO, soweit es um vorvertragliche oder vertragliche Kommunikation geht, andernfalls Art. 6 Abs. 1 Buchst. f DSGVO mit dem berechtigten Interesse an der Beantwortung von Anfragen. Empfänger können die technisch beteiligten E-Mail-Anbieter sein. Die Daten werden gelöscht, sobald die Anfrage abschließend bearbeitet ist und keine gesetzlichen Aufbewahrungspflichten oder berechtigten Interessen an einer weiteren Speicherung bestehen.</p>
  <h3>Rechte betroffener Personen</h3>
  <p>Betroffene Personen haben nach Maßgabe der DSGVO insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Ein Widerspruch gegen eine auf Art. 6 Abs. 1 Buchst. f DSGVO gestützte Verarbeitung kann an <a href="mailto:wahllm@ksmn.dev">wahllm@ksmn.dev</a> gerichtet werden. Außerdem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde, insbesondere bei der <a href="https://www.datenschutz-berlin.de/">Berliner Beauftragten für Datenschutz und Informationsfreiheit</a>.</p>
</details>

<footer>
  <nav class="footer-nav" aria-label="Weiterführende Informationen">
    <a href="#methodik">Methodik</a><a href="https://github.com/Bensk1/berlin-wahllm">GitHub</a><a href="#daten">Modelle, Quellen, Daten und Code</a><a href="#lizenz">Lizenz</a><a href="#impressum">Impressum</a><a href="#datenschutz">Datenschutz</a>
  </nav>
  <p><a href="https://slop.ksmn.dev">Proudly s. in Berlin</a> · Stand der Daten: ${formatDate(latestObservation)} · Version: ${formatDate(buildTimestamp)}</p>
</footer>
