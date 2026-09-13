import { models } from "../lib/catalog.js";
import { fmtPrice } from "../lib/format.js";
import { stacks, tierForBudget } from "../data/stacks.js";

const GOAL_REASONS = {
  website: "Scaffold with Astro or Next.js — any model here handles it.",
  app: "Start with one screen, then let the agent iterate.",
  learn: "Start free and learn tokens and context before paying.",
  business: "Keep a reliable frontier model for client-facing work.",
};

const EXPERIENCE_REASONS = {
  new: "Use Cursor free tier first — the friendliest agent.",
  some: "opencode or Cline inside your editor will feel natural.",
  confident: "Go terminal-first with opencode or Claude Code.",
};

const ALLOWED = {
  goal: ["website", "app", "learn", "business"],
  experience: ["new", "some", "confident"],
};

const AI_CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "modelverse-ai-";

const budgetLabel = (usd) => `$${usd}${usd >= 100 ? "+" : ""}`;
const priorityLabel = (value) =>
  value <= 30 ? "Cheapest" : value >= 70 ? "Best quality" : "Balanced";

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]
  );

function buildQuizStacks() {
  const sonnet = models.find((model) => model.name === "Claude Sonnet 5");
  if (!sonnet) return stacks;

  return stacks.map((stack) =>
    stack.id === "frontier"
      ? {
          ...stack,
          items: [
            `${sonnet.name} API — ${fmtPrice(sonnet.input)}/${fmtPrice(sonnet.output)}, the best coding pick here`,
            ...stack.items.slice(1),
          ],
        }
      : stack
  );
}

function readStoredPick(key) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (!stored?.ts || Date.now() - stored.ts > AI_CACHE_TTL) return null;
    return stored.pick;
  } catch {
    return null;
  }
}

function storePick(key, pick) {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({ ts: Date.now(), pick })
    );
  } catch {
    return;
  }
}

