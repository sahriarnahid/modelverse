import { models } from "../../src/lib/catalog.js";
import {
  DEFAULT_MODEL,
  FALLBACK_MODELS,
  generateGeminiJson,
} from "../../src/lib/gemini.js";

const CACHE_TTL = 6 * 60 * 60 * 1000;
const cache = new Map();
const cooldowns = new Map();
let preferredModel = null;

const ALLOWED = {
  goal: ["website", "app", "learn", "business"],
  experience: ["new", "some", "confident"],
};

const SYSTEM_PROMPT =
  "You are ModelVerse's recommendation engine for developers who vibe code. " +
  "Be practical, cost-aware, and concise. Always answer with valid JSON.";

function modelChain(env) {
  const configured = env?.GEMINI_MODEL || DEFAULT_MODEL;
  const chain = [
    ...new Set([preferredModel, configured, ...FALLBACK_MODELS].filter(Boolean)),
  ];
  const now = Date.now();
  return chain.filter((model) => (cooldowns.get(model) ?? 0) < now);
}

function cooldownRemaining() {
  const now = Date.now();
  const active = [...cooldowns.values()].filter((until) => until > now);
  if (!active.length) return 0;
  return Math.ceil((Math.min(...active) - now) / 1000);
}

function buildPrompt(goal, budgetUsd, priority, experience) {
  const catalog = models.map((model) => ({
    name: model.name,
    provider: model.provider,
    inputPerMillion: model.input,
    outputPerMillion: model.output,
    context: model.context,
    tags: model.tags,
    useFor: model.useFor,
    skip: model.skip,
  }));

  return [
    `The user is building: ${goal}.`,
    `Monthly budget: $${budgetUsd} per month.`,
    `Cost vs quality priority: ${priority}/100 (0 = absolute cheapest, 100 = best quality regardless of cost).`,
    `Experience level: ${experience}.`,
    "",
    "Catalog (prices in USD per 1M tokens):",
    JSON.stringify(catalog),
    "",
    "Pick the single best setup. Rules:",
    "- The agent must be one of: opencode, Claude Code, Cursor, Windsurf, OpenAI Codex, Gemini CLI, Cline, GitHub Copilot.",
    "- Stay within the monthly budget. A $0 budget means free tiers only.",
    "- If priority is 40 or below, optimize hard for cost. If 70 or above, optimize for quality. Otherwise balance both.",
    "- Reasons must be short, concrete, and mention prices or limits.",
    "Reply with JSON only, exactly this shape:",
    '{"model": "name from catalog", "agent": "agent name", "price": "estimated monthly cost", "reasons": ["reason 1", "reason 2", "reason 3"]}',
  ].join("\n");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normalizePick(pick) {
  if (!pick?.model || !pick?.agent || !Array.isArray(pick?.reasons)) {
    return null;
  }

  return {
    source: "ai",
    model: String(pick.model),
    agent: String(pick.agent),
    price: String(pick.price ?? ""),
    reasons: pick.reasons.slice(0, 4).map(String),
  };
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const goal = ALLOWED.goal.includes(body?.goal) ? body.goal : "website";
  const experience = ALLOWED.experience.includes(body?.experience)
    ? body.experience
    : "new";
  const budgetUsd = Number.isFinite(body?.budgetUsd)
    ? Math.min(Math.max(Math.round(body.budgetUsd), 0), 500)
    : 0;
  const priority = Number.isFinite(body?.priority)
    ? Math.min(Math.max(Math.round(body.priority), 0), 100)
    : 50;

  const cacheKey = `${goal}|${budgetUsd}|${priority}|${experience}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return json(cached.pick);
  }

  const apiKey = env?.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: "not_configured" }, 503);
  }

  const chain = modelChain(env);
  if (!chain.length) {
    return json({ error: "rate_limited", retryIn: cooldownRemaining() }, 429);
  }

  const result = await generateGeminiJson({
    prompt: buildPrompt(goal, budgetUsd, priority, experience),
    apiKey,
    system: SYSTEM_PROMPT,
    models: chain,
    onRateLimit: (model, retryIn) => {
      cooldowns.set(model, Date.now() + retryIn * 1000);
    },
  });

  if (result.error === "rate_limited") {
    return json({ error: "rate_limited", retryIn: cooldownRemaining() }, 429);
  }

  const pick = normalizePick(result.data);
  if (result.error || !pick) {
    return json({ error: "request_failed" }, 502);
  }

  preferredModel = result.model;
  cache.set(cacheKey, { pick, ts: Date.now() });
  return json(pick);
}
