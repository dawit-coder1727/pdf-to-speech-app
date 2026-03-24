const $ = (id) => document.getElementById(id);

const uploadForm = $("uploadForm");
const pdfInput = $("pdfInput");
const summaryLen = $("summaryLen");
const uploadBtn = $("uploadBtn");
const statusEl = $("status");

const summaryOut = $("summaryOut");
const textOut = $("textOut");

const speakSummaryBtn = $("speakSummary");
const speakFullBtn = $("speakFull");

const copySummaryBtn = $("copySummary");
const copyFullBtn = $("copyFull");

const downloadAudioSummaryBtn = $("downloadAudioSummary");
const downloadAudioFullBtn = $("downloadAudioFull");
const audioNote = $("audioNote");
const playPremiumVoiceBtn = $("playPremiumVoice");
const payPremiumBtn = $("payPremiumBtn");
const verifyPremiumBtn = $("verifyPremiumBtn");
const premiumStatus = $("premiumStatus");
const telebirrPhoneInput = $("telebirrPhone");
const premiumModal = $("premiumModal");
const closePremiumModalBtn = $("closePremiumModal");
const modalPayNowBtn = $("modalPayNowBtn");
const modalVerifyBtn = $("modalVerifyBtn");

let currentTransactionId = "";
let premiumUnlocked = false;

function setStatus(msg, kind = "info") {
  statusEl.textContent = msg || "";
  statusEl.className =
    kind === "error"
      ? "text-sm text-rose-300"
      : kind === "success"
        ? "text-sm text-emerald-300"
        : "text-sm text-slate-300";
}

function bytesToNice(n) {
  if (!Number.isFinite(n)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function copyText(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

function stopSpeaking() {
  try {
    window.speechSynthesis.cancel();
  } catch (_) {}
}

function speak(text) {
  stopSpeaking();
  const t = String(text || "").trim();
  if (!t) return;
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    alert("Your browser does not support Text-to-Speech.");
    return;
  }

  const utt = new SpeechSynthesisUtterance(t);
  utt.rate = 1;
  utt.pitch = 1;
  utt.volume = 1;

  window.speechSynthesis.speak(utt);
}

function showAudioDownloadNote() {
  audioNote.classList.remove("hidden");
  audioNote.textContent =
    "Audio download note: browsers don’t reliably allow exporting Web Speech audio. Playback is instant; for downloadable MP3/WAV you’d need server-side TTS.";
}

function setPremiumStatus(msg, kind = "info") {
  premiumStatus.textContent = msg || "";
  premiumStatus.className =
    kind === "error"
      ? "text-sm text-rose-300"
      : kind === "success"
        ? "text-sm text-emerald-300"
        : "text-sm text-slate-300";
}

function updatePremiumUi() {
  playPremiumVoiceBtn.disabled = false;
  playPremiumVoiceBtn.textContent = premiumUnlocked ? "Play Clear Voice" : "Play Clear Voice (Premium)";
}

function showPremiumModal() {
  premiumModal?.classList.remove("hidden");
  premiumModal?.classList.add("flex");
}

function hidePremiumModal() {
  premiumModal?.classList.add("hidden");
  premiumModal?.classList.remove("flex");
}

async function parsePdf(file) {
  const form = new FormData();
  form.append("pdf", file);

  const sentences = Number(summaryLen?.value ?? 6);
  const qs = Number.isFinite(sentences) ? `?sentences=${encodeURIComponent(sentences)}` : "";
  const res = await fetch(`/api/parse${qs}`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Upload failed.");
  }
  return data;
}

async function initiateTelebirrPayment() {
  const phone = String(telebirrPhoneInput?.value || "").trim();
  const res = await fetch("/api/telebirr/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 50, phone })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Failed to start Telebirr payment.");
  }
  return data;
}

async function verifyTelebirrPayment(txId) {
  const res = await fetch("/api/telebirr/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txId, amount: 50 })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Payment verification failed.");
  }
  return data;
}

