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
    const keyword = String(text || "").trim();

    if (!keyword) {
      return res.status(400).json({ error: "Missing text" });
    }

    const candidates = [
      keyword,
      keyword.replace(/[()（）\s]/g, ""),
      keyword.replace(/[ぁ-ん]/g, ""), // 假名移除後再試一次（有些詞可能本來就是漢字）
    ].filter(Boolean);

    let finalSentence = "";

    for (const q of candidates) {
      const url = `https://api.tatoeba.org/v1/sentences?lang=jpn&query=${encodeURIComponent(q)}&limit=10`;
      const response = await fetch(url);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        continue;
      }

      const items = Array.isArray(data?.data) ? data.data : [];
      if (!items.length) {
        continue;
      }

      // 1. 先找明確包含關鍵字的
      let hit = items.find(item => {
        const sentence = String(item?.text || "").trim();
        return sentence.includes(q);
      });

      // 2. 找不到就拿第一句，不要直接判失敗
      if (!hit) {
        hit = items[0];
      }

      const sentence = String(hit?.text || "").trim();
      if (sentence) {
        finalSentence = sentence;
        break;
      }
    }

    return res.status(200).json({
      example: finalSentence
    });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Server error"
    });
  }
}
