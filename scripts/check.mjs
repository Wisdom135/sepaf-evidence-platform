import fs from "node:fs";

const requiredFiles = ["index.html", "styles.css", "app.js", "data/evidence.json", "dev-server.mjs"];
const missing = requiredFiles.filter((file) => !fs.existsSync(file));

if (missing.length) {
  console.error(`Missing required files: ${missing.join(", ")}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync("data/evidence.json", "utf8"));
const errors = [];

if (data.achievements.length !== 94) errors.push(`Expected 94 achievements; found ${data.achievements.length}.`);
if (data.themes.length !== 9) errors.push(`Expected 9 themes; found ${data.themes.length}.`);
if (data.metrics.length !== 10) errors.push(`Expected 10 metrics; found ${data.metrics.length}.`);
if (data.quotes.length !== 10) errors.push(`Expected 10 statements; found ${data.quotes.length}.`);

const missingSources = data.achievements.filter((item) => item.sources.length === 0).map((item) => item.id);
if (missingSources.length) errors.push(`Achievements without sources: ${missingSources.join(", ")}.`);

const duplicateIds = data.achievements
  .map((item) => item.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);
if (duplicateIds.length) errors.push(`Duplicate achievement IDs: ${duplicateIds.join(", ")}.`);

if (errors.length) {
  errors.forEach((error) => console.error(error));
  process.exit(1);
}

console.log(`Validated ${data.achievements.length} achievements, ${data.themes.length} themes, ${data.metrics.length} metrics and ${data.quotes.length} statements.`);
