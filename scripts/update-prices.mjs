import { readFile, writeFile } from "node:fs/promises";
import { editorial } from "../src/data/editorial.js";

const API = "https://models.dev/api.json";
const pricesUrl = new URL("../src/data/prices.json", import.meta.url);
const releasesUrl = new URL("../src/data/releases.json", import.meta.url);
const digestUrl = new URL("../src/data/digest.json", import.meta.url);

const WATCH_PROVIDERS = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  deepseek: "DeepSeek",
  xai: "xAI",
  meta: "Meta",
  zai: "Z.ai",
  moonshotai: "Moonshot",
  alibaba: "Alibaba",
  minimax: "MiniMax",
  mistral: "Mistral",
};

const RELEASES_DAYS = 120;
const MAX_RELEASES = 24;

const response = await fetch(API);
if (!response.ok) {
  throw new Error(`models.dev responded with ${response.status}`);
}
const catalog = await response.json();

let existing = { updated: null, models: {} };
try {
  existing = JSON.parse(await readFile(pricesUrl, "utf8"));
} catch {}

const models = { ...existing.models };
const missing = [];
const priceChanges = [];

for (const model of editorial) {
  const [providerId, modelId] = model.source.split("/");
  const entry = catalog?.[providerId]?.models?.[modelId];

  if (!entry) {
    missing.push(model.name);
    continue;
  }

  const next = {};
  if (typeof entry.cost?.input === "number") next.input = entry.cost.input;
  if (typeof entry.cost?.output === "number") next.output = entry.cost.output;
  if (typeof entry.cost?.cache_read === "number")
    next.cacheRead = entry.cost.cache_read;
  if (typeof entry.limit?.context === "number") next.context = entry.limit.context;
  if (typeof entry.limit?.output === "number") next.maxOutput = entry.limit.output;
  if (entry.release_date) next.released = entry.release_date;

  const previous = existing.models?.[model.source];
  for (const field of ["input", "output", "context"]) {
    const before = previous?.[field];
    const after = next[field];
    if (
      typeof before === "number" &&
      typeof after === "number" &&
      before !== after
    ) {
      priceChanges.push({ name: model.name, field, from: before, to: after });
    }
  }

  models[model.source] = { ...models[model.source], ...next };
}

const updated = new Date().toISOString().slice(0, 10);

await writeFile(pricesUrl, JSON.stringify({ updated, models }, null, 2) + "\n");

const trackedSources = new Set(editorial.map((model) => model.source));
const cutoff = Date.now() - RELEASES_DAYS * 24 * 60 * 60 * 1000;
const byName = new Map();

for (const [providerId, providerName] of Object.entries(WATCH_PROVIDERS)) {
  const providerModels = catalog?.[providerId]?.models ?? {};
  for (const [modelId, entry] of Object.entries(providerModels)) {
    if (!entry?.release_date) continue;
    const released = new Date(entry.release_date).getTime();
    if (!Number.isFinite(released) || released < cutoff) continue;
    if (
      typeof entry.cost?.input !== "number" ||
      typeof entry.cost?.output !== "number"
    )
      continue;

    const source = `${providerId}/${modelId}`;
    const release = {
      name: entry.name ?? modelId,
      provider: providerName,
      source,
      input: entry.cost.input,
      output: entry.cost.output,
      context: entry.limit?.context ?? null,
      released: entry.release_date,
      tracked: trackedSources.has(source),
    };

    const existing = byName.get(release.name);
    if (!existing || (release.tracked && !existing.tracked)) {
      byName.set(release.name, release);
    }
  }
}

const releases = [...byName.values()]
  .sort((a, b) => b.released.localeCompare(a.released))
  .slice(0, MAX_RELEASES);

await writeFile(
  releasesUrl,
  JSON.stringify({ updated, releases }, null, 2) + "\n"
);

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const newReleases = releases.filter((release) => release.released >= yesterday);

await writeFile(
  digestUrl,
  JSON.stringify(
    { updated, priceChanges, newReleases, pickChanges: [] },
    null,
    2
  ) + "\n"
);

console.log(
  `Updated ${editorial.length - missing.length}/${editorial.length} models from models.dev`
);
console.log(
  `Tracked ${releases.length} recent releases across ${Object.keys(WATCH_PROVIDERS).length} labs`
);
console.log(
  `Digest: ${priceChanges.length} price changes, ${newReleases.length} new releases in the last day`
);
if (missing.length) {
  console.warn(`No data found for: ${missing.join(", ")}`);
}
