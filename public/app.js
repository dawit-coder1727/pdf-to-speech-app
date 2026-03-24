const $ = (id) => document.getElementById(id);

const STORAGE_KEYS = {
  premiumUnlocked: "premiumUnlocked",
  freeUseCount: "freeUseCount"
};

const FREE_USE_LIMIT = 1;

const uploadForm = $("uploadForm");
const pdfInput = $("pdfInput");
const summaryLen = $("summaryLen");
const uploadBtn = $("uploadBtn");
const statusEl = $("status");
const appShell = $("appShell");

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
const modalPhoneInput = $("modalPhoneInput");
const modalTxIdInput = $("modalTxIdInput");
const ttsProgressWrap = $("ttsProgressWrap");
const ttsProgressBar = $("ttsProgressBar");
const ttsProgressLabel = $("ttsProgressLabel");
const ttsProgressPercent = $("ttsProgressPercent");

let currentTransactionId = "";
let premiumUnlocked = localStorage.getItem(STORAGE_KEYS.premiumUnlocked) === "true";
let freeUseCount = Number(localStorage.getItem(STORAGE_KEYS.freeUseCount) || "0");
let isReading = false;
let activeUtterance = null;
const AMHARIC_READ_ERROR = "አማርኛውን ማንበብ አልቻልኩም፣ እባክዎ ሌላ ፒዲኤፍ ይሞክሩ";

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
    isReading = false;
    activeUtterance = null;
    ttsProgressWrap?.classList.add("hidden");
    ttsProgressBar.style.width = "0%";
    ttsProgressPercent.textContent = "0%";
    playPremiumVoiceBtn.textContent = getPlayButtonText();
  } catch (_) {}
}

