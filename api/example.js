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
      `https://api.tatoeba.org/unstable/sentences?lang=jpn&query=${encodeURIComponent(keyword)}&sort=random&limit=5`;

    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Example API error"
      });
    }

    const items = Array.isArray(data?.data) ? data.data : [];

    const hit = items.find(item => {
      const sentence = item?.text || "";
      return sentence.includes(keyword);
    }) || items[0];

    const sentence = hit?.text || "";

    return res.status(200).json({
      example: sentence
    });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Server error"
    });
  }
}
