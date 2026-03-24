# PDF-to-Speech Pro (Node + Express)

## What it does
- Upload a PDF (max **10MB**) → extracts text with `pdf-parse`
- Generates a simple **key-sentence summary** (frequency-based scoring)
- Plays audio **client-side** using the browser’s **Web Speech API** (fast + no server TTS cost)
- Includes a **PWA scaffold** (manifest + service worker)

## Run locally
```bash
npm install
npm run dev
```
Open:
- `http://localhost:3000/` (landing)
- `http://localhost:3000/app.html` (app)

## Deploy to Render
- Build command: `npm install`
- Start command: `npm start`
- Node version: **18+**

The server listens on `process.env.PORT`.

## Notes
- Uploads are stored temporarily and **deleted immediately after parsing**.
- “Download Audio” is included in the UI, but modern browsers generally **don’t allow exporting** Web Speech output to MP3/WAV reliably without server-side TTS.

