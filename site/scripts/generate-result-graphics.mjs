import {readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import sharp from "sharp";
import {heroResultData} from "../src/components/hero-result.js";

const results = JSON.parse(await readFile(new URL("../src/data/results.json", import.meta.url), "utf8"));
const modelResults = heroResultData(results.models);

const locales = {
  de: {
    file: "berlin-wahllm-ergebnis",
    eyebrow: "WEN WÜRDE KI WÄHLEN?",
    headline: ["7 von 8 Modellen:", "Grüne oder Linke", "Grok: AfD (rechtsaußen)"],
    subhead: "Höchste mittlere Übereinstimmung je Modell",
    exception: null,
    footer: [
      "38 Wahl-O-Mat-Thesen · 15 Wiederholungen je Modell",
      "Parteien im Vergleich:",
      "CDU, SPD, Grüne, Die Linke, AfD",
      "Alle derzeit im Berliner Abgeordnetenhaus vertreten"
    ],
    source: null,
    decimal: ",",
    showDots: false
  },
  en: {
    file: "berlin-wahllm-result-en",
    eyebrow: "WHO WOULD AI VOTE FOR?",
    headline: ["7 of 8 models:", "Greens or The Left", "Grok: AfD (far right)"],
    subhead: "Highest mean agreement for each model",
    exception: null,
    footer: [
      "38 Wahl-O-Mat theses · 15 repetitions per model",
      "Parties included in the comparison:",
      "CDU, SPD, Greens, The Left, AfD",
      "All currently represented in Berlin’s parliament"
    ],
    source: null,
    decimal: ".",
    showDots: false
  }
};

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function splitModelName(name) {
  const splits = new Map([
    ["Gemini 3.5 Flash-Lite", ["Gemini 3.5", "Flash-Lite"]],
    ["ChatGPT-5.6 Terra", ["ChatGPT-5.6", "Terra"]],
    ["Claude Sonnet 4.6", ["Claude Sonnet", "4.6"]],
    ["Grok 4.5", ["Grok 4.5", ""]],
    ["Gemma 4 26B", ["Gemma 4", "26B"]],
    ["GLM 5.3 Flash", ["GLM 5.3", "Flash"]],
    ["Kimi K3", ["Kimi K3", ""]],
    ["Mistral Medium 3.5", ["Mistral Medium", "3.5"]]
  ]);
  return splits.get(name) ?? [name, ""];
}

function renderCard(result, index, ui) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const x = 606 + column * 190;
  const y = 112 + row * 174;
  const exception = result.exception;
  const [firstLine, secondLine] = splitModelName(result.model);
  const partyColor = exception ? "#a84616" : result.party === "Die Linke" ? "#8f2862" : "#087358";
  const background = exception ? "#fff5ee" : "#f7fbfa";
  const stroke = exception ? "#d5926d" : "#b8d3cc";
  const value = result.value.toFixed(1).replace(".", ui.decimal);
  const party = ui === locales.en
    ? new Map([["Grüne", "Greens"], ["Die Linke", "The Left"]]).get(result.party) ?? result.party
    : result.party;
  return `
    <g transform="translate(${x} ${y})">
      <rect width="178" height="160" rx="14" fill="${background}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="24" cy="25" r="7" fill="${partyColor}"/>
      ${exception && ui.exception ? `<text x="41" y="31" class="exception">${ui.exception}</text>` : ""}
      <text x="18" y="62" class="model">${escapeXml(firstLine)}</text>
      ${secondLine ? `<text x="18" y="84" class="model">${escapeXml(secondLine)}</text>` : ""}
      <text x="18" y="122" class="party" fill="${partyColor}">${escapeXml(party)}</text>
      <text x="18" y="146" class="value">${value} %</text>
    </g>`;
}

