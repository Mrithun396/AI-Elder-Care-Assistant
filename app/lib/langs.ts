export const LANGS: { name: string; code: string }[] = [
  { name: 'Tamil', code: 'ta-IN' },
  { name: 'Hindi', code: 'hi-IN' },
  { name: 'Telugu', code: 'te-IN' },
  { name: 'Malayalam', code: 'ml-IN' },
  { name: 'Kannada', code: 'kn-IN' },
  { name: 'English', code: 'en-IN' },
];

export const GRANDMA_NAME = 'Kamala';

export const DEFAULT_GRANDMA_LANG = 'ta-IN';

export function codeForLang(name: string): string {
  return LANGS.find((l) => l.name === name)?.code ?? DEFAULT_GRANDMA_LANG;
}

const NATIVE: Record<string, string> = {
  'ta-IN': 'தமிழ்',
  'hi-IN': 'हिन्दी',
  'te-IN': 'తెలుగు',
  'ml-IN': 'മലയാളം',
  'kn-IN': 'ಕನ್ನಡ',
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
