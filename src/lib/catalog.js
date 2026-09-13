import { editorial } from "../data/editorial.js";
import { agents } from "../data/agents.js";
import priceData from "../data/prices.json";
import releasesData from "../data/releases.json";
import insightsData from "../data/insights.json";
import digestData from "../data/digest.json";
import { fmtPrice, fmtDate } from "./format.js";

const prices = priceData.models ?? {};
const picks = insightsData.picks ?? [];
const releases = releasesData.releases ?? [];

export const models = editorial.map((model) => ({
  ...model,
  ...(prices[model.source] ?? {}),
}));

export const modelByName = new Map(models.map((model) => [model.name, model]));

export const tickerModels = models.slice(0, 8);

export const pricesUpdated = fmtDate(priceData.updated);

export { agents, releases };

export const latestRelease = releases[0];

export const marketRows = [
  ...models.map((model) => ({ ...model, tracked: true })),
  ...releases
    .filter((release) => !models.some((model) => model.source === release.source))
    .map((release) => ({ ...release, tracked: false })),
].sort((a, b) => (b.released ?? "").localeCompare(a.released ?? ""));

export const digest = {
  priceChanges: digestData.priceChanges ?? [],
  newReleases: digestData.newReleases ?? [],
  pickChanges: digestData.pickChanges ?? [],
};

export const sortedByOutput = [...models].sort((a, b) => a.output - b.output);
const cheapest = models.reduce((a, b) =>
  a.input + a.output < b.input + b.output ? a : b
);
const priciest = models.reduce((a, b) => (a.output > b.output ? a : b));

export const stats = {
  modelCount: models.length,
  agentCount: agents.length,
  labCount: new Set(releases.map((release) => release.provider)).size,
  cheapest,
  priciest,
  priceGap: Math.round(priciest.output / cheapest.output),
  maxOutput: Math.max(...models.map((model) => model.output)),
};

export const quickAnswers = picks
  .map((pick) => ({
    label: pick.category,
    model: modelByName.get(pick.model),
    note: pick.reason,
  }))
  .filter((answer) => answer.model);

export const compareDefaults = [
  "Claude Sonnet 5",
  "DeepSeek V4 Pro",
  "GPT-6 Astra",
];

export const modelFilters = [
  { id: "all", label: "All" },
  { id: "code", label: "Best for code" },
  { id: "cheap", label: "Cheapest" },
  { id: "open", label: "Open weights" },
  { id: "flagship", label: "Flagship" },
  { id: "fast", label: "Fast" },
];

export const priceBreakdown = sortedByOutput.map((model) => ({
  name: model.name,
  label: fmtPrice(model.output),
  width: Math.max((model.output / stats.maxOutput) * 100, 1.5),
}));