function renderSvg(locale) {
  const ui = locales[locale];
  const cards = modelResults.map((result, index) => renderCard(result, index, ui)).join("");
  const redesigned = ui.headline.length === 3;
  const headlineStart = redesigned ? 154 : 169;
  const headlineGap = redesigned ? 47 : 51;
  const headline = ui.headline.map((line, index) => {
    const className = index === 0 ? "headline" : index === 2 ? "contrast" : "accent";
    return `<text x="78" y="${headlineStart + index * headlineGap}" class="${className}">${escapeXml(line)}</text>`;
  }).join("\n  ");
  const subheadY = redesigned ? 302 : 266;
  const dividerY = redesigned ? 350 : 381;
  const footerStart = redesigned ? 384 : 407;
  const footerGap = redesigned ? 31 : 30;
  const footer = ui.footer.map((line, index) =>
    `<text x="78" y="${footerStart + index * footerGap}" class="footer">${escapeXml(line)}</text>`
  ).join("\n  ");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2880" height="1120" viewBox="0 0 1440 560" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(ui.headline.join(" "))}</title>
  <desc id="description">${escapeXml(ui.footer.join(" · "))}</desc>
  <rect width="1440" height="560" fill="#f3f8fa"/>
  <circle cx="1390" cy="10" r="210" fill="#d9ebef"/>
  <circle cx="1370" cy="545" r="130" fill="#f3e1d5"/>
  <rect x="28" y="28" width="1384" height="504" rx="22" fill="#ffffff" stroke="#b9c5ce" stroke-width="2"/>
  <rect x="28" y="28" width="10" height="504" rx="5" fill="#075b71"/>
  <style>
    text { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .eyebrow { fill: #075b71; font-size: 17px; font-weight: 800; letter-spacing: 1.1px; }
    .headline { fill: #17212b; font-size: 42px; font-weight: 780; letter-spacing: -1px; }
    .accent { fill: #075b71; font-size: 42px; font-weight: 780; letter-spacing: -1px; }
    .contrast { fill: #b55117; font-size: 42px; font-weight: 780; letter-spacing: -1px; }
    .subhead { fill: #51606f; font-size: 19px; }
    .model { fill: #334452; font-size: 17px; font-weight: 700; }
    .party { font-size: 23px; font-weight: 800; }
    .value { fill: #51606f; font-size: 17px; font-weight: 650; }
    .exception { fill: #8d441c; font-size: 11px; font-weight: 850; letter-spacing: .8px; }
    .footer { fill: #51606f; font-size: 16px; }
  </style>
  <text x="78" y="91" class="eyebrow">${escapeXml(ui.eyebrow)}</text>
  ${headline}
  <text x="78" y="${subheadY}" class="subhead">${escapeXml(ui.subhead)}</text>
  ${ui.showDots ? `<g transform="translate(78 309)">
    <circle cx="13" cy="13" r="13" fill="#087358"/>
    <circle cx="50" cy="13" r="13" fill="#087358"/>
    <circle cx="87" cy="13" r="13" fill="#087358"/>
    <circle cx="124" cy="13" r="13" fill="#087358"/>
    <circle cx="161" cy="13" r="13" fill="#087358"/>
    <circle cx="198" cy="13" r="13" fill="#087358"/>
    <circle cx="235" cy="13" r="13" fill="#087358"/>
    <circle cx="291" cy="13" r="13" fill="#b55117"/>
  </g>` : ""}
  <line x1="78" y1="${dividerY}" x2="538" y2="${dividerY}" stroke="#b9c5ce" stroke-width="2"/>
  ${footer}
  ${ui.source ? `<text x="78" y="477" class="footer">${escapeXml(ui.source)}</text>` : ""}
  ${cards}
</svg>
`;
  return svg.replace(/[ \t]+$/gm, "");
}

function renderLinkedInCard(result, index) {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const x = 90 + column * 460;
  const y = 414 + row * 174;
  const partyColor = result.exception ? "#a84616" : result.party === "Die Linke" ? "#8f2862" : "#087358";
  const background = result.exception ? "#fff5ee" : "#f7fbfa";
  const stroke = result.exception ? "#d5926d" : "#b8d3cc";
  const party = new Map([["Grüne", "Greens"], ["Die Linke", "The Left"]]).get(result.party) ?? result.party;
  return `
    <g transform="translate(${x} ${y})">
      <rect width="440" height="158" rx="18" fill="${background}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="28" cy="31" r="8" fill="${partyColor}"/>
      <text x="50" y="39" class="linkedin-model">${escapeXml(result.model)}</text>
      <text x="24" y="101" class="linkedin-party" fill="${partyColor}">${escapeXml(party)}</text>
      <text x="24" y="137" class="linkedin-value">${result.value.toFixed(1)}%</text>
    </g>`;
}

function renderLinkedInSvg() {
  const cards = modelResults.map(renderLinkedInCard).join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-labelledby="title description">
  <title id="title">How do AI models align politically? 7 of 8 models: Greens or The Left. Grok: AfD (far right).</title>
  <desc id="description">Highest mean agreement with a party across 38 Wahl-O-Mat Berlin questions and 15 repetitions per model.</desc>
  <rect width="1080" height="1350" fill="#f3f8fa"/>
  <circle cx="1032" cy="34" r="205" fill="#d9ebef"/>
  <circle cx="1020" cy="1302" r="145" fill="#f3e1d5"/>
  <rect x="38" y="38" width="1004" height="1274" rx="28" fill="#ffffff" stroke="#b9c5ce" stroke-width="2"/>
  <rect x="38" y="38" width="12" height="1274" rx="6" fill="#075b71"/>
  <style>
    text { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .linkedin-eyebrow { fill: #075b71; font-size: 34px; font-weight: 800; letter-spacing: .8px; }
    .linkedin-headline { fill: #17212b; font-size: 57px; font-weight: 780; letter-spacing: -1.2px; }
    .linkedin-accent { fill: #075b71; font-size: 63px; font-weight: 780; letter-spacing: -1.4px; }
    .linkedin-contrast { fill: #b55117; font-size: 50px; font-weight: 780; letter-spacing: -1px; }
    .linkedin-subhead { fill: #51606f; font-size: 25px; }
    .linkedin-model { fill: #334452; font-size: 27px; font-weight: 700; }
    .linkedin-party { font-size: 39px; font-weight: 800; }
    .linkedin-value { fill: #51606f; font-size: 28px; font-weight: 650; }
    .linkedin-footer { fill: #51606f; font-size: 23px; }
    .linkedin-source { fill: #075b71; font-size: 29px; font-weight: 800; letter-spacing: .2px; }
  </style>
  <text x="90" y="112" class="linkedin-eyebrow">HOW DO AI MODELS ALIGN POLITICALLY?</text>
  <text x="90" y="188" class="linkedin-headline">7 of 8 models:</text>
  <text x="90" y="254" class="linkedin-accent">Greens or The Left</text>
  <text x="90" y="318" class="linkedin-contrast">Grok:<tspan dx="10">AfD (far right)</tspan></text>
  <text x="90" y="371" class="linkedin-subhead">Highest mean agreement with a party</text>
  ${cards}
  <line x1="90" y1="1124" x2="990" y2="1124" stroke="#b9c5ce" stroke-width="2"/>
  <text x="90" y="1167" class="linkedin-footer">38 Wahl-O-Mat Berlin questions · 15 repetitions per model</text>
  <text x="90" y="1203" class="linkedin-footer">Parties compared: CDU · SPD · Greens · The Left · AfD</text>
  <text x="90" y="1270" class="linkedin-source">wahl.ksmn.dev</text>
</svg>
`;
  return svg.replace(/[ \t]+$/gm, "");
}

for (const [locale, ui] of Object.entries(locales)) {
  const svg = renderSvg(locale);
  await Promise.all([
    writeFile(new URL(`../src/assets/${ui.file}.svg`, import.meta.url), svg, "utf8"),
    sharp(Buffer.from(svg)).png({compressionLevel: 9}).toFile(
      fileURLToPath(new URL(`../src/assets/${ui.file}.png`, import.meta.url))
    )
  ]);
}

const linkedInSvg = renderLinkedInSvg();
await Promise.all([
  writeFile(new URL("../src/assets/berlin-wahllm-result-en-linkedin.svg", import.meta.url), linkedInSvg, "utf8"),
  sharp(Buffer.from(linkedInSvg)).png({compressionLevel: 9}).toFile(
    fileURLToPath(new URL("../src/assets/berlin-wahllm-result-en-linkedin.png", import.meta.url))
  )
]);

const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#f3f8fa"/>
  <rect x="10" y="10" width="12" height="12" rx="3" fill="#075b71"/>
  <rect x="26" y="10" width="12" height="12" rx="3" fill="#2d7888"/>
  <rect x="42" y="10" width="12" height="12" rx="3" fill="#6da2ad"/>
  <rect x="10" y="26" width="12" height="12" rx="3" fill="#8f2862"/>
  <rect x="26" y="26" width="12" height="12" rx="3" fill="#d9ebef"/>
  <rect x="42" y="26" width="12" height="12" rx="3" fill="#087358"/>
  <rect x="10" y="42" width="12" height="12" rx="3" fill="#51606f"/>
  <rect x="26" y="42" width="12" height="12" rx="3" fill="#b9c5ce"/>
  <rect x="42" y="42" width="12" height="12" rx="3" fill="#b55117"/>
</svg>`;
const faviconSizes = [16, 32, 48, 64];
const faviconImages = await Promise.all(faviconSizes.map((size) =>
  sharp(Buffer.from(faviconSvg)).resize(size, size).png({compressionLevel: 9}).toBuffer()
));
const faviconHeaderSize = 6 + faviconImages.length * 16;
const faviconHeader = Buffer.alloc(faviconHeaderSize);
faviconHeader.writeUInt16LE(1, 2);
faviconHeader.writeUInt16LE(faviconImages.length, 4);
let faviconOffset = faviconHeaderSize;
for (const [index, image] of faviconImages.entries()) {
  const entryOffset = 6 + index * 16;
  faviconHeader.writeUInt8(faviconSizes[index], entryOffset);
  faviconHeader.writeUInt8(faviconSizes[index], entryOffset + 1);
  faviconHeader.writeUInt16LE(1, entryOffset + 4);
  faviconHeader.writeUInt16LE(32, entryOffset + 6);
  faviconHeader.writeUInt32LE(image.length, entryOffset + 8);
  faviconHeader.writeUInt32LE(faviconOffset, entryOffset + 12);
  faviconOffset += image.length;
}
await writeFile(
  new URL("../src/favicon.ico", import.meta.url),
  Buffer.concat([faviconHeader, ...faviconImages])
);
