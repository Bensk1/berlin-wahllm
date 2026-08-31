import * as Plot from "@observablehq/plot";
import {runLabel} from "./lib.js";
import {text} from "./i18n.js";

function answerLabels(locale) {
  const ui = text(locale);
  return new Map([[1, ui.agree], [0, ui.neutral], [-1, ui.disagree]]);
}

export function matrixValues(runs, theses, locale = "de") {
  const ui = text(locale);
  const labels = answerLabels(locale);
  return runs.flatMap((run) => theses.map((thesis, index) => {
    const label = labels.get(run.answers[index]);
    return {
      run: run.id,
      runName: runLabel(run),
      thesis: thesis.number,
      thesisText: thesis.text,
      label,
      detail: `${runLabel(run)}; ${ui.thesis} ${thesis.number}: ${thesis.text}; ${ui.answer}: ${label}`
    };
  }));
}

export function thesisCard(theses, locale) {
  const ui = text(locale);
  const card = document.createElement("section");
  card.className = "thesis-card";
  card.setAttribute("aria-label", ui.selectedThesis);

  const controls = document.createElement("div");
  controls.className = "thesis-controls";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = ui.previous;
  const selectLabel = document.createElement("label");
  selectLabel.textContent = ui.selectThesis;
  const select = document.createElement("select");
  for (const thesis of theses) {
    const option = document.createElement("option");
    option.value = String(thesis.number);
    option.textContent = `${ui.thesis} ${thesis.number}`;
    select.append(option);
  }
  selectLabel.append(select);
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = ui.next;
  controls.append(previous, selectLabel, next);

  const heading = document.createElement("h3");
  const thesisText = document.createElement("p");
  thesisText.className = "thesis-text";
  const answer = document.createElement("p");
  answer.className = "thesis-answer";

  let selectedNumber = 1;
  function show(number, selectedCell) {
    selectedNumber = Math.min(theses.length, Math.max(1, number));
    const thesis = theses[selectedNumber - 1];
    select.value = String(selectedNumber);
    heading.textContent = ui.thesisOf(selectedNumber, theses.length);
    thesisText.textContent = thesis.text;
    answer.textContent = selectedCell
      ? `${selectedCell.runName}: ${selectedCell.label}`
      : ui.selectCell;
    previous.disabled = selectedNumber === 1;
    next.disabled = selectedNumber === theses.length;
  }

  select.addEventListener("input", () => show(Number(select.value)));
  previous.addEventListener("click", () => show(selectedNumber - 1));
  next.addEventListener("click", () => show(selectedNumber + 1));
  show(selectedNumber);
  card.append(controls, heading, thesisText, answer);
  return {card, show};
}

export function responseMatrix({runs, theses, locale = "de"}) {
  const ui = text(locale);
  const values = matrixValues(runs, theses, locale);
  const {card, show} = thesisCard(theses, locale);
  const figure = Plot.plot({
    marginLeft: 160,
    marginBottom: 45,
    height: Math.max(300, 70 + runs.length * 30),
    x: {domain: theses.map((thesis) => thesis.number), label: ui.thesisNumber},
    y: {domain: runs.map((run) => run.id), label: null, tickFormat: (id) => runLabel(runs.find((run) => run.id === id))},
    color: {domain: [ui.agree, ui.neutral, ui.disagree], range: ["#087f5b", "#896d1d", "#b3483d"], legend: true},
    marks: [
      Plot.cell(values, {x: "thesis", y: "run", fill: "label", inset: 1, tip: true, title: "detail"}),
      Plot.frame({stroke: "#637080"})
    ]
  });
  figure.style.minWidth = `${Math.max(880, 180 + theses.length * 22)}px`;
  figure.setAttribute("role", "img");
  figure.setAttribute("aria-label", ui.matrixLabel(runs.length, theses.length));

  function showPointedCell() {
    if (figure.value) show(figure.value.thesis, figure.value);
  }
  figure.addEventListener("input", showPointedCell);
  figure.addEventListener("pointerup", (event) => {
    const cell = event.target.closest?.('g[aria-label="cell"] rect');
    if (!cell) return;
    const cells = [...figure.querySelectorAll('g[aria-label="cell"] rect')];
    const value = values[cells.indexOf(cell)];
    if (value) show(value.thesis, value);
  });

  const chart = document.createElement("div");
  chart.className = "response-matrix-chart";
  chart.append(figure);
  const container = document.createElement("div");
  container.className = "response-matrix";
  container.append(card, chart);
  return container;
}
