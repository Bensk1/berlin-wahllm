import {partyLabel, winners} from "./focus.js";
import {runLabel} from "./lib.js";
import {percent} from "./lib.js";
import {text} from "./i18n.js";

export function winnerCards(runs, parties, locale = "de") {
  const ui = text(locale);
  const container = document.createElement("div");
  container.className = "winner-grid";
  for (const run of runs) {
    const card = document.createElement("article");
    card.className = "winner-card";
    const heading = document.createElement("h3");
    heading.textContent = runLabel(run);
    const result = document.createElement("p");
    result.className = "winner-party";
    const leadingAgreements = winners(run, parties);
    const partyNames = document.createElement("span");
    partyNames.textContent = leadingAgreements.map((agreement) => partyLabel(agreement.party)).join(" und ");
    const agreement = document.createElement("span");
    agreement.className = "winner-agreement";
    agreement.textContent = ` (${percent(leadingAgreements[0].percentage, locale)} ${ui.agreement.toLowerCase()})`;
    result.append(partyNames, agreement);
    card.append(heading, result);
    container.append(card);
  }
  return container;
}
