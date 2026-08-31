import {readdir, readFile, writeFile} from "node:fs/promises";

const nodeModulesPath = new URL("../node_modules/", import.meta.url);
const outputPath = new URL("../src/THIRD_PARTY_NOTICES.txt", import.meta.url);
const distributedPackages = [
  "@observablehq/framework",
  "@observablehq/inputs",
  "@observablehq/inspector",
  "@observablehq/plot",
  "@observablehq/runtime",
  "binary-search-bounds",
  "d3",
  "d3-array",
  "d3-axis",
  "d3-brush",
  "d3-chord",
  "d3-color",
  "d3-contour",
  "d3-delaunay",
  "d3-dispatch",
  "d3-drag",
  "d3-dsv",
  "d3-ease",
  "d3-fetch",
  "d3-force",
  "d3-format",
  "d3-geo",
  "d3-hierarchy",
  "d3-interpolate",
  "d3-path",
  "d3-polygon",
  "d3-quadtree",
  "d3-random",
  "d3-scale",
  "d3-scale-chromatic",
  "d3-selection",
  "d3-shape",
  "d3-time",
  "d3-time-format",
  "d3-timer",
  "d3-transition",
  "d3-zoom",
  "delaunator",
  "htl",
  "internmap",
  "interval-tree-1d",
  "isoformat",
  "robust-predicates"
];

const noticeSections = [
  "Berlin WahLLM – Hinweise zu Drittsoftware",
  "",
  "Die veröffentlichte Website enthält die folgende Open-Source-Software."
];

for (const packageName of distributedPackages) {
  const packagePath = new URL(`${packageName}/`, nodeModulesPath);
  const packageMetadata = JSON.parse(
    await readFile(new URL("package.json", packagePath), "utf8")
  );
  const licenseFile = (await readdir(packagePath)).find((name) =>
    /^licen[cs]e(?:\.|$)/i.test(name)
  );
  if (!licenseFile) throw new Error(`Keine Lizenzdatei für ${packageName} gefunden.`);
  const licenseText = (await readFile(new URL(licenseFile, packagePath), "utf8")).trim();
  noticeSections.push(
    "",
    "=".repeat(72),
    `${packageName} ${packageMetadata.version}`,
    "=".repeat(72),
    "",
    licenseText
  );
}

const notices = `${noticeSections.join("\n")}\n`;
let existingNotices = null;
try {
  existingNotices = await readFile(outputPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (notices !== existingNotices) await writeFile(outputPath, notices, "utf8");
