const express = require("express");
const { synthesizeSpeech } = require("../services/googleTtsService");

const router = express.Router();

router.post("/synthesize", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const languageCode = String(req.body?.languageCode || "en-US");
    const premiumUnlocked = Boolean(req.body?.premiumUnlocked);

    if (!text) {
      return res.status(400).json({ error: "Text is required." });
    }

    if (!premiumUnlocked) {
      return res.status(402).json({
        error: "Premium voice requires Telebirr payment of 50 ETB."
      });
    }

    const result = await synthesizeSpeech({
      text,
      languageCode,
      premiumUnlocked
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("X-Voice-Name", result.voiceName);
    return res.send(Buffer.from(result.audioContent, "base64"));
  } catch (error) {
    console.error("TTS synthesize error:", error);
    return res.status(500).json({ error: "Failed to synthesize audio." });
  }
});

module.exports = router;
