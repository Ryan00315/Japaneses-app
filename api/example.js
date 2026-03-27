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

    const url =
      `https://api.tatoeba.org/v1/sentences?lang=jpn&query=${encodeURIComponent(keyword)}&limit=10`;

    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error || "Example API error"
      });
    }

    const items = Array.isArray(data?.data) ? data.data : [];

    // 先找有明確包含關鍵字的句子
    let hit = items.find(item => {
      const sentence = String(item?.text || "").trim();
      return sentence.includes(keyword);
    });

    // 找不到就退而求其次，拿第一句
    if (!hit) {
      hit = items[0];
    }

    const sentence = String(hit?.text || "").trim();

    return res.status(200).json({
      example: sentence
    });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Server error"
    });
  }
}
