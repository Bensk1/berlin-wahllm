import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  destinationOrigin,
  redirectHtml,
  redirectTarget
} from "../../scripts/build-pages-redirect.mjs";

test("Pages-Weiterleitung erhält Sprache, Unterpfad, Query und Fragment", () => {
  assert.equal(redirectTarget({pathname: "/berlin-wahllm/"}), `${destinationOrigin}/`);
  assert.equal(redirectTarget({pathname: "/berlin-wahllm/en/"}), `${destinationOrigin}/en/`);
  assert.equal(
    redirectTarget({pathname: "/berlin-wahllm/details/model", search: "?party=SPD", hash: "#antworten"}),
    `${destinationOrigin}/details/model?party=SPD#antworten`
  );
  assert.equal(redirectTarget({pathname: "/unexpected/path"}), `${destinationOrigin}/`);
});

test("Pages-Weiterleitungsseite hat Canonical, Meta-Refresh, Skript und Ersatzlink", () => {
  const html = redirectHtml();
  assert.match(html, /rel="canonical" href="https:\/\/wahl\.ksmn\.dev\/"/);
  assert.match(html, /http-equiv="refresh" content="0; url=https:\/\/wahl\.ksmn\.dev\/"/);
  assert.match(html, /location\.replace/);
  assert.match(html, /<a href="https:\/\/wahl\.ksmn\.dev\/">/);
});

test("piku-Konfiguration hält Hostname und Secrets aus dem Repository", async () => {
  const [environment, procfile, nginx] = await Promise.all([
    readFile(new URL("../../ENV", import.meta.url), "utf8"),
    readFile(new URL("../../Procfile", import.meta.url), "utf8"),
    readFile(new URL("../../nginx.conf", import.meta.url), "utf8")
  ]);
  assert.match(environment, /^NODE_VERSION=24\.18\.0$/m);
  assert.match(environment, /^OBSERVABLE_TELEMETRY_DISABLE=true$/m);
  assert.doesNotMatch(environment, /NGINX_SERVER_NAME/);
  assert.match(procfile, /^release: npm --prefix site ci /m);
  assert.match(procfile, /^static: site\/dist$/m);
  assert.match(
    nginx,
    /^access_log \/var\/log\/nginx\/wahllm\.access\.log combined;$/m
  );
  assert.match(nginx, /if \(\$host = test\.ksmn\.dev\)/);
  assert.match(nginx, /set \$wahllm_robots_header "noindex, nofollow";/);
});

test("automatische Pages-Prüfung deployt nicht und manueller Workflow hat beide Modi", async () => {
  const [checks, publish] = await Promise.all([
    readFile(new URL("../../.github/workflows/pages.yml", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/publish-pages.yml", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(checks, /deploy-pages|upload-pages-artifact/);
  assert.match(publish, /- redirect/);
  assert.match(publish, /- legacy-site/);
  assert.match(publish, /actions\/deploy-pages@v4/);
});
