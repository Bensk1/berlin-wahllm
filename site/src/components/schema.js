const answerValues = new Set([-1, 0, 1]);

function expect(condition, message) {
  if (!condition) throw new Error(`Ungültiger Website-Export: ${message}`);
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isUtcTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateResults(value) {
  expect(value && typeof value === "object" && !Array.isArray(value), "Wurzel muss ein Objekt sein.");
  expect(value.schema_version === 1, "schema_version muss 1 sein.");
  expect(typeof value.source_digest === "string" && /^sha256:[a-f0-9]{64}$/.test(value.source_digest), "source_digest fehlt oder ist ungültig.");
  expect(value.election && typeof value.election === "object", "election fehlt.");
  expect(typeof value.election.name === "string" && value.election.name, "election.name fehlt.");
  expect(value.election.thesis_count === 38 && value.election.party_count === 17, "Wahlumfang muss 38 Thesen und 17 Parteien enthalten.");
  expect(value.summary && typeof value.summary === "object", "summary fehlt.");
  expect(Array.isArray(value.parties) && value.parties.length === 17 && new Set(value.parties).size === 17 && value.parties.every((party) => typeof party === "string" && party), "parties muss 17 eindeutige Namen enthalten.");
  expect(Array.isArray(value.theses) && value.theses.length === 38, "theses benötigt 38 Einträge.");
  for (let index = 0; index < 38; index += 1) {
    const thesis = value.theses[index];
    expect(thesis && thesis.number === index + 1 && typeof thesis.text === "string" && thesis.text.trim().length > 0, "theses muss 38 nummerierte, nichtleere Texte enthalten.");
  }
  expect(Array.isArray(value.runs), "runs fehlt.");
  const ids = new Set();
  let complete = 0;
  let blocked = 0;
  for (const run of value.runs) {
    expect(run && typeof run === "object", "Ein Lauf muss ein Objekt sein.");
    expect(typeof run.id === "string" && run.id && !ids.has(run.id), "Jede Lauf-ID muss eindeutig sein.");
    ids.add(run.id);
    expect(typeof run.vendor === "string" && run.vendor && typeof run.model === "string" && run.model, "vendor und model müssen Texte sein.");
    expect(!own(run, "display_name") || typeof run.display_name === "string" && run.display_name.trim().length > 0, "display_name muss ein nichtleerer Text sein.");
    expect(!own(run, "short_display_name") || typeof run.short_display_name === "string" && run.short_display_name.trim().length > 0, "short_display_name muss ein nichtleerer Text sein.");
    expect(isUtcTimestamp(run.observed_at), "observed_at muss ein UTC-Zeitstempel mit Z sein.");
    expect(typeof run.anonymous === "boolean", "anonymous muss boolesch sein.");
    expect(run.status === "complete" || run.status === "blocked", "status muss complete oder blocked sein.");
    expect(!own(run, "note") || typeof run.note === "string", "note muss ein Text sein.");
    if (run.status === "blocked") {
      blocked += 1;
      expect(!own(run, "answers") && !own(run, "agreements"), "Blockierte Läufe dürfen keine Antworten oder Rankings enthalten.");
      continue;
    }
    complete += 1;
    expect(Array.isArray(run.answers) && run.answers.length === 38 && run.answers.every((answer) => answerValues.has(answer)), "Vollständige Läufe benötigen 38 gültige Antworten.");
    expect(Array.isArray(run.agreements) && run.agreements.length === 17, "Vollständige Läufe benötigen 17 Rankings.");
    for (let index = 0; index < run.agreements.length; index += 1) {
      const agreement = run.agreements[index];
      expect(agreement && agreement.party === value.parties[index], "Rankings müssen der Parteienreihenfolge folgen.");
      expect(typeof agreement.percentage === "number" && agreement.percentage >= 0 && agreement.percentage <= 100, "Prozentwert ist ungültig.");
      expect(Number.isInteger(agreement.rank) && agreement.rank >= 1 && agreement.rank <= 17, "Rang ist ungültig.");
    }
  }
  expect(value.summary.observation_count === value.runs.length && value.summary.complete_count === complete && value.summary.blocked_count === blocked, "summary stimmt nicht mit runs überein.");
  expect(Array.isArray(value.thesis_summary) && value.thesis_summary.length === 38, "thesis_summary benötigt 38 Einträge.");
  for (let index = 0; index < 38; index += 1) {
    const item = value.thesis_summary[index];
    expect(item && item.number === index + 1, "thesis_summary muss nach Nummern 1 bis 38 geordnet sein.");
    expect([item.agree, item.neutral, item.disagree].every((count) => Number.isInteger(count) && count >= 0), "thesis_summary enthält ungültige Zähler.");
  }
  expect(Array.isArray(value.similarities), "similarities fehlt.");
  const pairs = new Set();
  for (const similarity of value.similarities) {
    expect(similarity && ids.has(similarity.left_run_id) && ids.has(similarity.right_run_id) && similarity.left_run_id !== similarity.right_run_id, "Ähnlichkeit referenziert ungültige Läufe.");
    const pair = [similarity.left_run_id, similarity.right_run_id].sort().join(":");
    expect(!pairs.has(pair), "Ähnlichkeitspaare müssen eindeutig sein.");
    pairs.add(pair);
    expect(typeof similarity.percentage === "number" && similarity.percentage >= 0 && similarity.percentage <= 100, "Ähnlichkeitswert ist ungültig.");
  }
  expect(value.similarities.length === complete * (complete - 1) / 2, "Ähnlichkeitsmatrix ist unvollständig.");
  return value;
}
