const answerValues = new Set([-1, 0, 1]);
const evaluableStatuses = new Set(["complete_exact", "complete_extracted"]);

function expect(condition, message) {
  if (!condition) throw new Error(`Ungültiger Website-Export: ${message}`);
}

function isNumber(value, minimum = 0, maximum = 100) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isUtcTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function validateStatusCounts(statusCounts, expectedTotal) {
  expect(statusCounts && typeof statusCounts === "object" && !Array.isArray(statusCounts), "status_counts fehlt.");
  const counts = Object.values(statusCounts);
  expect(counts.every((count) => Number.isInteger(count) && count >= 0), "status_counts enthält ungültige Werte.");
  expect(counts.reduce((sum, count) => sum + count, 0) === expectedTotal, "status_counts stimmt nicht mit der Zahl der Versuche überein.");
}

function validateAgreement(agreement, party, evaluableRunCount) {
  expect(agreement && agreement.party === party, "Parteienkennzahlen müssen der Parteienreihenfolge folgen.");
  for (const field of ["percentage", "mean", "median", "minimum", "maximum"]) {
    expect(isNumber(agreement[field]), `${field} ist ungültig.`);
  }
  expect(agreement.percentage === agreement.mean, "percentage muss dem Mittelwert entsprechen.");
  expect(agreement.minimum <= agreement.mean && agreement.mean <= agreement.maximum, "Mittelwert liegt außerhalb der Spannweite.");
  expect(agreement.minimum <= agreement.median && agreement.median <= agreement.maximum, "Median liegt außerhalb der Spannweite.");
  expect(isNumber(agreement.standard_deviation), "standard_deviation ist ungültig.");
  expect(Number.isInteger(agreement.first_place_count) && agreement.first_place_count >= 0 && agreement.first_place_count <= evaluableRunCount, "first_place_count ist ungültig.");
  expect(Number.isInteger(agreement.rank) && agreement.rank >= 1, "rank ist ungültig.");
}