async function requestPremiumAudio(text, languageCode = "am-ET") {
  const res = await fetch("/api/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      languageCode,
      premiumUnlocked
    })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Premium voice generation failed.");
  }

  const audioBlob = await res.blob();
  return URL.createObjectURL(audioBlob);
}

uploadForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = pdfInput?.files?.[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    setStatus("File too large. Max 10MB.", "error");
    return;
  }

  setStatus("Uploading and extracting…");
  uploadBtn.disabled = true;
  stopSpeaking();

  try {
    const result = await parsePdf(file);
    summaryOut.value = result.summary || "";
    textOut.value = result.text || "";

    const meta = [
      result.pages ? `${result.pages} pages` : null,
      Number.isFinite(result.bytes) ? bytesToNice(result.bytes) : null
    ].filter(Boolean);

    setStatus(`Done. ${meta.length ? `(${meta.join(" • ")})` : ""}`, "success");
  } catch (err) {
    setStatus(err?.message || "Failed to process PDF.", "error");
  } finally {
    uploadBtn.disabled = false;
  }
});

speakSummaryBtn?.addEventListener("click", () => speak(summaryOut.value));
speakFullBtn?.addEventListener("click", () => speak(textOut.value));

copySummaryBtn?.addEventListener("click", async () => {
  const ok = await copyText(summaryOut.value);
  setStatus(ok ? "Summary copied." : "Copy failed.", ok ? "success" : "error");
});

copyFullBtn?.addEventListener("click", async () => {
  const ok = await copyText(textOut.value);
  setStatus(ok ? "Full text copied." : "Copy failed.", ok ? "success" : "error");
});

downloadAudioSummaryBtn?.addEventListener("click", () => showAudioDownloadNote());
downloadAudioFullBtn?.addEventListener("click", () => showAudioDownloadNote());

payPremiumBtn?.addEventListener("click", async () => {
  setPremiumStatus("Starting Telebirr payment request...");
  try {
    const result = await initiateTelebirrPayment();
    currentTransactionId = result.txId;
    setPremiumStatus(`Payment initiated. Transaction: ${currentTransactionId}`, "success");
  } catch (err) {
    setPremiumStatus(err?.message || "Failed to initiate payment.", "error");
  }
});

verifyPremiumBtn?.addEventListener("click", async () => {
  if (!currentTransactionId) {
    setPremiumStatus("Start payment first to get a transaction ID.", "error");
    return;
  }

  setPremiumStatus("Verifying Telebirr payment...");
  try {
    await verifyTelebirrPayment(currentTransactionId);
    premiumUnlocked = true;
    updatePremiumUi();
    hidePremiumModal();
    setPremiumStatus("Payment verified. Premium voice unlocked!", "success");
  } catch (err) {
    premiumUnlocked = false;
    updatePremiumUi();
    setPremiumStatus(err?.message || "Verification failed.", "error");
  }
});

playPremiumVoiceBtn?.addEventListener("click", async () => {
  if (!premiumUnlocked) {
    showPremiumModal();
    return;
  }

  const text = String(summaryOut?.value || "").trim();
  if (!text) {
    setPremiumStatus("Generate or paste summary text first.", "error");
    return;
  }

  setPremiumStatus("Generating premium Amharic voice...");
  try {
    const audioUrl = await requestPremiumAudio(text, "am-ET");
    const player = new Audio(audioUrl);
    await player.play();
    setPremiumStatus("Playing premium voice.", "success");
  } catch (err) {
    setPremiumStatus(err?.message || "Premium playback failed.", "error");
  }
});

closePremiumModalBtn?.addEventListener("click", hidePremiumModal);
premiumModal?.addEventListener("click", (e) => {
  if (e.target === premiumModal) hidePremiumModal();
});
modalPayNowBtn?.addEventListener("click", () => payPremiumBtn?.click());
modalVerifyBtn?.addEventListener("click", () => verifyPremiumBtn?.click());

updatePremiumUi();

