import { readFile, writeFile } from "node:fs/promises";
import { editorial } from "../src/data/editorial.js";
import {
  DEFAULT_MODEL,
  FALLBACK_MODELS,
  generateGeminiJson,
} from "../src/lib/gemini.js";

const pricesUrl = new URL("../src/data/prices.json", import.meta.url);
const insightsUrl = new URL("../src/data/insights.json", import.meta.url);
const digestUrl = new URL("../src/data/digest.json", import.meta.url);

const CATEGORIES = [
  "Best for coding",
  "Cheapest",
  "Best value",
  "Best for reasoning",
  "Best for long context",
  "Best free option",
];

const SYSTEM_PROMPT =
  "You are the analysis engine for ModelVerse, a site tracking AI model prices.";

const priceData = JSON.parse(await readFile(pricesUrl, "utf8"));
const prices = priceData.models ?? {};
const catalog = editorial.map((model) => ({
  ...model,
  ...(prices[model.source] ?? {}),
}));

let previousPicks = [];
try {
  previousPicks = JSON.parse(await readFile(insightsUrl, "utf8")).picks ?? [];
} catch {
  previousPicks = [];
}

const combined = (model) => model.input + model.output;
const cheapest = [...catalog].sort((a, b) => combined(a) - combined(b))[0];
const cheapestLongContext = [...catalog]
  .filter((model) => model.context >= 1000000 && model.name !== cheapest.name)
  .sort((a, b) => combined(a) - combined(b))[0];

const fallbackPicks = [
  {
    category: "Best for coding",
    model: catalog.find((model) => model.tag === "best for code")?.name ?? catalog[0].name,
    reason: "Editorial pick for code quality.",
  },
  {
    category: "Cheapest",
    model: cheapest.name,
    reason: `$${combined(cheapest)} per 1M combined.`,
  },
  {
    category: "Best value",
    model: catalog.find((model) => model.tag === "best value")?.name ?? cheapest.name,
    reason: "Editorial pick for quality per dollar.",
  },
  {
    category: "Best for reasoning",
    model: catalog.find((model) => model.tags.includes("reasoning"))?.name ?? cheapest.name,
    reason: "Tagged for reasoning.",
  },
  {
    category: "Best for long context",
    model: cheapestLongContext?.name ?? cheapest.name,
    reason: "1M context at a low combined price.",
  },
  {
    category: "Best free option",
    model: catalog.find((model) => model.tag === "free tier")?.name ?? cheapest.name,
    reason: "Free tier available.",
  },
];

function buildPrompt() {
  const list = catalog.map((model) => ({
    name: model.name,
    provider: model.provider,
    inputPerMillion: model.input,
    outputPerMillion: model.output,
    context: model.context,
    useFor: model.useFor,
    skip: model.skip,
  }));

  return [
    "Pick the single best model for each category from this catalog.",
    "",
    "Catalog (prices in USD per 1M tokens):",
    JSON.stringify(list),
    "",
    `Categories (use these exact names): ${CATEGORIES.join(", ")}.`,
    "",
    "Rules:",
    "- The model must be one from the catalog.",
    "- Reasons must be one short sentence, concrete, and mention a price or a spec.",
    '- "Cheapest" must be the lowest combined input plus output price.',
    '- "Best value" means best quality per dollar, not simply the cheapest.',
    '- "Best free option" means the model most likely to have a usable free tier.',
    "Reply with JSON only, exactly this shape:",
    '{"picks":[{"category":"...","model":"...","reason":"..."}]}',
  ].join("\n");
}

async function analyzeWithAi(apiKey) {
  const names = new Set(catalog.map((model) => model.name));
  const result = await generateGeminiJson({
    prompt: buildPrompt(),
    apiKey,
    system: SYSTEM_PROMPT,
    models: [process.env.GEMINI_MODEL || DEFAULT_MODEL, ...FALLBACK_MODELS],
  });

  const valid = result.data?.picks?.filter(
    (pick) => CATEGORIES.includes(pick?.category) && names.has(pick?.model)
  );

  if (!valid?.length) return null;

  const byCategory = new Map(
    valid.map((pick) => [
      pick.category,
      {
        category: pick.category,
        model: String(pick.model),
        reason: String(pick.reason ?? "").slice(0, 160),
      },
    ])
  );

  return CATEGORIES.map((category) => byCategory.get(category)).filter(Boolean);
}

const apiKey = process.env.GEMINI_API_KEY;
let picks = apiKey ? await analyzeWithAi(apiKey) : null;

if (!picks) {
  let existing = null;
  try {
    existing = JSON.parse(await readFile(insightsUrl, "utf8"));
  } catch {
    existing = null;
  }

  if (existing?.picks?.length) {
    console.warn("AI analysis unavailable — keeping existing insights.json");
    process.exit(0);
  }

  picks = fallbackPicks;
  console.warn("AI analysis unavailable — writing computed fallback picks");
}

const merged = CATEGORIES.map(
  (category) =>
    picks.find((pick) => pick.category === category) ??
    fallbackPicks.find((pick) => pick.category === category)
).filter(Boolean);

const updated = new Date().toISOString().slice(0, 10);

await writeFile(
  insightsUrl,
  JSON.stringify(
    {
      updated,
      source: picks === fallbackPicks ? "computed" : "ai",
      picks: merged,
    },
    null,
    2
  ) + "\n"
);

const previousByCategory = new Map(
  previousPicks.map((pick) => [pick.category, pick])
);
const pickChanges = merged
  .filter(
    (pick) =>
      previousByCategory.has(pick.category) &&
      previousByCategory.get(pick.category).model !== pick.model
  )
  .map((pick) => ({
    category: pick.category,
    from: previousByCategory.get(pick.category).model,
    to: pick.model,
  }));

let digest = {
  updated,
  priceChanges: [],
  newReleases: [],
  pickChanges: [],
};
try {
  digest = JSON.parse(await readFile(digestUrl, "utf8"));
} catch {
  digest = { updated, priceChanges: [], newReleases: [], pickChanges: [] };
}

digest.updated = updated;
digest.pickChanges = pickChanges;

await writeFile(digestUrl, JSON.stringify(digest, null, 2) + "\n");

console.log(`Wrote ${merged.length} picks to insights.json`);
console.log(`Digest: ${pickChanges.length} pick changes`);
