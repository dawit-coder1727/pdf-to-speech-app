const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mongoose = require("mongoose"); // 
const synthesizeRoutes = require("./routes/synthesizeRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

const uploadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 2,
  message: "የዛሬውን የነፃ ሙከራ ጨርሰዋል። ተጨማሪ ለመጠቀም ፕሪሚየም ይሁኑ!",
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/upload', uploadLimiter, (req, res) => {
});
// --- MONGODB CONNECTION ---
//  <password> 
const dbURI = "mongodb+srv://dawit_user-27:Dawit1727@cluster0.755mdss.mongodb.net/?appName=Cluster0";

mongoose.connect(dbURI)
  .then(() => console.log("✅ MongoDB Connected!"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Database Schema 
const fileSchema = new mongoose.Schema({
  filename: String,
  filesize: Number,
  pages: Number,
  uploadDate: { type: Date, default: Date.now }
});
const FileRecord = mongoose.model("FileRecord", fileSchema);

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/api", paymentRoutes);
app.use("/api", synthesizeRoutes);

const UPLOADS_DIR = path.join(__dirname, "uploads");

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const safeBase = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, `${safeBase}.pdf`);
  }
});

function isLikelyPdf(file) {
  const byMime = file.mimetype === "application/pdf";
  const byExt = (path.extname(file.originalname || "").toLowerCase() === ".pdf");
  return byMime || byExt;
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isLikelyPdf(file)) return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "pdf"));
    cb(null, true);
  }
});

app.use(express.static(path.join(__dirname, "public"), { etag: true, maxAge: "1h" }));

function cleanText(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

function normalizeAmharicText(raw) {
  return String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // remove zero-width joiners from PDF extraction
    .replace(/\s+([።፣፤፥፦፧])/g, "$1") // remove bad spacing before Ethiopic punctuation
    .replace(/([።፣፤፥፦፧])(?=[\u1200-\u137F])/g, "$1 ") // keep sentence separation for Amharic words
    .replace(/([a-zA-Z0-9])([\u1200-\u137F])/g, "$1 $2")
    .replace(/([\u1200-\u137F])([a-zA-Z0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  const t = cleanText(text);
  if (!t) return [];
  const chunks = t
    .split(/(?<=[.!?])\s+(?=[A-Z0-9\u1200-\u137F])/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (chunks.length) return chunks;
  return t.split(/[.!?]\s+/g).map((s) => s.trim()).filter(Boolean);
}

function buildWordFreq(text) {
  const stop = new Set([
    "the","a","an","and","or","but","if","then","else","when","while","with","without","to","of","in","on","for","from",
    "is","are","was","were","be","been","being","it","this","that","these","those","as","by","at","into","about","over",
    "i","you","he","she","we","they","them","his","her","our","your","their","not","no","yes","do","does","did","done",
    "can","could","should","would","may","might","will","just","also","than","too","very"
  ]);

  const freq = new Map();
  const tokens = cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u1200-\u137F\s]/g, " ")
    .split(/\s+/g)
    .filter(Boolean)
    .filter((w) => w.length >= 3)
    .filter((w) => !stop.has(w));

  for (const w of tokens) freq.set(w, (freq.get(w) || 0) + 1);
  return freq;
}

function summarize(text, { maxSentences = 5 } = {}) {
  const sentences = splitSentences(text);
  if (sentences.length <= maxSentences) return sentences.join(" ");

  const freq = buildWordFreq(text);
  const scored = sentences.map((s, idx) => {
    const tokens = s
      .toLowerCase()
      .replace(/[^a-z0-9\u1200-\u137F\s]/g, " ")
      .split(/\s+/g)
      .filter(Boolean);

    let score = 0;
    for (const w of tokens) score += (freq.get(w) || 0);
    const lenPenalty = Math.max(1, tokens.length);
    const normalized = score / lenPenalty;
    return { idx, s, score: normalized };
  });

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.s);

  return top.join(" ");
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/parse", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Missing PDF file." });

  try {
    const data = await fs.readFile(req.file.path);
    const parsed = await pdfParse(data, { max: 0 });
    const text = normalizeAmharicText(cleanText(parsed.text));
    
    const maxSentencesRaw = Number(req.query?.sentences ?? 6);
    const maxSentences = Number.isFinite(maxSentencesRaw)
      ? Math.min(12, Math.max(2, Math.trunc(maxSentencesRaw)))
      : 6;
    
    const summary = summarize(text, { maxSentences });

    // --- MONGODB SAVE ---
    // ዳታውን ወደ MongoDB እንመዘግባለን
    const record = new FileRecord({
      filename: req.file.originalname,
      filesize: req.file.size,
      pages: parsed.numpages || null
    });
    await record.save();

    res.json({
      filename: req.file.originalname,
      bytes: req.file.size,
      pages: parsed.numpages || null,
      text,
      summary
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to parse PDF." });
  } finally {
    try {
      await fs.unlink(req.file.path);
    } catch (_) {}
  }
});

app.use((err, req, res, next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large. Max 10MB." });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: "Invalid upload. Please upload a PDF (max 10MB)." });
  }

  return res.status(500).json({ error: "Unexpected server error." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});