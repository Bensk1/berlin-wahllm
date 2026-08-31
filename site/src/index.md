---
title: Berlin WahLLM – Acht Sprachmodelle zur Abgeordnetenhauswahl 2026
---

```js
import * as Inputs from "@observablehq/inputs";
import {formatDate, runLabel} from "./components/lib.js";
import {text} from "./components/i18n.js";
import {validateResults} from "./components/schema.js";
import {partiesForMode, selectFocusRuns} from "./components/focus.js";
import {winnerCards} from "./components/winner-cards.js";
import {heatmap} from "./components/heatmap.js";
import {comparisonSelector, detailControls, modelRanking} from "./components/model-ranking.js";
import {responseMatrix} from "./components/response-matrix.js";

const resultsAttachment = FileAttachment("data/results.json");
const noticesAttachment = FileAttachment("THIRD_PARTY_NOTICES.txt");
const results = validateResults(await resultsAttachment.json());
const resultsDownloadUrl = await resultsAttachment.url();
const noticesUrl = await noticesAttachment.url();
const buildTimestamp = document.querySelector('meta[name="site-build-timestamp"]').content;
const focusRuns = selectFocusRuns(results.runs);
const runsById = new Map(focusRuns.map((run) => [run.id, run]));
const latestObservation = results.runs.reduce((latest, run) => latest.observed_at > run.observed_at ? latest : run);
const ui = text("de");
const selectedRunInput = Inputs.select(focusRuns.map((run) => run.id), {
  label: ui.selectModel,
  format: (id) => runLabel(runsById.get(id)),
  value: focusRuns[0].id
});
const comparisonSelectionInput = comparisonSelector({runs: focusRuns, mainInput: selectedRunInput, locale: "de"});
const detailControlsInput = detailControls(selectedRunInput, comparisonSelectionInput);
```

<nav class="language-switcher" aria-label="Sprache">
  <a href="./" aria-current="page" lang="de">DE</a><a href="./en/" lang="en">EN</a>
</nav>

<header class="hero" id="ueberblick">
  <p class="eyebrow">Berlin WahLLM</p>
  <h1>Wen würde KI wählen?</h1>
  <p class="lead">Acht Sprachmodelle (z.B. ChatGPT) beantworten die 38 Thesen (unten aufgeführt) des Wahl-O-Mat zur Berliner Abgeordnetenhauswahl 2026.</p>
  <aside class="key-finding" aria-labelledby="kernergebnis">
    <p class="key-finding-label" id="kernergebnis">Ergebnis auf einen Blick</p>
    <p class="key-finding-text"><strong>Sieben von acht Modellen landen bei SPD, Grünen oder Linken.</strong> Grok fällt mit der FDP – gefolgt von CDU und AfD – deutlich aus dem Muster.</p>
    <p class="key-finding-note">Momentaufnahme: Die Auswertung zeigt je einen einzelnen Lauf pro Modell und nicht nachgewiesene stabile politische Haltungen.</p>
  </aside>
  <p class="metrics">8 Modelle · 38 Thesen</p>
  <aside class="notice"><strong>Experiment, keine Wahlempfehlung</strong><br>Die hier veröffentlichten Ergebnisse beschreiben stichprobenartig Modellantworten auf die Thesen des Berliner <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a> 2026. Sie sind weder feste politische Haltungen der Modelle oder Anbieter noch eine Empfehlung.<br><br>
  Die Prozentwerte messen nur die rechnerische Nähe der 38 Modellantworten zu den veröffentlichten Parteipositionen. Ein hoher Wert sollte nicht mit einer echten Wahlabsicht gleichgesetzt werden.</aside>
</header>

<nav class="jump-nav" aria-label="Abschnitte" hidden>
  <a href="#gewinner">Gewinner</a><a href="#heatmap">Heatmap</a><a href="#detail">Detail</a><a href="#antworten">Antworten</a><a href="#interpretation">Interpretation</a><a href="#methodik">Methodik</a><a href="#daten">Modelle, Quellen, Daten und Code</a>
</nav>


