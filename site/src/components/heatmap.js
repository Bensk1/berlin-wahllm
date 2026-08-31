import * as Plot from "@observablehq/plot";
import {percent, runLabel, visuallyHidden} from "./lib.js";
import {text} from "./i18n.js";
import {heatmapValues, partyLabel, sortParties} from "./focus.js";

const cellSize = 28;
const marginLeft = 110;
const marginRight = 20;
const marginTop = 20;
const marginBottom = 110;

const agreementColorDomain = [0, 40, 60, 70, 80, 90, 100];
const agreementColorRange = ["#e9edf2", "#d7e7eb", "#b4d6df", "#7fb8c6", "#438fa3", "#075b71", "#003d50"];

export function heatmap({runs, parties, onSelect, locale = "de"}) {
  const ui = text(locale);
  const sortedParties = sortParties(parties);
  const values = heatmapValues(runs, sortedParties).map((value) => ({
    ...value,
    detail: `${runLabel(value.run)}; ${partyLabel(value.party)}; ${percent(value.percentage, locale)}`
  }));
  const figure = Plot.plot({
    width: marginLeft + sortedParties.length * cellSize + marginRight,
    height: marginTop + runs.length * cellSize + marginBottom,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    x: {domain: sortedParties, label: null, tickRotate: -50, tickFormat: partyLabel},
    y: {domain: runs.map((run) => run.id), label: null, tickFormat: (id) => runLabel(runs.find((run) => run.id === id))},
    color: {
      type: "linear",
      domain: agreementColorDomain,
      range: agreementColorRange,
      legend: true,
      label: ui.agreementPercent,
      height: 56,
      marginLeft: 12,
      marginRight: 12,
      marginBottom: 22
    },
    marks: [
      Plot.cell(values, {x: "party", y: "runId", fill: "percentage", inset: 1, tip: true, title: (value) => value.detail}),
      Plot.frame({stroke: "#637080"})
    ]
  });
  figure.setAttribute("role", "img");
  figure.setAttribute("aria-label", ui.heatmapLabel(runs.length, parties.length));

  const container = document.createElement("div");
  container.className = "chart-with-controls";
  container.append(figure, visuallyHidden(ui.heatmapHelp));
  const choices = document.createElement("div");
  choices.className = "run-choices";
  for (const run of runs) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${ui.details}: ${runLabel(run)}`;
    button.addEventListener("click", () => onSelect(run.id));
    choices.append(button);
  }
  container.append(choices);
  return container;
}