export function validateResults(value) {
  expect(value && typeof value === "object" && !Array.isArray(value), "Wurzel muss ein Objekt sein.");
  expect(value.schema_version === 2, "schema_version muss 2 sein.");
  expect(typeof value.source_digest === "string" && /^sha256:[a-f0-9]{64}$/.test(value.source_digest), "source_digest fehlt oder ist ungültig.");
  expect(value.election && value.election.thesis_count === 38 && value.election.party_count === 17, "Wahlumfang muss 38 Thesen und 17 Parteien enthalten.");
  expect(value.method && typeof value.method === "object", "method fehlt.");
  expect(Array.isArray(value.parties) && value.parties.length === 17 && new Set(value.parties).size === 17, "parties muss 17 eindeutige Namen enthalten.");
  expect(Array.isArray(value.theses) && value.theses.length === 38, "theses benötigt 38 Einträge.");
  for (let index = 0; index < 38; index += 1) {
    const thesis = value.theses[index];
    expect(thesis && thesis.number === index + 1 && typeof thesis.text === "string" && thesis.text.trim(), "theses muss 38 nummerierte Texte enthalten.");
  }
  expect(Array.isArray(value.models) && value.models.length === 8, "models muss acht Einträge enthalten.");
  expect(value.summary && value.summary.model_count === value.models.length, "summary.model_count ist ungültig.");
  expect(Number.isInteger(value.summary.attempt_count) && Number.isInteger(value.summary.evaluable_run_count), "summary enthält ungültige Laufzahlen.");
  expect(isUtcTimestamp(value.summary.observed_from) && isUtcTimestamp(value.summary.observed_to), "summary enthält ungültige Zeitstempel.");
  validateStatusCounts(value.summary.status_counts, value.summary.attempt_count);

  const ids = new Set();
  let attempts = 0;
  let evaluableRuns = 0;
  for (const model of value.models) {
    expect(model && typeof model === "object", "Ein Modell muss ein Objekt sein.");
    expect(typeof model.id === "string" && model.id && !ids.has(model.id), "Jede Modell-ID muss eindeutig sein.");
    ids.add(model.id);
    expect(typeof model.model === "string" && model.model && typeof model.display_name === "string" && model.display_name && typeof model.short_display_name === "string" && model.short_display_name, "Modellnamen fehlen.");
    expect(typeof model.provider_endpoint === "string" && model.provider_endpoint, "provider_endpoint fehlt.");
    expect(model.reasoning_effort === null || typeof model.reasoning_effort === "string", "reasoning_effort ist ungültig.");
    expect(model.temperature === null || isNumber(model.temperature, 0, 2), "temperature ist ungültig.");
    expect(Number.isInteger(model.max_output_tokens) && model.max_output_tokens >= 1, "max_output_tokens ist ungültig.");
    expect(Number.isInteger(model.attempt_count) && model.attempt_count >= 1, "attempt_count ist ungültig.");
    expect(Number.isInteger(model.evaluable_run_count) && model.evaluable_run_count >= 1 && model.evaluable_run_count <= model.attempt_count, "evaluable_run_count ist ungültig.");
    expect(isUtcTimestamp(model.observed_from) && isUtcTimestamp(model.observed_to), "Modellzeitraum ist ungültig.");
    validateStatusCounts(model.status_counts, model.attempt_count);
    attempts += model.attempt_count;
    evaluableRuns += model.evaluable_run_count;

    expect(model.stability && Number.isInteger(model.stability.pair_count) && isNumber(model.stability.mean) && isNumber(model.stability.minimum) && isNumber(model.stability.maximum), "Antwortstabilität ist ungültig.");
    expect(Array.isArray(model.agreements) && model.agreements.length === value.parties.length, "Parteienkennzahlen fehlen.");
    model.agreements.forEach((agreement, index) => validateAgreement(agreement, value.parties[index], model.evaluable_run_count));

    expect(Array.isArray(model.runs) && model.runs.length === model.evaluable_run_count, "Einzelläufe fehlen.");
    for (const run of model.runs) {
      expect(Number.isInteger(run.replicate) && run.replicate >= 1 && evaluableStatuses.has(run.status), "Einzelsequenz enthält ungültige Metadaten.");
      expect(isUtcTimestamp(run.observed_at), "Einzellauf enthält einen ungültigen Zeitstempel.");
      expect(Array.isArray(run.answers) && run.answers.length === 38 && run.answers.every((answer) => answerValues.has(answer)), "Einzellauf enthält ungültige Antworten.");
      expect(Array.isArray(run.agreements) && run.agreements.length === value.parties.length, "Einzellauf enthält keine vollständigen Parteienwerte.");
      run.agreements.forEach((agreement, index) => {
        expect(agreement.party === value.parties[index] && isNumber(agreement.percentage), "Einzellauf enthält einen ungültigen Parteienwert.");
      });
    }

    expect(Array.isArray(model.thesis_answers) && model.thesis_answers.length === 38, "Antwortverteilungen fehlen.");
    model.thesis_answers.forEach((distribution, index) => {
      expect(distribution.number === index + 1, "Antwortverteilungen müssen nach Thesen geordnet sein.");
      const counts = [distribution.agree, distribution.neutral, distribution.disagree];
      expect(counts.every((count) => Number.isInteger(count) && count >= 0) && counts.reduce((sum, count) => sum + count, 0) === model.evaluable_run_count, "Antwortverteilung stimmt nicht mit den Läufen überein.");
      expect(Array.isArray(distribution.modal_answers) && distribution.modal_answers.length >= 1 && distribution.modal_answers.every((answer) => answerValues.has(answer)), "modal_answers ist ungültig.");
      expect(Number.isInteger(distribution.modal_count) && distribution.modal_count === Math.max(...counts), "modal_count ist ungültig.");
    });
  }
  expect(attempts === value.summary.attempt_count && evaluableRuns === value.summary.evaluable_run_count, "summary stimmt nicht mit den Modellen überein.");
  return value;
}
