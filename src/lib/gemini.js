export const DEFAULT_MODEL = "gemini-3.8-flash";
export const FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

const CONFIG_VARIANTS = [
  {
    responseMimeType: "application/json",
    temperature: 0.4,
    maxOutputTokens: 2048,
    thinkingConfig: { thinkingBudget: 0 },
  },
  {
    responseMimeType: "application/json",
    temperature: 0.4,
    maxOutputTokens: 4096,
  },
];

export function parseRetrySeconds(payload) {
  const match = JSON.stringify(payload ?? "").match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(Number(match[1])) : 60;
}

export async function requestGeminiJson({ model, prompt, apiKey, system }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  for (const generationConfig of CONFIG_VARIANTS) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig,
        }),
      });
    } catch {
      return { ok: false, status: 502 };
    }

    if (response.status === 400) continue;

    if (response.status === 429) {
      const detail = await response.json().catch(() => null);
      return {
        ok: false,
        status: 429,
        retryIn: parseRetrySeconds(detail),
      };
    }

    if (!response.ok) return { ok: false, status: response.status };

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    const match = text?.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, status: 502 };

    try {
      return { ok: true, data: JSON.parse(match[0]) };
    } catch {
      return { ok: false, status: 502 };
    }
  }

  return { ok: false, status: 400 };
}

export async function generateGeminiJson({
  prompt,
  apiKey,
  system,
  models,
  onRateLimit,
}) {
  let rateLimited = true;

  for (const model of models) {
    const result = await requestGeminiJson({ model, prompt, apiKey, system });
    if (result.ok) return { data: result.data, model };

    if (result.status === 429) {
      onRateLimit?.(model, result.retryIn);
      continue;
    }

    rateLimited = false;
  }

  return { error: rateLimited ? "rate_limited" : "failed" };
}
