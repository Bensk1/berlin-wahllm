import {locales} from "./i18n.js";

export const percent = (value, locale = "de") => `${new Intl.NumberFormat(locales[locale].code, {maximumFractionDigits: 1}).format(value)} %`;
export const formatDate = (value, locale = "de") => new Intl.DateTimeFormat(locales[locale].code, {dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin"}).format(new Date(value));
export const runLabel = (run) => run.short_display_name || run.model;

export function visuallyHidden(text) {
  const span = document.createElement("span");
  span.className = "sr-only";
  span.textContent = text;
  return span;
}
