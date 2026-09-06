export const locales = {
  de: {code: "de-DE", language: "de"},
  en: {code: "en-GB", language: "en"}
};

export const translations = {
  de: {
    agreement: "Übereinstimmung", agreementPercent: "Übereinstimmung (%)", mean: "Mittelwert", meanShort: "Ø", median: "Median", minimum: "Minimum", maximum: "Maximum", range: "Spannweite", standardDeviation: "Standardabweichung", percentagePoints: (value) => `${new Intl.NumberFormat(locales.de.code, {maximumFractionDigits: 1}).format(value)} Prozentpunkte`,
    details: "Details", heatmapLabel: (models, parties) => `Heatmap mit den Mittelwerten von ${models} Modellen und ${parties} Parteien.`,
    heatmapHelp: "Über die Schaltflächen kann ein Modell für die Detailansicht gewählt werden.",
    chartLabel: (run, comparisons = 0) => `Diagramm der mittleren Parteienübereinstimmung und Spannweite für ${run}${comparisons ? ` mit ${comparisons} Vergleichsmodellen` : ""}.`,
    comparisonModel: "Vergleich", selectComparisonModel: "Modell wählen", removeComparison: (run) => `${run} als Vergleichsmodell entfernen`, comparisonLegend: "Modelle im Diagramm",
    selectModel: "Modell auswählen", parties: "Parteien", selectedParties: "5 ausgewählte Parteien", allParties: "Alle 17 Parteien", selectedPartiesCompact: "Auswahl (5)", allPartiesCompact: "Alle (17)",
    model: "Modell", modelId: "Modell-ID", reasoning: "Reasoning", temperature: "Temperatur", notControlled: "nicht steuerbar", providerDefault: "Standard (0 nicht konfigurierbar)", runs: "Läufe", evaluable: "auswertbar", attempts: "Versuche", status: "Status", stability: "Antwortstabilität", note: "Notiz", answer: "Antwort",
    statuses: {complete_exact: "exakt", complete_extracted: "eindeutig extrahiert", neutral_only: "nur neutral", refused: "verweigert", invalid: "ungültig", output_exhausted: "Ausgabelimit erreicht", blocked: "blockiert"},
    showSummaryTable: "Kennzahlen nach Partei", showIndividualRuns: "Alle 15 Einzelläufe", agreementFor: (run) => `Parteienübereinstimmung für ${run}`, individualRunsFor: (run) => `Einzelläufe für ${run}`, run: "Lauf", firstPlace: "(Mit-)Erstplatzierungen", ofRuns: (count, total) => `${count} von ${total}`,
    party: "Partei", anonymous: "anonym", signedIn: "angemeldet", noNote: "–",
    agree: "Zustimmung", neutral: "Neutral", disagree: "Ablehnung", mixed: "Uneindeutig", thesis: "These", thesisNumber: "Thesennummer", answerDistribution: ({agree, neutral, disagree}) => `Zustimmung ${agree} · Neutral ${neutral} · Ablehnung ${disagree}`,
    selectedThesis: "Ausgewählte These", previous: "← Vorherige", next: "Nächste →", selectThesis: "These auswählen",
    thesisOf: (number, total) => `These ${number} von ${total}`, selectCell: "Zelle auswählen, um die Antwort eines Modells zu sehen.",
    matrixLabel: (models, theses) => `Antwortmatrix der häufigsten Antworten von ${models} Modellen auf ${theses} Thesen. Thesen sind zusätzlich über das Auswahlfeld zugänglich.`
  },
  en: {
    agreement: "Agreement", agreementPercent: "Agreement (%)", mean: "Mean", meanShort: "Mean", median: "Median", minimum: "Minimum", maximum: "Maximum", range: "range", standardDeviation: "Standard deviation", percentagePoints: (value) => `${new Intl.NumberFormat(locales.en.code, {maximumFractionDigits: 1}).format(value)} percentage points`,
    details: "Details", heatmapLabel: (models, parties) => `Heatmap of the mean values for ${models} models and ${parties} parties.`,
    heatmapHelp: "Use the buttons to select a model for the detailed view.",
    chartLabel: (run, comparisons = 0) => `Chart of mean party agreement and range for ${run}${comparisons ? ` with ${comparisons} comparison models` : ""}.`,
    comparisonModel: "Compare", selectComparisonModel: "Choose model", removeComparison: (run) => `Remove ${run} as comparison model`, comparisonLegend: "Models in chart",
    selectModel: "Select model", parties: "Parties", selectedParties: "5 selected parties", allParties: "All 17 parties", selectedPartiesCompact: "Selection (5)", allPartiesCompact: "All (17)",
    model: "Model", modelId: "Model ID", reasoning: "Reasoning", temperature: "Temperature", notControlled: "not configurable", providerDefault: "default (0 not configurable)", runs: "Runs", evaluable: "evaluable", attempts: "attempts", status: "Status", stability: "Response stability", note: "Note", answer: "Answer",
    statuses: {complete_exact: "exact", complete_extracted: "unambiguously extracted", neutral_only: "neutral only", refused: "refused", invalid: "invalid", output_exhausted: "output limit reached", blocked: "blocked"},
    showSummaryTable: "Statistics by party", showIndividualRuns: "All 15 individual runs", agreementFor: (run) => `Party agreement for ${run}`, individualRunsFor: (run) => `Individual runs for ${run}`, run: "Run", firstPlace: "(Joint) first places", ofRuns: (count, total) => `${count} of ${total}`,
    party: "Party", anonymous: "anonymous", signedIn: "signed in", noNote: "–",
    agree: "Agree", neutral: "Neutral", disagree: "Disagree", mixed: "No single mode", thesis: "Thesis", thesisNumber: "Thesis number", answerDistribution: ({agree, neutral, disagree}) => `Agree ${agree} · Neutral ${neutral} · Disagree ${disagree}`,
    selectedThesis: "Selected thesis", previous: "← Previous", next: "Next →", selectThesis: "Select thesis",
    thesisOf: (number, total) => `Thesis ${number} of ${total}`, selectCell: "Select a cell to see a model's response.",
    matrixLabel: (models, theses) => `Response matrix of the most frequent responses from ${models} models across ${theses} theses. Theses are also available through the selection field.`
  }
};

export function text(locale = "de") {
  return translations[locale] ?? translations.de;
}
