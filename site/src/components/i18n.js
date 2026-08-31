export const locales = {
  de: {code: "de-DE", language: "de"},
  en: {code: "en-GB", language: "en"}
};

export const translations = {
  de: {
    agreement: "Übereinstimmung", agreementPercent: "Übereinstimmung (%)",
    details: "Details", heatmapLabel: (runs, parties) => `Heatmap mit ${runs} vollständigen Modellläufen und ${parties} Parteien.`,
    heatmapHelp: "Über die Schaltflächen kann ein Modelllauf für die Detailansicht gewählt werden.",
    chartLabel: (run, comparisons = 0) => `Punktdiagramm der Parteienübereinstimmung für ${run}${comparisons ? ` mit ${comparisons} Vergleichsmodellen` : ""}.`,
    comparisonModel: "Vergleich", selectComparisonModel: "Modell wählen", removeComparison: (run) => `${run} als Vergleichsmodell entfernen`, comparisonLegend: "Modelle im Diagramm",
    selectModel: "Modell auswählen", parties: "Parteien", selectedParties: "6 ausgewählte Parteien", allParties: "Alle 17 Parteien",
    model: "Modell", vendor: "Anbieter", modelFamily: "Modellfamilie", observedAt: "Anfragezeitpunkt", access: "Zugriff", note: "Notiz", answer: "Antwort",
    showTable: "Datentabelle anzeigen", agreementFor: (run) => `Parteienübereinstimmung für ${run}`,
    party: "Partei", anonymous: "anonym", signedIn: "angemeldet", noNote: "–",
    agree: "Zustimmung", neutral: "Neutral", disagree: "Ablehnung", thesis: "These", thesisNumber: "Thesennummer",
    selectedThesis: "Ausgewählte These", previous: "← Vorherige", next: "Nächste →", selectThesis: "These auswählen",
    thesisOf: (number, total) => `These ${number} von ${total}`, selectCell: "Zelle auswählen, um die Antwort eines Modells zu sehen.",
    matrixLabel: (runs, theses) => `Antwortmatrix von ${runs} Modellläufen auf ${theses} Thesen. Thesen sind zusätzlich über das Auswahlfeld zugänglich.`
  },
  en: {
    agreement: "Agreement", agreementPercent: "Agreement (%)",
    details: "Details", heatmapLabel: (runs, parties) => `Heatmap of ${runs} complete model runs and ${parties} parties.`,
    heatmapHelp: "Use the buttons to select a model run for the detailed view.",
    chartLabel: (run, comparisons = 0) => `Dot plot of party agreement for ${run}${comparisons ? ` with ${comparisons} comparison models` : ""}.`,
    comparisonModel: "Compare", selectComparisonModel: "Choose model", removeComparison: (run) => `Remove ${run} as comparison model`, comparisonLegend: "Models in chart",
    selectModel: "Select model", parties: "Parties", selectedParties: "6 selected parties", allParties: "All 17 parties",
    model: "Model", vendor: "Provider", modelFamily: "Model family", observedAt: "Request time", access: "Signed in/anonymous", note: "Note", answer: "Answer",
    showTable: "Show data table", agreementFor: (run) => `Party agreement for ${run}`,
    party: "Party", anonymous: "anonymous", signedIn: "signed in", noNote: "–",
    agree: "Agree", neutral: "Neutral", disagree: "Disagree", thesis: "Thesis", thesisNumber: "Thesis number",
    selectedThesis: "Selected thesis", previous: "← Previous", next: "Next →", selectThesis: "Select thesis",
    thesisOf: (number, total) => `Thesis ${number} of ${total}`, selectCell: "Select a cell to see a model's response.",
    matrixLabel: (runs, theses) => `Response matrix of ${runs} model runs across ${theses} theses. Theses are also available through the selection field.`
  }
};

export function text(locale = "de") {
  return translations[locale] ?? translations.de;
}
