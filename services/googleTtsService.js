const textToSpeech = require("@google-cloud/text-to-speech");

const ttsClient = new textToSpeech.TextToSpeechClient();

const LANGUAGE_VOICE_MAP = {
  "am-ET": ["am-ET-Wavenet-B", "am-ET-Standard-A"],
  "en-US": ["en-US-Wavenet-D", "en-US-Standard-C"]
};

function getVoiceName(languageCode) {
  const voices = LANGUAGE_VOICE_MAP[languageCode] || LANGUAGE_VOICE_MAP["en-US"];
  return voices[0];
}

function buildSynthesisRequest({ text, languageCode, premiumUnlocked }) {
  const normalizedLang = languageCode === "am-ET" ? "am-ET" : "en-US";
  const baseVoice = getVoiceName(normalizedLang);

  // Premium is required for Wavenet voices.
  const voiceName = premiumUnlocked ? baseVoice : baseVoice.replace("-Wavenet-", "-Standard-");

  return {
    input: { text },
    voice: {
      languageCode: normalizedLang,
      name: voiceName
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: 0.95
    }
  };
}

async function synthesizeSpeech(options) {
  const request = buildSynthesisRequest(options);
  const [response] = await ttsClient.synthesizeSpeech(request);
  return {
    audioContent: response.audioContent,
    voiceName: request.voice.name,
    languageCode: request.voice.languageCode
  };
}

module.exports = {
  synthesizeSpeech
};
