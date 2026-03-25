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

  try {
    const { text } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "Missing text" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

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
              parts: [
                {
                  text: `
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

輸入：${text}
                  `.trim()
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API error"
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

    return res.status(200).json({
      kanji: result.kanji || "",
      chinese: result.chinese || ""
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Server error"
    });
  }
}
