import {copyFile, readdir, readFile, writeFile} from "node:fs/promises";

const outputPaths = [
  {path: new URL("../dist/index.html", import.meta.url), locale: "de"},
  {path: new URL("../dist/en/index.html", import.meta.url), locale: "en"}
];
const distributedFilesPath = new URL("../dist/_file/", import.meta.url);
const distributedModulesPath = new URL("../dist/_node/", import.meta.url);
const nodeModulesPath = new URL("../node_modules/", import.meta.url);
const defaultViewport = "width=device-width, initial-scale=1, maximum-scale=1";

await copyFile(
  new URL("../../figures/berlin-wahllm-preview.png", import.meta.url),
  new URL("../dist/berlin-wahllm-preview.png", import.meta.url)
);

for (const {path, locale} of outputPaths) {
  const html = await readFile(path, "utf8");
  if (!html.includes("<html>") || !html.includes(defaultViewport)) {
    throw new Error("Das gebaute HTML entspricht nicht der erwarteten Grundstruktur.");
  }
  const localizedHtml = locale === "en"
    ? html
      .replace("<html>", '<html lang="en">')
      .replace(defaultViewport, "width=device-width, initial-scale=1")
    : html.replace("<html>", '<html lang="de">').replace(defaultViewport, "width=device-width, initial-scale=1");
  await writeFile(path, localizedHtml, "utf8");
}

const distributedPackages = new Set([
  "@observablehq/framework",
  "@observablehq/inspector",
  "@observablehq/runtime"
]);

for (const entry of await readdir(distributedModulesPath, {withFileTypes: true})) {
  if (entry.name.startsWith("@")) {
    const scopePath = new URL(`${entry.name}/`, distributedModulesPath);
    for (const packageEntry of await readdir(scopePath, {withFileTypes: true})) {
      const packageName = packageEntry.name.slice(0, packageEntry.name.lastIndexOf("@"));
      distributedPackages.add(`${entry.name}/${packageName}`);
    }
  } else {
    distributedPackages.add(entry.name.slice(0, entry.name.lastIndexOf("@")));
  }
}

const noticesFile = (await readdir(distributedFilesPath)).find((name) =>
  /^THIRD_PARTY_NOTICES\.[a-f0-9]+\.txt$/.test(name)
);
if (!noticesFile) throw new Error("Die Hinweise zu Drittsoftware fehlen im Website-Build.");
const notices = await readFile(new URL(noticesFile, distributedFilesPath), "utf8");
for (const packageName of [...distributedPackages].sort()) {
  const packagePath = new URL(`${packageName}/`, nodeModulesPath);
  const packageMetadata = JSON.parse(
    await readFile(new URL("package.json", packagePath), "utf8")
  );
  if (!notices.includes(`${packageName} ${packageMetadata.version}\n`)) {
    throw new Error(`Lizenzhinweis für ${packageName} ${packageMetadata.version} fehlt.`);
  }
}
