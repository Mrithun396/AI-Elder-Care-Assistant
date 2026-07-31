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
