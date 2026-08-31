import * as Plot from "@observablehq/plot";
import {accessLabel, formatDate, percent, runLabel} from "./lib.js";
import {partyLabel} from "./focus.js";
import {text} from "./i18n.js";

const comparisonColors = ["#c94c4c", "#8b5fbf", "#d88727"];
const comparisonSymbols = ["square", "diamond", "triangle"];

export function vendorMetadataLabel(vendor, locale = "de") {
  return vendor === "GLM" ? text(locale).modelFamily : text(locale).vendor;
}

export function comparisonRunIds(selectedIds, mainRunId) {
  return [...new Set(selectedIds)].filter((id) => id !== mainRunId).slice(0, 3);
}

export function comparisonSelector({runs, mainInput, locale = "de"}) {
  const ui = text(locale);
  let selectedIds = [];
  const container = document.createElement("div");
  container.className = "comparison-selector";
  container.value = selectedIds;
  const label = document.createElement("label");
  label.textContent = ui.comparisonModel;
  const select = document.createElement("select");
  select.setAttribute("aria-label", ui.comparisonModel);
  const addOption = document.createElement("option");
  addOption.value = "";
  addOption.textContent = ui.selectComparisonModel;
  select.append(addOption);
  const chips = document.createElement("div");
  chips.className = "comparison-chips";
  label.append(select);
  container.append(label, chips);

  const emit = () => {
    selectedIds = comparisonRunIds(selectedIds, mainInput.value);
    container.value = selectedIds;
    render();
    container.dispatchEvent(new Event("input", {bubbles: true}));
  };
  const render = () => {
    select.replaceChildren(addOption);
    const mainId = mainInput.value;
    for (const run of runs) {
      if (run.id === mainId || selectedIds.includes(run.id)) continue;
      const option = document.createElement("option");
      option.value = run.id;
      option.textContent = runLabel(run);
      select.append(option);
    }
    select.disabled = selectedIds.length >= 3;
    chips.replaceChildren();
    for (const id of selectedIds) {
      const run = runs.find((candidate) => candidate.id === id);
      if (!run) continue;
      const chip = document.createElement("span");
      chip.className = "comparison-chip";
      chip.textContent = runLabel(run);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", ui.removeComparison(runLabel(run)));
      remove.addEventListener("click", () => { selectedIds = selectedIds.filter((candidate) => candidate !== id); emit(); });
      chip.append(remove);
      chips.append(chip);
    }
  };
  select.addEventListener("change", () => {
    if (select.value) { selectedIds = [...selectedIds, select.value]; emit(); }
  });
  mainInput.addEventListener("input", emit);
  render();
  return container;
}

export function detailControls(mainInput, comparisonInput) {
  const controls = document.createElement("div");
  controls.className = "detail-controls";
  controls.value = {selectedRunId: mainInput.value, comparisonRunIds: comparisonInput.value};
  const update = (event) => {
    event.stopPropagation();
    controls.value = {selectedRunId: mainInput.value, comparisonRunIds: comparisonInput.value};
    controls.dispatchEvent(new Event("input", {bubbles: true}));
  };
  mainInput.addEventListener("input", update);
  comparisonInput.addEventListener("input", update);
  controls.append(mainInput, comparisonInput);
  return controls;
}

export function modelRanking(run, parties, locale = "de", comparisonRuns = []) {
  const ui = text(locale);
  const partyIndex = new Map(parties.map((party, index) => [party, index]));
  const visibleParties = new Set(parties);
  const values = run.agreements.filter((agreement) => visibleParties.has(agreement.party)).sort((left, right) => right.percentage - left.percentage || partyIndex.get(left.party) - partyIndex.get(right.party));
  const series = [run, ...comparisonRuns];
  const offsets = [0, -5, 5, 0];
  const chartValues = series.flatMap((model, seriesIndex) => model.agreements
    .filter((agreement) => visibleParties.has(agreement.party))
    .map((agreement) => ({...agreement, model, modelLabel: runLabel(model)})));
  const figure = Plot.plot({
    marginLeft: 135,
    height: Math.max(300, values.length * 24 + 70),
    x: {domain: [0, 100], grid: true, label: ui.agreementPercent},
    y: {domain: values.map((value) => value.party), label: null, tickFormat: partyLabel},
    marks: [
      Plot.ruleX([0], {stroke: "#637080"}),
      ...series.map((model, seriesIndex) => Plot.dot(chartValues.filter((value) => value.model.id === model.id), {x: "percentage", y: "party", r: 6, fill: seriesIndex === 0 ? "#075b71" : comparisonColors[seriesIndex - 1], symbol: seriesIndex === 0 ? "circle" : comparisonSymbols[seriesIndex - 1], dx: offsets[seriesIndex], tip: true, title: (value) => `${value.modelLabel}; ${partyLabel(value.party)}; ${percent(value.percentage, locale)}`}))
    ]
  });
  figure.setAttribute("role", "img");
  figure.setAttribute("aria-label", ui.chartLabel(runLabel(run), comparisonRuns.length));
  const section = document.createElement("div");
  section.className = "model-detail";
  const metadata = document.createElement("dl");
  metadata.className = "metadata";
  const items = [[ui.model, run.display_name || run.model], [vendorMetadataLabel(run.vendor, locale), run.vendor], [ui.observedAt, formatDate(run.observed_at, locale)], [ui.access, accessLabel(run.anonymous, locale)], [ui.note, run.note || ui.noNote]];
  for (const [term, description] of items) {
    const item = document.createElement("div");
    item.className = "metadata-item";
    const dt = document.createElement("dt"); dt.textContent = term;
    const dd = document.createElement("dd"); dd.textContent = description;
    item.append(dt, dd);
    metadata.append(item);
  }
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = ui.showTable;
  const wrapper = document.createElement("div");
  wrapper.className = "table-scroll";
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = ui.agreementFor(runLabel(run));
  const head = document.createElement("thead");
  head.innerHTML = `<tr><th scope="col">${ui.party}</th><th scope="col">${ui.agreement}</th></tr>`;
  const body = document.createElement("tbody");
  for (const value of values) {
    const row = document.createElement("tr");
    const party = document.createElement("td");
    const percentage = document.createElement("td");
    party.textContent = partyLabel(value.party);
    percentage.textContent = percent(value.percentage, locale);
    row.append(party, percentage);
    body.append(row);
  }
  table.append(caption, head, body);
  wrapper.append(table);
  details.append(summary, wrapper);
  const legend = document.createElement("div");
  legend.className = "comparison-legend";
  legend.setAttribute("aria-label", ui.comparisonLegend);
  for (const [index, model] of series.entries()) {
    const item = document.createElement("span");
    const markers = ["●", "■", "◆", "▲"];
    item.innerHTML = `<span class="legend-marker" style="color:${index === 0 ? "#075b71" : comparisonColors[index - 1]}" aria-hidden="true">${markers[index]}</span> `;
    item.append(document.createTextNode(runLabel(model)));
    legend.append(item);
  }
  section.append(metadata, legend, figure, details);
  return section;
}
