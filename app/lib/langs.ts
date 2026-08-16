// Sarvam's Bulbul TTS has voices for exactly these 11 languages — Tamil,
// Hindi, Telugu, Malayalam, Kannada, Bengali, Marathi, Gujarati, Punjabi,
// Odia, and English. The language selector offers only languages with full
// voice support (hear + speak + translate).
export const LANGS: { name: string; code: string }[] = [
  { name: 'Tamil', code: 'ta-IN' },
  { name: 'Hindi', code: 'hi-IN' },
  { name: 'Telugu', code: 'te-IN' },
  { name: 'Malayalam', code: 'ml-IN' },
  { name: 'Kannada', code: 'kn-IN' },
  { name: 'Bengali', code: 'bn-IN' },
  { name: 'Marathi', code: 'mr-IN' },
  { name: 'Gujarati', code: 'gu-IN' },
  { name: 'Punjabi', code: 'pa-IN' },
  { name: 'Odia', code: 'od-IN' },
  { name: 'English', code: 'en-IN' },
];

export const DEFAULT_GRANDMA_LANG = 'ta-IN';

// The grandparent's real name — saved to localStorage at login/signup from
// their profile (see grandparent/login). Everything that used to hardcode a
// persona name (sidebar label, message sender, reply detection) now reads
// this, so the app speaks with the actual grandparent's name.
export function grandmaName(): string {
  if (typeof window === 'undefined') return 'Grandma';
  try {
    const n = localStorage.getItem('bridge-grandma-name');
    if (n && n.trim()) return n.trim();
  } catch {}
  return 'Grandma';
}

export function codeForLang(name: string): string {
  return LANGS.find((l) => l.name === name)?.code ?? DEFAULT_GRANDMA_LANG;
}

const NATIVE: Record<string, string> = {
  'ta-IN': 'தமிழ்',
  'hi-IN': 'हिन्दी',
  'te-IN': 'తెలుగు',
  'ml-IN': 'മലയാളം',
  'kn-IN': 'ಕನ್ನಡ',
  'bn-IN': 'বাংলা',
  'mr-IN': 'मराठी',
  'gu-IN': 'ગુજરાતી',
  'pa-IN': 'ਪੰਜਾਬੀ',
  'od-IN': 'ଓଡ଼ିଆ',
  'en-IN': 'English',
};

export function nativeName(code: string): string {
  return NATIVE[code] ?? code;
}

export function grandmaLangCode(): string {
  if (typeof window === 'undefined') return DEFAULT_GRANDMA_LANG;
  try {
    return localStorage.getItem('bridge-lang') || DEFAULT_GRANDMA_LANG;
  } catch {
    return DEFAULT_GRANDMA_LANG;
  }
}

// Hand-picked Bulbul v3 voices (speaker ids are case-sensitive lowercase).
// Every voice works in every language — a voice is not tied to a specific
// language, so the settings UI shows plain names, no language tags.
export const VOICES: string[] = [
  'shubh', 'rohan', 'kavya', 'ishita', 'roopa', 'tarun', 'suhani', 'rupali',
];

export const DEFAULT_VOICE = 'ishita';

export function grandmaVoice(): string {
  if (typeof window === 'undefined') return DEFAULT_VOICE;
  try {
    const v = localStorage.getItem('bridge-voice');
    return v && VOICES.includes(v) ? v : DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

/** Display label for a voice id — capitalized name, no language tag. */
export function voiceLabel(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}
