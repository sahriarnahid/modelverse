# ModelVerse

The AI model market, finally makes sense. A single-page directory that tracks
models, agents, and prices for people who vibe code.

Built with [Astro](https://astro.build). Design system inspired by
[omarchy.org](https://omarchy.org) with 10 switchable themes.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:4321

## Build

```bash
npm run build
```

The build produces a static site in `dist/`. The AI endpoint lives in
`functions/` and is picked up automatically by Cloudflare Pages.

## Deploy free (Cloudflare Pages)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Select the repo and set:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Add environment variable `GEMINI_API_KEY` (type: **Secret**).
4. Deploy. You get a free `modelverse.pages.dev` URL.

Every push — including the nightly refresh commits — rebuilds and redeploys
automatically.

### Local testing

```bash
npm run build
npm run pages:dev
```

`npm run pages:dev` serves the built site and runs the AI endpoint locally using
the key from `.dev.vars`.

### Domain

`*.pages.dev` is free. A custom domain can be added under the Pages project →
**Custom domains** (for external zones like is-a.dev, use the Cloudflare API).

## Project layout

```
src/
├── components/          Astro UI pieces
│   ├── sections/        one file per page section
│   └── ...              cards, header, footer, logo, pixel field
├── data/                source data
│   ├── editorial.js     hand-written model facts (use for / skip for)
│   ├── agents.js        coding agents
│   ├── themes.js        theme list and palettes
│   ├── stacks.js        fallback stacks for the quiz
│   ├── sources.js       data-source links
│   └── *.json           generated (prices, releases, insights, digest)
├── lib/                 shared logic
│   ├── catalog.js       merges data into the page model
│   ├── format.js        price, context, and date formatting
│   └── gemini.js        Gemini requests shared by endpoint and scripts
├── scripts/             browser-side modules
│   ├── theme.js         theme switching + T shortcut
│   ├── navigation.js    header scroll state + scroll-spy
│   ├── compare.js       compare table
│   ├── quiz.js          stack builder
│   ├── filters.js       catalog filter chips
│   ├── bar-chart.js     animated price bars
│   └── pixel-field.js   hero canvas animation
├── pages/
│   ├── index.astro      composes the sections
│   └── api/recommend.js AI endpoint
└── styles/
    ├── themes.css       theme palettes
    ├── base.css         reset, typography, layout, header, footer
    ├── components.css   cards, tables, quiz, charts
    └── responsive.css   media queries
```

## Edit content

- `src/data/editorial.js` — models, use cases, tags (your editorial voice)
- `src/data/agents.js` — coding agents
- `src/data/stacks.js` — fallback stacks
- `src/data/themes.js` — themes and their palettes
- `src/data/sources.js` — data-source links
- `src/data/*.json` — generated; do not edit by hand

## AI recommender

The stack quiz calls `/api/recommend` (`src/pages/api/recommend.js`). The
endpoint sends your answers plus the live catalog to Gemini and returns a pick
with reasons. The key never reaches the browser.

Local dev — create `.dev.vars` (gitignored) and add a free key from
[aistudio.google.com/apikey](https://aistudio.google.com/apikey):

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
```

Production — add `GEMINI_API_KEY` as an environment variable/secret in your
host's dashboard (Cloudflare Pages: Settings → Variables and Secrets) and
redeploy.

Without a key, or when the free tier rate limit is hit, the quiz falls back to
the built-in rule-based recommendation automatically.

The endpoint tries `GEMINI_MODEL` first, then `gemini-3.5-flash-lite`, then
`gemini-flash-lite-latest`. Rate-limited models cool down automatically, and
results are cached (6 hours server-side, 24 hours in the browser). Free tier
quotas are per-model (~15 requests/minute), so normal use stays well inside
them.

## Shareable URLs

The stack quiz keeps your settings in the URL, for example:

```
?goal=website&budget=10&priority=30&exp=some&theme=tokyo-night#stacks
```

Opening a shared link restores the exact setup — sliders, experience, and the
theme. The "Copy share link" button copies the current URL to the clipboard.

## Auto-updating prices

`npm run update-prices` pulls fresh prices and context windows from
[models.dev](https://models.dev) and writes `src/data/prices.json`. Your
editorial fields in `editorial.js` are never touched.

The GitHub Action in `.github/workflows/refresh.yml` runs this every night at
04:17 UTC, rebuilds, and commits any changes. If your host (Cloudflare Pages,
Netlify, Vercel) is connected to the repo, the new prices deploy automatically.

## AI picks, releases, and the daily digest

`npm run analyze` sends the full catalog to Gemini and writes
`src/data/insights.json` — the picks shown in "Quick answers" (best for coding,
cheapest, best value, best for reasoning, best for long context, best free
option) with a concrete reason for each. If the API is unavailable it keeps the
previous picks; with no key it writes computed fallbacks.

The nightly job also scans all 11 tracked labs on models.dev and writes
`src/data/releases.json` — every model released in the last 120 days. These are
merged into the market table alongside the catalog models, so a new model from
any tracked lab appears automatically.

Both steps record what changed in `src/data/digest.json` (price changes, new
releases in the last day, pick changes), which powers the Daily digest section
at the top of the page.

Add `GEMINI_API_KEY` as a repository secret (Settings → Secrets and variables →
Actions) for the AI step to run in CI. To promote a release to a full card (use
cases, filter tags), add an entry to `src/data/editorial.js` using its `source`
id from the market table.

## What updates automatically

Nightly via the GitHub Action:

- Prices, cache prices, and context/output limits for the catalog models
- New releases from all 11 tracked labs (merged into the market table)
- AI picks in Quick answers
- The daily digest (price changes, new releases, pick changes)
- The stack builder's frontier price line

Editorial, updated by hand in `src/data/`:

- The catalog list itself, plus use cases and "skip for" lines (`editorial.js`)
- Agents and their prices (`agents.js`) — no public API tracks agent pricing
- Stack definitions and subscription prices like ClinePass (`stacks.js`)
- Source links (`sources.js`)

Live on each visit:

- Stack builder AI recommendations (Gemini, cached 6h server-side and 24h in the
  browser)

## Themes

Press **T** anywhere to cycle themes. Pick one from the Themes section or the
footer. The choice is saved in your browser.

## Data sources

Prices come from [models.dev](https://models.dev) and provider pricing pages.
Verify before making purchasing decisions.