export function initQuiz() {
  const result = document.getElementById("quiz-result");
  const note = document.getElementById("quiz-note");
  const budgetSlider = document.getElementById("budget-slider");
  const prioritySlider = document.getElementById("priority-slider");
  const budgetValue = document.getElementById("budget-value");
  const priorityValue = document.getElementById("priority-value");
  const shareButton = document.getElementById("share-link");
  if (!result || !budgetSlider || !prioritySlider) return;

  const quizStacks = buildQuizStacks();
  const memoryCache = new Map();
  const state = { goal: "website", budgetUsd: 0, experience: "new", priority: 50 };
  let requestToken = 0;
  let debounceTimer = 0;

  const stateKey = () =>
    `${state.goal}|${state.budgetUsd}|${state.priority}|${state.experience}`;

  function fallbackHtml(stack) {
    return `
      <div class="stack-main">
        <span class="kicker">${stack.label} budget</span>
        <h3 style="font-size:1.5rem">${stack.title}</h3>
        <ul class="stack-list">${stack.items
          .map((item) => `<li>${item}</li>`)
          .join("")}</ul>
      </div>
      <div class="stack-side">
        <div class="stack-price">${stack.price}</div>
        <ul class="stack-list">
          <li>${GOAL_REASONS[state.goal]}</li>
          <li>${EXPERIENCE_REASONS[state.experience]}</li>
          <li>${stack.note}</li>
        </ul>
        <p style="margin-top:1.2rem"><a class="btn btn-ghost btn-sm" href="#models">See the models</a></p>
      </div>`;
  }

  function aiHtml(pick) {
    return `
      <div class="stack-main">
        <span class="kicker">AI pick · Gemini</span>
        <h3 style="font-size:1.5rem">${escapeHtml(pick.model)} + ${escapeHtml(pick.agent)}</h3>
        <ul class="stack-list">${pick.reasons
          .map((reason) => `<li>${escapeHtml(reason)}</li>`)
          .join("")}</ul>
      </div>
      <div class="stack-side">
        <div class="stack-price">${escapeHtml(pick.price)}</div>
        <p class="hint" style="margin-top:1rem">Generated from today's catalog. Verify prices before paying.</p>
        <p style="margin-top:1.2rem"><a class="btn btn-ghost btn-sm" href="#models">See the models</a></p>
      </div>`;
  }

  async function fetchAiPick(key) {
    const stored = readStoredPick(key);
    if (stored) return stored;
    if (memoryCache.has(key)) return memoryCache.get(key);

    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const error = new Error(detail.error ?? "request_failed");
      error.retryIn = detail.retryIn ?? 0;
      throw error;
    }

    const pick = await response.json();
    memoryCache.set(key, pick);
    storePick(key, pick);
    return pick;
  }

  async function renderQuiz() {
    const key = stateKey();
    const stack = quizStacks.find((s) => s.id === tierForBudget(state.budgetUsd));
    const token = ++requestToken;

    const stored = readStoredPick(key);
    if (stored) {
      result.innerHTML = aiHtml(stored);
      note.textContent = "AI pick, generated from the catalog for your answers.";
      return;
    }

    result.innerHTML = fallbackHtml(stack);
    note.textContent = "Asking Gemini for a personalized pick…";

    try {
      const pick = await fetchAiPick(key);
      if (token !== requestToken) return;
      result.innerHTML = aiHtml(pick);
      note.textContent =
        "AI pick, generated live from the catalog for your answers.";
    } catch (error) {
      if (token !== requestToken) return;
      note.textContent =
        error.message === "not_configured"
          ? "Standard pick. Add a free Gemini API key to unlock AI recommendations."
          : error.message === "rate_limited"
            ? `Free AI quota is busy right now — showing the standard pick. Try again in about ${error.retryIn || 60} seconds.`
            : "Standard pick. AI recommendation unavailable right now.";
    }
  }

  function syncUrl() {
    const params = new URLSearchParams({
      goal: state.goal,
      budget: String(state.budgetUsd),
      priority: String(state.priority),
      exp: state.experience,
      theme: document.documentElement.dataset.theme,
    });
    history.replaceState(null, "", `?${params.toString()}#stacks`);
  }

  function scheduleQuiz() {
    syncUrl();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderQuiz, 500);
  }

  function paintSlider(slider) {
    const min = Number(slider.min);
    const max = Number(slider.max);
    const percent = ((Number(slider.value) - min) / (max - min)) * 100;
    slider.style.setProperty("--fill", `${percent}%`);
  }

  function loadFromUrl() {
    const params = new URLSearchParams(location.search);

    const goal = params.get("goal");
    if (ALLOWED.goal.includes(goal)) state.goal = goal;

    const experience = params.get("exp");
    if (ALLOWED.experience.includes(experience)) state.experience = experience;

    const budget = Number(params.get("budget"));
    if (params.get("budget") !== null && Number.isFinite(budget)) {
      state.budgetUsd = Math.min(Math.max(Math.round(budget), 0), 100);
    }

    const priority = Number(params.get("priority"));
    if (params.get("priority") !== null && Number.isFinite(priority)) {
      state.priority = Math.min(Math.max(Math.round(priority), 0), 100);
    }
  }

  const goalTiles = [...document.querySelectorAll(".goal-tile")];
  const segmented = document.querySelector(".segmented");
  const segmentedButtons = segmented
    ? [...segmented.querySelectorAll("button")]
    : [];
  const segmentedThumb = segmented?.querySelector(".segmented-thumb");

  function moveSegmentedThumb() {
    if (!segmentedThumb) return;
    const index = segmentedButtons.findIndex((button) =>
      button.classList.contains("active")
    );
    segmentedThumb.style.transform = `translateX(${index * 100}%)`;
  }

  function applyStateToUi() {
    goalTiles.forEach((tile) => {
      tile.classList.toggle("active", tile.dataset.value === state.goal);
    });
    segmentedButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.value === state.experience);
    });
    budgetSlider.value = String(state.budgetUsd);
    prioritySlider.value = String(state.priority);
    if (budgetValue) budgetValue.textContent = budgetLabel(state.budgetUsd);
    if (priorityValue) priorityValue.textContent = priorityLabel(state.priority);
    moveSegmentedThumb();
    paintSlider(budgetSlider);
    paintSlider(prioritySlider);
  }

  goalTiles.forEach((tile) => {
    tile.addEventListener("click", () => {
      goalTiles.forEach((t) => t.classList.toggle("active", t === tile));
      state.goal = tile.dataset.value;
      scheduleQuiz();
    });
  });

  segmentedButtons.forEach((button) => {
    button.addEventListener("click", () => {
      segmentedButtons.forEach((b) =>
        b.classList.toggle("active", b === button)
      );
      state.experience = button.dataset.value;
      moveSegmentedThumb();
      scheduleQuiz();
    });
  });

  budgetSlider.addEventListener("input", () => {
    state.budgetUsd = Number(budgetSlider.value);
    if (budgetValue) budgetValue.textContent = budgetLabel(state.budgetUsd);
    paintSlider(budgetSlider);
    scheduleQuiz();
  });

  prioritySlider.addEventListener("input", () => {
    state.priority = Number(prioritySlider.value);
    if (priorityValue) priorityValue.textContent = priorityLabel(state.priority);
    paintSlider(prioritySlider);
    scheduleQuiz();
  });

  shareButton?.addEventListener("click", async () => {
    syncUrl();
    try {
      await navigator.clipboard.writeText(location.href);
      shareButton.textContent = "Copied!";
    } catch {
      shareButton.textContent = "Copy failed";
    }
    setTimeout(() => {
      shareButton.textContent = "Copy share link";
    }, 1600);
  });

  loadFromUrl();
  applyStateToUi();
  renderQuiz();
}