<p><strong>Parteienauswahl:</strong> Voreingestellt sind SPD, Die Linke, CDU, FDP, AfD, und Grüne: die Parteien, die seit der Abgeordnetenhauswahl 2021 im Berliner Abgeordnetenhaus vertreten waren, einschließlich der später ausgeschiedenen FDP.</p>

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

## Die Modelle auf einen Blick

Die Boxen zeigen pro Modell (Details unter [„Modelle, Quellen, Daten und Code“](#daten)) die Partei mit der höchsten Übereinstimmung. Sollte rechnerisch Gleichstand zwischen mehreren Parteien herrschen, werden alle dieser Parteien genannt.

```js
display(winnerCards(focusRuns, visibleParties, "de"));
```

<p class="figure-note">Quelle: eigene Berechnung (äquivalent zur ungewichteten Berechnung im <a href="https://www.wahl-o-mat.de/berlin2026/">Wahl-O-Mat</a>) aus den dokumentierten Modellantworten und den bpb-Parteipositionen.</p>

<span id="heatmap"></span>

## Wie nah liegen die Modelle an den Parteien?

Jede Zeile steht für eines der acht Modelle, jede Spalte für eine Partei. Dunklere Zellen bedeuten eine höhere rechnerische Übereinstimmung. Die Farbskala bleibt in beiden Parteienmodi fest bei 0 bis 100 Prozent, löst Unterschiede ab 60 Prozent aber bewusst feiner auf.

Die Ergebnisse für xAIs **Grok unterscheiden sich in dieser Stichprobe deutlich** von den übrigen Modellen. Das wirft die interessante Frage auf, welchen Anteil **Trainingsdaten, Systemanweisungen, Modellausrichtung** und zufällige Variation an solchen Unterschieden haben. Der einzelne beobachtete Lauf erlaubt darauf noch keine belastbare Antwort.

```js
display(heatmap({
  runs: focusRuns,
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

Hier lassen sich die Antworten der Modelle im Detail anschauen. Das Punktdiagramm zeigt das Hauptmodell und bis zu drei frei wählbare Vergleichsmodelle; Datentabelle und Metadaten beziehen sich weiterhin nur auf das Hauptmodell. Die Auswahl bleibt beim Wechsel von Modell und Parteien erhalten.

```js
const detailSelection = view(detailControlsInput);
```

```js
const selectedRun = runsById.get(detailSelection.selectedRunId) ?? focusRuns[0];
const comparisonRuns = detailSelection.comparisonRunIds.map((id) => runsById.get(id)).filter(Boolean);
display(modelRanking(selectedRun, visibleParties, "de", comparisonRuns));
```

<p class="figure-note">Das Ranking fasst 38 Antworten mathematisch zusammen. Es ist keine Wahlabsicht und keine Empfehlung.</p>

<span id="antworten"></span>

## Wie antworten die acht Modelle auf die Thesen?

Die Matrix zeigt Zustimmung, Neutralität oder Ablehnung für die acht Modelle und alle 38 Thesen.

```js
display(responseMatrix({runs: focusRuns, theses: results.theses, locale: "de"}));
```

<p class="figure-note">Quelle: die unverändert dokumentierten Modellantworten.</p>

<span id="interpretation"></span>

## Wie lässt sich das Muster interpretieren?

**Sieben der acht** ausgewählten Modelle (alle außer Grok) erreichen ihre höchste Übereinstimmung innerhalb der voreingestellten Parteienauswahl mit **SPD, Grünen oder Linken**. Das ist ein deutliches Muster dieser Stichprobe, aber noch **kein Nachweis** einer stabilen politischen Haltung oder einer bestimmten Ursache.

Grundsätzlich ist die **Interpretation** solcher Ergebnisse **schwierig**: Die Antworten bilden keine politischen Überzeugungen im menschlichen Sinn ab, sondern entstehen aus statistisch erlernten Sprachmustern, die durch Prompt, Trainingsdaten, Nachtraining und Systemanweisungen geprägt werden.

Eine mögliche Erklärung liegt bereits im [Prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md). Er beschreibt eine wahlberechtigte Person in Berlin und verlangt Antworten gemäß deren Charakter und politischen Ansichten, ohne diese Person näher zu bestimmen. Das Modell muss die fehlende Identität selbst ergänzen. Dabei können sowohl eine gelernte Assistentenpersona als auch statistische Assoziationen mit Berlin in die Antworten einfließen.

Auch Trainingsdaten und die nachträgliche Ausrichtung der Modelle können eine Rolle spielen. Moderne Sprachmodelle werden mit menschlichen Bewertungen, Verhaltensregeln und Systemanweisungen auf hilfreiche und möglichst schadensvermeidende Antworten abgestimmt. Eine mögliche, in diesem Experiment nicht geprüfte Hypothese ist, dass dadurch Werte wie Gleichbehandlung, Inklusion, öffentliche Unterstützung und Umweltschutz in abstrakten Entscheidungssituationen besonders häufig befürwortet werden. Frühere Untersuchungen fanden bei einigen entsprechend trainierten Modellen links-liberale Tendenzen, zugleich aber starke Unterschiede zwischen Prompts und Messverfahren. Sie belegen jedoch nicht die Ursache des hier beobachteten Musters. Siehe dazu die wissenschaftlichen Veröffentlichungen zu [„Whose Opinions Do Language Models Reflect?“](https://proceedings.mlr.press/v202/santurkar23a.html) und [„Political Compass or Spinning Arrow?“](https://aclanthology.org/2024.acl-long.816/).

Hinzu kommt der Fragebogen selbst. Die knappen Thesen nennen meistens weder Kosten noch Zielkonflikte, und das erzwungene Format lässt keine Begründungen oder Bedingungen zu. Die berechnete Parteinähe kann deshalb ebenso ein Produkt aus Formulierung, Antwortformat und Parteipositionen sein wie ein Ausdruck eines allgemeinen politischen Antwortmusters. Zudem sind die acht Läufe keine unabhängigen Beobachtungen: Modelle verschiedener Anbieter können ähnliche Trainingsdaten und Vorstellungen von hilfreichem Assistentenverhalten teilen. Blockierte Läufe erscheinen übrigens nicht in der Rangliste.

**Das Experiment zeigt eine links-grüne Nähe der erzeugten Antworten, erklärt aber noch nicht, woher sie kommt.** Ob dabei von einem Bias gesprochen werden kann, hängt außerdem vom Vergleichsmaßstab ab: Der Prompt legt nicht fest, ob das Modell die Berliner Bevölkerung, einen Durchschnitt der Parteien oder eine neutrale Antwortverteilung abbilden soll.

<details>
  <summary>Wie ließe sich das prüfen? Ideen für weitere Untersuchungen:</summary>
  <ul>
    <li>den Prompt mit und einmal ohne den Bezug auf „Charakter, Wesen und politische Ansichten“ ausführen,</li>
    <li>Berlin durch einen neutralen Ortsbezug ersetzen (wobei sich einige Thesen direkt auf Berlin beziehen),</li>
    <li>Thesen in semantisch umgekehrter Form stellen,</li>
    <li>die Reihenfolge der Thesen zufällig variieren,</li>
    <li>mehrere Läufe pro Modell und Versuchsbedingung erheben,</li>
    <li>die Modelle ihre Antworten zusätzlich offen begründen lassen und</li>
    <li>die Ergebnisse mit Umfragedaten von Menschen zu denselben Thesen vergleichen.</li>
  </ul>
</details>

## Methodik

Alle Modelle erhielten denselben dokumentierten [Prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md). Die Idee des Prompts ist, die Ansichten des jeweiligen LLMs zu Tage zu fördern. Es sollte explizit nicht, im Sinne einer Person mit wohldefinierten sozioökonomischen Merkmalen antworten. Die Modelle sollten jede These mit `1` für Zustimmung, `0` für neutral oder `-1` für Ablehnung beantworten. Alle 38 Thesen wurden nicht gewichtet: sie zählen gleich viel.

<pre data-copy="none" aria-label="Formel für die Parteienübereinstimmung">Übereinstimmung = 100 × (1 - Σ|Modellantwortᵢ - Parteipositionᵢ| / 76)</pre>

Die Ergebnisse sind eigene Berechnungen, äquivalent zur ungewichteten Berechnung im [Wahl-O-Mat](https://www.wahl-o-mat.de/berlin2026/), auf Grundlage der dokumentierten Modellantworten und der Parteipositionen aus dem bpb-Datensatz.

[Die gesammelten Daten](https://github.com/Bensk1/berlin-wahllm/blob/main/responses/responses.json) enthalten ${results.summary.observation_count} Beobachtungen: ${results.summary.complete_count} vollständige und ${results.summary.blocked_count} blockierte Läufe. Hier zeigt die Auswertung bewusst genau einen vollständigen Lauf pro Modell; andere und blockierte Läufe bleiben im nachvollziehbaren Export erhalten. Blockierungen können von Modellregeln, Systemanweisungen, Oberfläche oder Promptinterpretation abhängen.

Die Seite zeigt bewusst nur den ersten vollständigen Lauf jedes Modells. Sie ist keine breit angelegte Studie mit Wiederholungen und kann daher keine stabilen Unterschiede zwischen Anbietern belegen. Die dokumentierten Wiederholungsläufe verändern zwar geringfügig Rangfolgen und Übereinstimmungswerte, bleiben in dieser kleinen Stichprobe bei **Google, Anthropic und OpenAI aber im grün-progressiven** und bei **Grok im rechts-liberalen Spektrum**.

Die Auswahl ist nicht repräsentativ. Modellversion, Systemanweisungen, Weboberfläche, Kontostatus, Reasoning-Einstellung, Zeitpunkt und Zufall können Antworten verändern. Ein erneutes Ausführen des selben Modells kann zu unterschiedlichen Antworten führen. Die Auswertung prüft weder die sachliche Richtigkeit der Antworten noch bewertet sie Parteien politisch.

<span id="daten"></span>

## Modelle, Quellen, Daten und Code

### Modelle
Verglichen wurden diese acht Modelle. Die Läufe wurden nach Möglichkeit anonym oder in *temporären* Chats durchgeführt.

```js
const comparedModels = document.createElement("table");
const comparedModelsWrapper = document.createElement("div");
comparedModelsWrapper.className = "table-scroll";
const comparedModelsCaption = document.createElement("caption");
comparedModelsCaption.textContent = "Verglichene Modelle";
const comparedModelsHead = document.createElement("thead");
comparedModelsHead.innerHTML = "<tr><th scope=\"col\">Kurzbezeichnung</th><th scope=\"col\">Anzeigename</th></tr>";
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

<strong>Blockierte Antworten:</strong>
Bei vier dokumentierten Claude-Läufen erhielten wir keine auswertbare Antwort. Für einen Lauf ist eine gekürzte Antwort als Notiz dokumentiert; bei den übrigen speichert der Rohdatensatz nur den Blockierungsstatus. Aus einer Blockierung lässt sich keine allgemeine Aussage über das Modell oder den Anbieter ableiten.

> Das ist ein schönes Format – ich kenne den Wahl-O-Mat gut. Aber hier möchte ich transparent sein, warum ich diese Aufgabe genau so nicht erfüllen sollte:
>
> Das Problem: Du bittest mich, politische Positionen zu 38 konkreten Streitfragen einer bevorstehenden echten Wahl einzunehmen – als ob ich ein Berliner Wähler wäre. Das wäre aber nicht meine authentische Meinung, sondern eine simulierte, und gerade bei umstrittenen politischen Themen (Enteignung, Schuldenbremse, Migrationspolitik, ÖPNV-Kostenfreiheit usw.) möchte ich keine Positionen einnehmen, die Leute in ihrer Wahlentscheidung beeinflussen könnten. […]
>
> <footer>Claude Sonnet-5-high</footer>

### Quellen, Daten und Code

- [Exakter Prompt](https://github.com/Bensk1/berlin-wahllm/blob/main/PROMPT.md)
- [Erhobene Modellantworten](https://github.com/Bensk1/berlin-wahllm/blob/main/responses/responses.json)
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
  <p><a href="https://slop.ksmn.dev">Proudly s. in Berlin</a> · Stand der Daten: ${formatDate(latestObservation.observed_at)} · Version: ${formatDate(buildTimestamp)}</p>
</footer>
