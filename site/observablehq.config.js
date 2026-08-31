const buildTimestamp = new Date().toISOString();
const basePath = normalizeBasePath(process.env.WAHLLM_BASE_PATH ?? "/");
const siteUrl = normalizeSiteUrl(process.env.WAHLLM_SITE_URL ?? "https://wahl.ksmn.dev");
const previewImageUrl = `${siteUrl}/berlin-wahllm-preview.png`;

export function normalizeBasePath(value) {
  if (!value.startsWith("/") || !value.endsWith("/") || value.includes("//")) {
    throw new Error("WAHLLM_BASE_PATH muss mit genau einem Slash beginnen und enden.");
  }
  return value;
}

export function normalizeSiteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("WAHLLM_SITE_URL muss eine gültige HTTPS-URL ohne Query oder Fragment sein.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("WAHLLM_SITE_URL muss eine HTTPS-URL ohne Query oder Fragment sein.");
  }
  return url.href.replace(/\/+$/, "");
}

function localizedUrl(locale) {
  return locale === "en" ? `${siteUrl}/en/` : `${siteUrl}/`;
}
const pageMetadata = {
  de: {
    description: "Eine explorative, reproduzierbare Analyse der Antworten aktueller Sprachmodelle auf die 38 Thesen zur Berliner Abgeordnetenhauswahl 2026.",
    title: "Berlin WahLLM – Wie Sprachmodelle auf 38 Berliner Wahlthesen antworten",
    openGraphDescription: "38 Thesen, verschiedene Sprachmodelle: Wo ähneln sich ihre Antworten, wo widersprechen sie sich und welche Parteipositionen liegen ihnen rechnerisch am nächsten?",
    imageAlt: "Vorschaugrafik: Sieben von acht Modellläufen liegen bei SPD, Grünen oder Linken vorn; Grok bei der FDP"
  },
  en: {
    description: "An exploratory, reproducible analysis of current language models responding to the 38 theses for Berlin’s 2026 state election.",
    title: "Berlin WahLLM – How language models answer 38 Berlin election theses",
    openGraphDescription: "38 theses, different language models: where do their answers align, where do they differ, and which party positions are mathematically closest?",
    imageAlt: "Preview graphic: seven of eight model runs rank the SPD, Greens or Left first; Grok ranks the FDP first"
  }
};

export default {
  root: "src",
  output: "dist",
  base: basePath,
  title: "Berlin WahLLM",
  style: "styles.css",
  globalStylesheets: [],
  sidebar: false,
  toc: false,
  pager: false,
  footer: null,
  pages: [{name: "Überblick", path: "/"}, {name: "English", path: "/en/"}],
  head: ({path}) => {
    const locale = path === "/en/index" ? "en" : "de";
    const metadata = pageMetadata[locale];
    const canonicalUrl = localizedUrl(locale);
    return `
    <meta name="description" content="${metadata.description}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:title" content="${metadata.title}">
    <meta property="og:description" content="${metadata.openGraphDescription}">
    <meta property="og:type" content="website">
    <meta property="og:image" content="${previewImageUrl}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${metadata.imageAlt}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${previewImageUrl}">
    <meta name="twitter:image:alt" content="${metadata.imageAlt}">
    <meta name="site-build-timestamp" content="${buildTimestamp}">
    <link rel="alternate" hreflang="de" href="${siteUrl}/">
    <link rel="alternate" hreflang="en" href="${siteUrl}/en/">
    <link rel="alternate" hreflang="x-default" href="${siteUrl}/">
  `;
  }
};
