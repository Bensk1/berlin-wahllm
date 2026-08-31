import {mkdir, rm, writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";

export const destinationOrigin = "https://wahl.ksmn.dev";
export const legacyBasePath = "/berlin-wahllm";

export function redirectTarget({pathname, search = "", hash = ""}) {
  let destinationPath = "/";
  if (pathname.startsWith(`${legacyBasePath}/`)) {
    destinationPath = pathname.slice(legacyBasePath.length);
  }
  return `${destinationOrigin}${destinationPath}${search}${hash}`;
}

export function redirectHtml() {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Berlin WahLLM ist umgezogen</title>
  <link rel="canonical" href="${destinationOrigin}/">
  <meta http-equiv="refresh" content="0; url=${destinationOrigin}/">
  <meta name="robots" content="noindex">
  <script>
    const destinationOrigin = ${JSON.stringify(destinationOrigin)};
    const legacyBasePath = ${JSON.stringify(legacyBasePath)};
    ${redirectTarget.toString()}
    location.replace(redirectTarget(window.location));
  </script>
</head>
<body>
  <main>
    <h1>Berlin WahLLM ist umgezogen</h1>
    <p>Weiter zur neuen Website: <a href="${destinationOrigin}/">${destinationOrigin}/</a></p>
  </main>
</body>
</html>
`;
}

async function main() {
  const outputDirectory = new URL("../site/dist/", import.meta.url);
  await rm(outputDirectory, {recursive: true, force: true});
  await mkdir(outputDirectory, {recursive: true});
  const html = redirectHtml();
  await Promise.all([
    writeFile(new URL("index.html", outputDirectory), html, "utf8"),
    writeFile(new URL("404.html", outputDirectory), html, "utf8")
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
