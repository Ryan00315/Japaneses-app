const cache = new Map();
const requestLog = [];

let blockedUntil = 0;

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7天
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分鐘
const RATE_LIMIT_MAX = 10; // 每分鐘最多10次（全站）

function normalizeText(input) {
  return String(input || "").trim().replace(/\s+/g, " ");
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (!value || now - value.savedAt > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

function isRateLimited() {
  const now = Date.now();

  while (requestLog.length && now - requestLog[0] > RATE_LIMIT_WINDOW_MS) {
    requestLog.shift();
  }

  if (requestLog.length >= RATE_LIMIT_MAX) {
    return true;
  }

  requestLog.push(now);
  return false;
}

function extractRetrySeconds(message) {
  const msg = String(message || "");
  const match = msg.match(/retry in\s*([\d.]+)s/i);
  if (!match) return null;

  const sec = Math.ceil(parseFloat(match[1]));
  return Number.isFinite(sec) ? sec : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://ryan00315.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  cleanupCache();

  try {
    const { text } = req.body || {};
    const normalizedText = normalizeText(text);

    if (!normalizedText) {
      return res.status(400).json({ error: "Missing text" });
    }

    const now = Date.now();

    // 1) Gemini quota / rate limit 冷卻中
    if (now < blockedUntil) {
      const waitSec = Math.ceil((blockedUntil - now) / 1000);
      return res.status(429).json({
        error: `Quota cooling down. Please retry in ${waitSec}s`
      });
    }

    // 2) 先查快取
    const cached = cache.get(normalizedText);
    if (cached && cached.value) {
      return res.status(200).json({
        ...cached.value,
        cached: true
      });
    }

    // 3) API 自己先限流，避免短時間打爆
    if (isRateLimited()) {
      return res.status(429).json({
        error: "Too many requests. Please try again later."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const prompt = `
你是一位精通《大家的日本語》的老師。
請把輸入的日文假名或單字轉成 JSON：

{
  "kanji": "日文漢字或原字",
  "chinese": "繁體中文意思"
}

規則：
1. 只能回傳 JSON
2. 不要加 Markdown
3. 不要加說明文字
4. 若無法判定漢字，kanji 可填原文
5. 中文請用繁體中文
6. 若輸入本身就是漢字單字，kanji 可直接保留原文
7. 必須是合法 JSON 字串

輸入：${normalizedText}
    `.trim();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiError =
        data?.error?.message ||
        data?.message ||
        "Gemini API error";

      const retrySec = extractRetrySeconds(apiError);

      if (retrySec) {
        blockedUntil = Date.now() + retrySec * 1000;
      } else if (/quota|rate limit|too many requests|exceeded|resource exhausted/i.test(apiError)) {
        blockedUntil = Date.now() + 15000;
      }

      return res.status(response.status || 429).json({
        error: apiError
      });
    }

    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      return res.status(500).json({ error: "No model output" });
    }

    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      return res.status(500).json({
        error: "Model returned invalid JSON",
        raw: resultText
      });
    }

    const finalResult = {
      kanji: result?.kanji || "",
      chinese: result?.chinese || ""
    };

    // 4) 成功後寫入快取
    cache.set(normalizedText, {
      value: finalResult,
      savedAt: Date.now()
    });

    return res.status(200).json({
      ...finalResult,
      cached: false
    });
  } catch (err) {
    const message = err?.message || "Server error";

    const retrySec = extractRetrySeconds(message);
    if (retrySec) {
      blockedUntil = Date.now() + retrySec * 1000;
    } else if (/quota|rate limit|too many requests|exceeded|resource exhausted/i.test(message)) {
      blockedUntil = Date.now() + 15000;
    }

    return res.status(500).json({
      error: message
    });
  }
}