function speak(text) {
  stopSpeaking();
  const t = String(text || "").trim();
  if (!hasReadableSpeechText(t)) {
    setStatus(AMHARIC_READ_ERROR, "error");
    return;
  }
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

function hasReadableSpeechText(text) {
  const normalized = String(text || "")
    .replace(/[.]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;
  const compact = normalized.replace(/[.\s]/g, "");
  if (compact.length < 8) return false;
  return /[\u1200-\u137F]{2,}|[A-Za-z]{3,}/.test(normalized);
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

function persistFreemiumState() {
  localStorage.setItem(STORAGE_KEYS.freeUseCount, String(freeUseCount));
  localStorage.setItem(STORAGE_KEYS.premiumUnlocked, String(premiumUnlocked));
}

function getPlayButtonText() {
  if (isReading) return "Pause";
  if (premiumUnlocked) return "Play Clear Voice";
  if (freeUseCount >= FREE_USE_LIMIT) return "Clear Voice Locked";
  return "Play Clear Voice (1 Free)";
}

function updatePremiumUi() {
  playPremiumVoiceBtn.disabled = false;
  playPremiumVoiceBtn.textContent = getPlayButtonText();
}

function showPremiumModal() {
  premiumModal?.classList.remove("hidden");
  premiumModal?.classList.add("flex");
}

function hidePremiumModal() {
  premiumModal?.classList.add("hidden");
  premiumModal?.classList.remove("flex");
}

function getPreferredAmharicVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const preferredNames = [
    "Microsoft Abeo Online (Natural) - Amharic",
    "Microsoft Asrat"
  ];

  for (const preferred of preferredNames) {
    const matched = voices.find((voice) => voice.name.includes(preferred));
    if (matched) return matched;
  }

  return voices.find((voice) => voice.lang?.toLowerCase().startsWith("am")) || null;
}

function startReadingWithProgress(text) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    throw new Error("This browser does not support speech synthesis.");
  }

  const content = String(text || "").trim();
  if (!hasReadableSpeechText(content)) {
    throw new Error(AMHARIC_READ_ERROR);
  }

  const utterance = new SpeechSynthesisUtterance(content);
  const selectedVoice = getPreferredAmharicVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang || "am-ET";
  } else {
    utterance.lang = "am-ET";
  }

  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    isReading = true;
    activeUtterance = utterance;
    updatePremiumUi();
    ttsProgressWrap?.classList.remove("hidden");
    ttsProgressLabel.textContent = "Reading...";
    ttsProgressBar.style.width = "0%";
    ttsProgressPercent.textContent = "0%";
  };

  utterance.onboundary = (event) => {
    const idx = Number(event.charIndex || 0);
    const pct = Math.max(0, Math.min(100, Math.round((idx / content.length) * 100)));
    ttsProgressBar.style.width = `${pct}%`;
    ttsProgressPercent.textContent = `${pct}%`;
  };

  utterance.onend = () => {
    isReading = false;
    activeUtterance = null;
    ttsProgressLabel.textContent = "Completed";
    ttsProgressBar.style.width = "100%";
    ttsProgressPercent.textContent = "100%";
    setTimeout(() => ttsProgressWrap?.classList.add("hidden"), 900);
    updatePremiumUi();
  };

  utterance.onerror = () => {
    isReading = false;
    activeUtterance = null;
    ttsProgressWrap?.classList.add("hidden");
    updatePremiumUi();
    setPremiumStatus("Playback failed. Try again.", "error");
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
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
  uploadBtn.textContent = "Extracting...";
  stopSpeaking();

  try {
    const result = await parsePdf(file);
    summaryOut.value = result.summary || "";
    textOut.value = result.text || "";
    if (!hasReadableSpeechText(result.text) || !hasReadableSpeechText(result.summary)) {
      setStatus(AMHARIC_READ_ERROR, "error");
      return;
    }

    const meta = [
      result.pages ? `${result.pages} pages` : null,
      Number.isFinite(result.bytes) ? bytesToNice(result.bytes) : null
    ].filter(Boolean);

    setStatus(`Done. ${meta.length ? `(${meta.join(" • ")})` : ""}`, "success");
  } catch (err) {
    setStatus(err?.message || "Failed to process PDF.", "error");
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Extract + Summarize";
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
  const txInput = String(modalTxIdInput?.value || "").trim();
  if (!currentTransactionId && !txInput) {
    setPremiumStatus("Start payment first or enter a transaction ID.", "error");
    return;
  }

  setPremiumStatus("Verifying Telebirr payment...");
  try {
    await verifyTelebirrPayment(txInput || currentTransactionId);
    premiumUnlocked = true;
    persistFreemiumState();
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
  if (isReading) {
    stopSpeaking();
    return;
  }

  if (!premiumUnlocked && freeUseCount >= FREE_USE_LIMIT) {
    showPremiumModal();
    return;
  }

  const text = String(summaryOut?.value || "").trim();
  if (!hasReadableSpeechText(text)) {
    setPremiumStatus(AMHARIC_READ_ERROR, "error");
    return;
  }

  setPremiumStatus("Preparing natural Amharic voice...");
  try {
    startReadingWithProgress(text);
    if (!premiumUnlocked) {
      freeUseCount += 1;
      persistFreemiumState();
    }
    setPremiumStatus(
      premiumUnlocked
        ? "Playing premium clear voice."
        : `Free use consumed (${freeUseCount}/${FREE_USE_LIMIT}).`,
      "success"
    );
    updatePremiumUi();
  } catch (err) {
    setPremiumStatus(err?.message || "Playback failed.", "error");
  }
});

closePremiumModalBtn?.addEventListener("click", hidePremiumModal);
premiumModal?.addEventListener("click", (e) => {
  if (e.target === premiumModal) hidePremiumModal();
});
modalPayNowBtn?.addEventListener("click", () => payPremiumBtn?.click());
modalVerifyBtn?.addEventListener("click", () => verifyPremiumBtn?.click());
modalPhoneInput?.addEventListener("input", () => {
  telebirrPhoneInput.value = modalPhoneInput.value;
});

window.addEventListener("load", () => {
  appShell.classList.add("welcome-animate");
  appShell.classList.remove("opacity-0");
});

updatePremiumUi();

