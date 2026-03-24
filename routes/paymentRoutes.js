const express = require("express");
const { startPayment, verifyPayment } = require("../services/telebirrService");
const ManualVerificationRequest = require("../models/ManualVerificationRequest");

const router = express.Router();

router.post("/telebirr/initiate", (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const phone = String(req.body?.phone || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount." });
    }

    const payment = startPayment({ amount, phone });
    return res.json({
      message: "Payment initiated. Complete payment in Telebirr and verify.",
      ...payment
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to initiate Telebirr payment." });
  }
});

router.post("/telebirr/verify", (req, res) => {
  try {
    const txId = String(req.body?.txId || "").trim();
    const amount = Number(req.body?.amount);

    if (!txId) {
      return res.status(400).json({ error: "Missing txId." });
    }

    const verification = verifyPayment({ txId, amount });
    if (!verification.ok) {
      return res.status(402).json({ error: verification.error || "Payment not confirmed." });
    }

    return res.json({
      ok: true,
      premiumUnlocked: true
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to verify Telebirr payment." });
  }
});

router.post("/telebirr/manual-verification", async (req, res) => {
  try {
    const phone = String(req.body?.phone || "").trim();
    const txId = String(req.body?.txId || "").trim();
    const note = String(req.body?.note || "").trim();
    const amount = Number(req.body?.amount ?? 50);

    const phoneRegex = /^(?:\+251|0)?9\d{8}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        error: "Invalid phone format. Use Ethiopian mobile format (e.g. 09XXXXXXXX or +2519XXXXXXXX)."
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount." });
    }

    const requestDoc = await ManualVerificationRequest.create({
      phone,
      txId: txId || null,
      amount,
      note
    });

    // Replace this with SMS/Telegram/email integration later.
    console.log(
      `[Manual Verify] New Telebirr request from ${requestDoc.phone}, txId=${requestDoc.txId || "N/A"}, amount=${requestDoc.amount}`
    );

    return res.status(201).json({
      ok: true,
      message: "Manual verification request submitted. We will review your payment.",
      requestId: requestDoc._id
    });
  } catch (error) {
    console.error("Manual verification error:", error);
    return res.status(500).json({ error: "Failed to submit manual verification request." });
  }
});

module.exports = router;
