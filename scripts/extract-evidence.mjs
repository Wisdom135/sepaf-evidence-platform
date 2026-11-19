import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/extract-evidence.mjs <source.html>");
  process.exit(1);
}

const html = fs.readFileSync(path.resolve(inputPath), "utf8");

const namedEntities = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  middot: "·",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
};

function decode(value = "") {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name) => namedEntities[name.toLowerCase()] ?? entity);
}

function text(value = "") {
  return decode(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function get(block, expression) {
  const match = block.match(expression);
  return match ? text(match[1]) : "";
}

function getAll(block, expression) {
  return [...block.matchAll(expression)].map((match) => text(match[1])).filter(Boolean);
}

const metrics = [...html.matchAll(/<a class="tl([^"]*)" href="#([^"]+)">([\s\S]*?)<\/a>/gi)].map(
  ([, classes, target, block]) => ({
    featured: classes.includes("big"),
    target,
    value: get(block, /<b>([\s\S]*?)<\/b>/i),
    label: get(block, /<span class="h">([\s\S]*?)<\/span>/i),
    detail: get(block, /<span class="d">([\s\S]*?)<\/span>/i),
    references: get(block, /<span class="rf">([\s\S]*?)<\/span>/i),
  }),
);

const themes = [...html.matchAll(/<div class="theme" id="t-([^"]+)">([\s\S]*?)(?=<div class="theme" id="t-|<\/section>\s*<section id="said")/gi)].map(
  ([, id, block], index) => ({
    id,
    number: String(index + 1).padStart(2, "0"),
    title: get(block, /<h3 class="tt">([\s\S]*?)<\/h3>/i),
    description: get(block, /<div class="thh">[\s\S]*?<p>([\s\S]*?)<\/p>/i).replace(/\s*\d+ items?$/i, ""),
  }),
);

const allCards = [...html.matchAll(/<article class="it([^"]*)" id="([^"]+)"([^>]*)>([\s\S]*?)<\/article>/gi)].map(
  ([, classes, id, attributes, block]) => {
    const tagBlock = block.match(/<div class="tags">([\s\S]*?)<\/div>/i)?.[1] ?? "";
    const tagValues = getAll(tagBlock, /<span[^>]*>([\s\S]*?)<\/span>/gi);
    const bodyParagraphs = getAll(block, /<p>([\s\S]*?)<\/p>/gi);
    const sourceBlock = block.match(/<details class="src">([\s\S]*?)<\/details>/i)?.[1] ?? "";
    const linkedSources = [...sourceBlock.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(
      ([, url, label]) => ({ url: decode(url), label: text(label) }),
    );
    const textSources = getAll(sourceBlock, /<span[^>]*>([\s\S]*?)<\/span>/gi).map((label) => ({
      url: "",
      label,
    }));
    const sources = [...linkedSources, ...textSources];

    return {
      id,
      kind: classes.includes("sy") || id.startsWith("s") ? "quote" : "achievement",
      rank: id.startsWith("r") ? Number(id.slice(1)) : null,
      theme: attributes.match(/data-sec="([^"]*)"/i)?.[1] ?? "",
      status: tagValues[0] ?? "",
      sector: tagValues[1] ?? "",
      location: tagValues[2] ?? "",
      date: tagValues[3] ?? "",
      title: get(block, /<h3>([\s\S]*?)<\/h3>/i),
      figure: get(block, /<p class="fig">([\s\S]*?)<\/p>/i),
      description: bodyParagraphs.join(" "),
      creditedTo: get(block, /<p class="who">([\s\S]*?)<\/p>/i),
      sources,
    };
  },
);

const achievements = allCards.filter((card) => card.kind === "achievement");
const quotes = allCards.filter((card) => card.kind === "quote");

const summaryBlock = html.match(/<div class="sum">([\s\S]*?)<\/div>/i)?.[1] ?? "";
const methodology = get(html, /<p class="meth">([\s\S]*?)<\/p>/i).replace(/^How this record was compiled\.\s*/i, "");

const output = {
  meta: {
    title: "Evidence Bank",
    organization: "South-East Political Appointees Forum (SEPAF)",
    prepared: "9 November 2026",
    scope: "What President Bola Ahmed Tinubu’s administration has delivered for the South-East since May 2023.",
    summary: getAll(summaryBlock, /<li>([\s\S]*?)<\/li>/gi),
    methodology,
  },
  metrics,
  themes: themes.map((theme) => ({
    ...theme,
    count: achievements.filter((item) => item.theme === theme.id).length,
  })),
  achievements,
  quotes,
};

fs.mkdirSync(path.resolve("data"), { recursive: true });
fs.writeFileSync(path.resolve("data/evidence.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Extracted ${achievements.length} achievements, ${metrics.length} metrics and ${quotes.length} statements.`);
