export const stacks = [
  {
    id: "zero",
    label: "$0",
    title: "Free-tier starter",
    price: "$0 / month",
    summary: "A real agent and a real model, no card required.",
    items: [
      "Gemini CLI — free daily quota, terminal agent",
      "opencode — free and open source, add a free Gemini API key",
      "GitHub Copilot free tier — autocomplete",
      "Cloudflare Pages — free hosting",
    ],
    note: "Rate limits are the only real cost. Expect to wait on heavy days.",
  },
  {
    id: "flat",
    label: "$10",
    title: "Flat-rate setup",
    price: "$9.99 / month",
    summary: "One subscription, several strong open-weight models, no token counting.",
    items: [
      "ClinePass — DeepSeek V4 Pro, GLM-5.3, Kimi K2.7 Code, Qwen3.8 Max",
      "opencode or Cline — free agents, connect ClinePass",
      "GitHub Copilot free tier — autocomplete",
      "Cloudflare Pages — free hosting",
    ],
    note: "Best value if you code most days.",
  },
  {
    id: "frontier",
    label: "$50+",
    title: "Frontier setup",
    price: "~$50–70 / month",
    summary: "Top models for when output quality is worth more than the bill.",
    items: [
      "Claude Sonnet 5 API — live pricing in the quiz",
      "Cursor Pro — $20/mo for the polished IDE experience",
      "Claude Opus 5 — pay-as-you-go for hard problems",
      "Free tiers for overflow and autocomplete",
    ],
    note: "Only worth it if you ship daily or bill clients.",
  },
];

export const tierForBudget = (usd) =>
  usd <= 0 ? "zero" : usd <= 25 ? "flat" : "frontier";
