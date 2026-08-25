// app/lib/audio.ts
// One shared <audio> element for the whole app.
//
// Because only a single audio element ever exists, two readers can never
// overlap: assigning a new `src` aborts any playback already in progress on
// that element. That makes "echo" from rapid taps — or from the reply
// notifier and a message bubble reading at the same time — structurally
// impossible. Components keep their own busy-guards to avoid wasted TTS
// requests; this module is the safety net that guarantees no overlap.

let audio: HTMLAudioElement | null = null;
let current: { finish: () => void } | null = null;

/** Play a base64 WAV. Any playback already in progress is stopped first. */
export function playSpeech(base64Wav: string, onEnd?: () => void) {
  // Whoever is playing right now is about to be interrupted — tell its owner
  // so UI state (pulsing/spinning indicators) resets immediately.
  current?.finish();

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (current?.finish === finish) current = null;
    onEnd?.();
  };
  current = { finish };

  if (!audio) audio = new Audio();
  audio.onended = finish;
  // Assigning a new src aborts the previous playback on the same element.
  audio.src = `data:audio/wav;base64,${base64Wav}`;
  audio.play().catch(finish);
}

/** Stop whatever is playing (no-op if nothing is). */
export function stopSpeech() {
  current?.finish();
  current = null;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
}

// ── Browser TTS (free, instant, lower quality than Sarvam) ───────────────
// Used as an instant-fallback while Sarvam TTS generates in the background.
// When Sarvam audio arrives, call stopBrowserTts() to cut it, then playSpeech()
// with the higher-quality WAV.
let browserSpeaking = false;

/**
 * Speak text immediately using the browser's built-in speech synthesis.
 * Returns instantly (non-blocking). Call `stopBrowserTts()` to cut it short.
 * Only speaks if a voice exists for `langCode` — silence beats garbled speech.
 */
export function speakWithBrowserTts(
  text: string,
  langCode: string,
  onEnd?: () => void
) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!synth) {
    onEnd?.();
    return;
  }
  const exact = langCode.toLowerCase();
  const primary = langCode.split('-')[0].toLowerCase();
  const pickVoice = () =>
    synth.getVoices().find((v) => v.lang.toLowerCase() === exact) ||
    synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(primary)) || null;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    browserSpeaking = false;
    onEnd?.();
  };

  const speakNow = (voice: SpeechSynthesisVoice | null) => {
    if (!voice) {
      finish();
      return;
    }
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = langCode;
      utter.voice = voice;
      utter.rate = 1.0; // normal speed for instant playback
      window.setTimeout(finish, 15000); // watchdog
      utter.onend = finish;
      utter.onerror = finish;
      browserSpeaking = true;
      synth.speak(utter);
    } catch {
      finish();
    }
  };

  const voice = pickVoice();
  if (voice) {
    speakNow(voice);
    return;
  }
  if (synth.getVoices().length === 0) {
    // Chrome loads voices async — wait once
    const onVoices = () => {
      synth.removeEventListener('voiceschanged', onVoices);
      speakNow(pickVoice());
    };
    synth.addEventListener('voiceschanged', onVoices);
    window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', onVoices);
      speakNow(pickVoice());
    }, 3000);
    return;
  }
  finish(); // no matching voice — stay silent
}

/** Stop any in-progress browser TTS (no-op if nothing is playing). */
export function stopBrowserTts() {
  if (browserSpeaking) {
    window.speechSynthesis?.cancel();
    browserSpeaking = false;
  }
}
