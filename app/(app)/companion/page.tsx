'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Sparkles, BookOpen, Newspaper, MessagesSquare, Laugh, Volume2, CalendarCheck } from 'lucide-react';
import { T, translate, useLang, type LangKey } from '../../lib/i18n';
import { grandmaLangCode, grandmaVoice } from '../../lib/langs';
import { playSpeech, stopSpeech } from '../../lib/audio';

type Turn = { from: 'user' | 'ai'; text: string; uid: number };
type Cached = { text: string; audio: string };

// Chat-thread memory: the conversation is persisted per language (localStorage,
// like the medicines/reminders state) so it survives page reloads — grandma
// returns and the companion remembers what they talked about. Restored on mount
// and swapped when the language changes. localStorage (not Supabase) keeps this
// zero-friction on the single-tablet demo; the model still only sees the last
// few exchanges as context.
const CHAT_STORAGE_PREFIX = 'bridge-chat-';
const MAX_STORED_TURNS = 40;

function chatStorageKey(lang: LangKey): string {
  return `${CHAT_STORAGE_PREFIX}${lang}`;
}

function isTurn(x: unknown): x is Turn {
  if (typeof x !== 'object' || x === null) return false;
  const t = x as Turn;
  return (
    (t.from === 'user' || t.from === 'ai') &&
    typeof t.text === 'string' &&
    typeof t.uid === 'number'
  );
}

function loadSavedTurns(lang: LangKey): Turn[] {
  try {
    const raw = localStorage.getItem(chatStorageKey(lang));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isTurn)) {
        return parsed;
      }
      localStorage.removeItem(chatStorageKey(lang)); // corrupt/legacy — reset
    }
  } catch {
    // storage unavailable — start fresh
  }
  return [{ from: 'ai', text: translate(lang, 'comp.welcome'), uid: 0 }];
}

const SUGGESTIONS = [
  { intent: 'story', icon: BookOpen },
  { intent: 'news', icon: Newspaper },
  { intent: 'talk', icon: MessagesSquare },
  { intent: 'joke', icon: Laugh },
  { intent: 'checkin', icon: CalendarCheck },
] as const;

// Scripted replies (English) — translated into grandma's language via Sarvam's
// casual (modern-colloquial) register before being read aloud.
const REPLIES: Record<string, string> = {
  story:
    'Of course, Grandma! Once upon a time, in a small village by the river, there lived a wise old woman who grew the sweetest mangoes in the land. Every evening, her grandchildren would sit under the tree while she told them tales of brave kings and clever monkeys… Would you like me to continue?',
  news:
    'Here is today’s news for you, Grandma! The weather is warm and sunny, your garden flowers are blooming, and most importantly, your family is thinking of you. Is there anything else you would like to know?',
  talk:
    'Of course, Grandma! I love talking with you. Tell me — how was your day today? Did you have your meals on time? I am always here to listen.',
  health:
    'Let’s take care of your health, Grandma. Remember: Metformin and Telmisartan in the morning, Vitamin D after lunch, and Aspirin after dinner. Would you like a reminder when it is time?',
  family:
    'Your family loves you so much, Grandma! Arun and Priya are thinking of you. Would you like to send them a voice message? Just go to Messages and speak.',
  time:
    'Right now it is a good time for anything you like, Grandma! Would you like a story, some news, or just a chat?',
  checkin:
    'Let’s see how your day is going, Grandma! You have been keeping up with your medicines and your readings — I am so proud of you. How are you feeling right now?',
  default:
    'That sounds lovely, Grandma! Tell me a little more about it — I am always happy to listen and talk with you.',
};

// Scripted English replies keep "Grandma" as a placeholder — Sarvam leaves
// proper nouns untranslated (seen live: "ரொம்ப நல்லா இருக்கு Grandma!"), so we
// swap in the right affectionate term AFTER translation per language. This way
// Tamil gets பாட்டி, Hindi gets दादी, and English gets Paati (never Grandma).
const ADDRESS: Record<string, string> = {
  'ta-IN': 'பாட்டி',
  'hi-IN': 'दादी',
  'te-IN': 'అమ్మమ్మ',
  'ml-IN': 'അമ്മമ്മ',
  'kn-IN': 'ಅಜ್ಜಿ',
  'bn-IN': 'দিদিমা',
  'mr-IN': 'आजी',
  'gu-IN': 'દાદી',
  'pa-IN': 'ਦਾਦੀ',
  'od-IN': 'ଜେଜେମା',
  'en-IN': 'Paati',
};

function localizeAddress(text: string, target: string): string {
  return text.replace(/\bGrandma\b/g, ADDRESS[target] || 'Paati');
}

// Short yes/no replies to "shall I ask another riddle?" — the riddle flow ends
// with that question, so the next utterance is a consent answer, not a command.
// Covers all 11 languages so a judge can answer in their own tongue.
const CONSENT_YES = [
  'சரி', 'ஆமாம்', 'ஆமா', 'சரிங்க', 'ஓகே', 'yes', 'ok', 'okay', 'sure',
  'हाँ', 'हां', 'ठीक है', // hi
  'అవును', 'సరే', // te
  'ശരി', 'അതെ', // ml
  'ಸರಿ', 'ಹೌದು', // kn
  'হ্যাঁ', 'হাঁ', 'হুম', 'ঠিক আছে', // bn
  'हो', 'होय', 'ठीक आहे', // mr
  'હા', 'બરાબર', 'ઠીક છે', // gu
  'ਹਾਂ', 'ਹਾਂਜੀ', 'ਠੀਕ ਹੈ', // pa
  'ହଁ', 'ଠିକ ଅଛି', // od
];
const CONSENT_NO = [
  'வேண்டாம்', 'வேணாம்', 'இல்லை', 'இல்ல', 'no', 'போதும்',
  'नहीं', // hi
  'వద్దు', 'లేదు', // te
  'വേണ്ട', 'ഇല്ല', // ml
  'ಬೇಡ', 'ಇಲ್ಲ', // kn
  'না', 'দরকার নেই', // bn
  'नाही', 'नको', // mr
  'ના', 'નથી', // gu
  'ਨਹੀਂ', 'ਨਾ', // pa
  'ନାହିଁ', 'ନୁହେଁ', // od
];

// Native Tamil riddles (விடுகதை). Authored in Tamil so the wordplay survives —
// English jokes get destroyed in translation, but these are riddle puzzles that
// carry across languages naturally. `aEn` is used when grandma's language is
// not Tamil (the question still translates, but the answer reads correctly).
type Riddle = { q: string; a: string; aEn: string };
const RIDDLES: Riddle[] = [
  { q: 'மரத்தில் பிறந்து, தண்ணீரில் சாகும்', a: 'காகிதம்', aEn: 'paper' },
  { q: 'வெள்ளை வீடு, உள்ளே மஞ்சள் குடியிருப்பாள்', a: 'முட்டை', aEn: 'an egg' },
  { q: 'காலையில் நான்கு கால், மதியம் இரண்டு கால், மாலையில் மூன்று கால்', a: 'மனிதன்', aEn: 'a human being' },
  { q: 'நீரில் பிறந்து, நீரிலேயே வளரும்', a: 'தாமரை', aEn: 'a lotus' },
  { q: 'காலையில் கிழக்கில் எழும், மாலையில் மேற்கில் மறையும்', a: 'சூரியன்', aEn: 'the sun' },
];

// 'சொல்லு'/'சொல்லுங்கள்' (tell) are intentionally excluded — they also match
// the story intent, and a pending riddle shouldn't swallow "ஒரு கதை சொல்லு".
// English "i dont know" is common too, so it counts as a gentle give-up.
const RIDDLE_GIVE_UP_WORDS = [
  'விடை',
  'பதில்',
  'answer',
  'give up',
  'தெரியாது',
  'dont know',
  "don't know",
  // Bengali / Marathi / Gujarati / Punjabi / Odia "I don't know"
  'জানি না',
  'माहित नाही',
  'ખબર નથી',
  'ਪਤਾ ਨਹੀਂ',
  'ଜାଣି ନାହିଁ',
];

// Keyword intent detection across all 11 supported languages (the ones that
// have Sarvam voices). When ChatGPT is enabled these are only a first-pass
// router — the LLM understands everything natively — but they keep the
// scripted fallback working in any language a judge might speak.
const INTENTS: { intent: string; keywords: string[] }[] = [
  {
    intent: 'recall',
    keywords: [
      'என்ன நினைவு', 'என்ன ஞாபகம்', 'நினைவூட்டு', 'remind me', 'recall', 'ஞாபகப்படுத்து',
      // bn / mr / gu / pa / od
      'মনে করান', 'মনে পড়ে', 'आठवण', 'आठवण करून दे', 'યાદ અપાવો', 'યાદ કરાવો', 'ਯਾਦ ਦਿਵਾਓ', 'ਯਾਦ ਕਰਵਾਓ', 'ମନେ ପକାଅ', 'ମନେ କରେଇଦିଅ',
    ],
  },
  // 'சொல்லு' (tell) is intentionally NOT a story keyword — it's too generic and
  // hijacks requests like "பதில் சொல்லு" (tell the answer) into a story.
  // "ஒரு கதை சொல்லு" still matches via 'கதை'.
  {
    intent: 'story',
    keywords: ['கதை', 'story', 'कहानी', 'গল্প', 'गोष्ट', 'વાર્તા', 'ਕਹਾਣੀ', 'ଗପ', 'କାହାଣୀ'],
  },
  { intent: 'news', keywords: ['செய்தி', 'news', 'खबर', 'புதுசு', 'খবর', 'बातमी', 'સમાચાર', 'ਖਬਰ', 'ଖବର'] },
  {
    intent: 'joke',
    keywords: ['நகைச்சுவை', 'joke', 'சிரிப்பு', 'चुटकुला', 'சிரிக்க', 'ধাঁধা', 'ঠাট্টা', 'कोडे', 'विनोद', 'કોયડો', 'મજાક', 'ਪਹੇਲੀ', 'ਮਜ਼ਾਕ', 'ପହେଳି'],
  },
  {
    intent: 'health',
    keywords: ['உடல்நலம்', 'health', 'மருந்து', 'medicine', 'சுகாதாரம்', 'सेहत', 'স্বাস্থ্য', 'ঔষধ', 'आरोग्य', 'औषध', 'સ્વાસ્થ્ય', 'દવા', 'ਸਿਹਤ', 'ਦਵਾਈ', 'ସ୍ୱାସ୍ଥ୍ୟ', 'ଔଷଧ'],
  },
  { intent: 'sugar', keywords: ['சர்க்கரை', 'sugar', 'blood sugar', 'शुगर', 'চিনি', 'সুগার', 'साखर', 'ખાંડ', 'સુગર', 'ਸ਼ੂਗਰ', 'ਖੰਡ', 'ସୁଗାର', 'ଚିନି'] },
  {
    intent: 'bp',
    keywords: ['இரத்த அழுத்தம்', 'blood pressure', 'அழுத்தம்', 'bp', 'बीपी', 'ब्लड प्रेशर', 'রক্তচাপ', 'ব্লাড প্রেসার', 'रक्तदाब', 'લોહીનું દબાણ', 'બ્લડ પ્રેશર', 'ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ', 'ਖੂਨ ਦਾ ਦਬਾਅ', 'ରକ୍ତଚାପ', 'ବ୍ଲଡ ପ୍ରେସର'],
  },
  {
    intent: 'steps',
    keywords: ['steps', 'நடை', 'நடந்தேன்', 'walked', 'कदम', 'পদক্ষেপ', 'হেঁটেছি', 'पावले', 'चाललो', 'પગલાં', 'ચાલ્યો', 'ਕਦਮ', 'ਤੁਰਿਆ', 'କଦମ', 'ଚାଲିଲି'],
  },
  {
    intent: 'remember',
    keywords: ['நினைவில் வை', 'நினைவு வை', 'ஞாபகம் வை', 'remember', 'note down', 'याद', 'মনে রাখো', 'মনে রাখবেন', 'लक्षात ठेव', 'યાદ રાખો', 'યાદ રાખ', 'ਯਾਦ ਰੱਖੋ', 'ਯਾਦ ਰੱਖ', 'ମନେ ରଖ', 'ମନେ ରଖନ୍ତୁ'],
  },
  {
    intent: 'family',
    keywords: ['குடும்பம்', 'family', 'மகன்', 'மகள்', 'arun', 'priya', 'परिवार', 'बेटा', 'পরিবার', 'ছেলে', 'মেয়ে', 'कुटुंब', 'मुलगा', 'मुलगी', 'પરિવાર', 'દીકરો', 'દીકરી', 'ਪਰਿਵਾਰ', 'ਬੇਟਾ', 'ਬੇਟੀ', 'ପରିବାର', 'ପୁଅ', 'ଝିଅ'],
  },
  { intent: 'time', keywords: ['நேரம்', 'time', 'மணி', 'समय', 'সময়', 'বেলা', 'वेळ', 'સમય', 'ਸਮਾਂ', 'ਵੇਲਾ', 'ସମୟ'] },
];

// Intents that need real work (parse a number, save to Supabase, recall) rather
// than a canned scripted reply.
const DYNAMIC_INTENTS = ['sugar', 'bp', 'steps', 'remember', 'recall', 'joke'];

// Loose riddle-guess matching: normalizes both sides (Tamil + Latin scripts),
// then accepts exact, substring, or shared-token matches.
function riddleMatch(guess: string, answer: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\u0b80-\u0bffa-z0-9]+/g, ' ')
      .trim();
  const g = norm(guess);
  const a = norm(answer);
  if (!g || !a) return false;
  if (g === a || g.includes(a) || a.includes(g)) return true;
  const gw = g.split(' ').filter((w) => w.length > 1);
  const aw = a.split(' ').filter((w) => w.length > 1);
  return aw.some((w) => gw.includes(w));
}

// Number words (English + Tamil) for spoken readings like "one forty" or
// "நூற்று நாற்பது" — Sarvam often returns digits, but this covers word forms.
const WORD_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000,
  பூஜ்யம்: 0, ஒன்று: 1, ரெண்டு: 2, இரண்டு: 2, மூணு: 3, மூன்று: 3, நாலு: 4, நான்கு: 4,
  ஐந்து: 5, ஆறு: 6, ஏழு: 7, எட்டு: 8, ஒன்பது: 9, பத்து: 10, இருபது: 20, முப்பது: 30,
  நாற்பது: 40, ஐம்பது: 50, அறுபது: 60, எழுபது: 70, எண்பது: 80, தொண்ணூறு: 90,
  நூறு: 100, நூற்று: 100, ஆயிரம்: 1000,
};

const REMEMBER_TRIGGERS = ['நினைவில் வை', 'நினைவு வை', 'ஞாபகம் வை', 'remember', 'note down', 'याद रखना', 'याद रखो'];
const MEMORY_CATEGORIES: { cat: string; keywords: string[] }[] = [
  { cat: 'hospital', keywords: ['மருத்துவர்', 'மருத்துவமனை', 'டாக்டர்', 'hospital', 'doctor', 'appointment', 'checkup'] },
  { cat: 'date', keywords: ['நாள்', 'தேதி', 'date', 'birthday', 'anniversary'] },
  { cat: 'todo', keywords: ['செய்ய', 'வேண்டும்', 'must', 'need to', 'should', 'remember to'] },
];

function wordsToNumber(tokens: string[]): number | null {
  let total = 0;
  let current = 0;
  for (const t of tokens) {
    const v = WORD_NUM[t];
    if (v === undefined) return null;
    if (v === 100) {
      current = current === 0 ? 100 : current * 100;
    } else if (v === 1000) {
      current = current === 0 ? 1000 : current * 1000;
      total += current;
      current = 0;
    } else {
      current += v;
    }
  }
  return total + current;
}

function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const digitMatches = text.match(/\d+/g);
  if (digitMatches) for (const d of digitMatches) out.push(parseInt(d, 10));

  // Word-form numbers (Latin + Tamil scripts). wordsToNumber already handles
  // composition (one hundred twenty -> 120, three thousand five hundred -> 3500)
  // and the tokens are pre-filtered to numeric words, so one pass suffices.
  const tokens = text
    .toLowerCase()
    .split(/[^a-z\u0b80-\u0bff]+/)
    .filter((t) => t.length > 0 && WORD_NUM[t] !== undefined);
  if (tokens.length > 0) {
    const n = wordsToNumber(tokens);
    if (n !== null) out.push(n);
  }
  return out;
}

function detectIntent(text: string): string {
  const lower = text.toLowerCase();
  for (const { intent, keywords } of INTENTS) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) return intent;
  }
  return 'default';
}

// Blood pressure comes as either "120/80", "120 over 80", or "one twenty over eighty".
function extractBP(text: string): { sys: number; dia: number } | null {
  const slash = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (slash) return { sys: parseInt(slash[1], 10), dia: parseInt(slash[2], 10) };
  const over = text.match(/(\d{2,3})\s*over\s*(\d{2,3})/i);
  if (over) return { sys: parseInt(over[1], 10), dia: parseInt(over[2], 10) };
  const nums = extractNumbers(text);
  if (nums.length >= 2) return { sys: nums[0], dia: nums[1] };
  return null;
}

// "remember to go to the doctor" -> content is whatever follows the trigger.
function extractRemember(text: string): string {
  let lower = text.toLowerCase();
  let idx = -1;
  for (const tr of REMEMBER_TRIGGERS) {
    const i = lower.indexOf(tr.toLowerCase());
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  let content = text;
  if (idx !== -1) content = text.slice(idx).replace(/^[^\u0b80-\u0bffa-z0-9]+/i, '');
  // Still has a trigger prefix (e.g. "remember that ...")? Strip leading trigger again.
  lower = content.toLowerCase();
  for (const tr of REMEMBER_TRIGGERS) {
    if (lower.startsWith(tr.toLowerCase())) {
      content = content.slice(tr.length).replace(/^[\s,:;.-]+/, '');
      break;
    }
  }
  return content.trim().replace(/[.!?]+$/, '');
}

function memoryCategory(content: string): string {
  const lower = content.toLowerCase();
  for (const { cat, keywords } of MEMORY_CATEGORIES) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) return cat;
  }
  return 'note';
}

export default function CompanionPage() {
  const lang = useLang();
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<Turn[]>([
    { from: 'ai', text: translate(lang, 'comp.welcome'), uid: 0 },
  ]);
  // Whether the server has ChatGPT configured (probed once on mount). When
  // available, conversational turns go through the LLM; otherwise the app
  // falls back to the scripted intent system below.
  const [gptReady, setGptReady] = useState(false);
  // Set right after the companion asks "shall I ask another riddle?" — the next
  // spoken utterance is treated as a yes/no consent answer instead of a command.
  const awaitingConsentRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const busyRef = useRef(false);
  const seqRef = useRef(0);
  const uidRef = useRef(0);
  const nextUid = () => ++uidRef.current;
  // Scripted replies are fixed text, so translate + synthesize each one (per
  // language) once and reuse it — the companion answers instantly on tap
  // instead of waiting on translate + TTS every time (~5-7s).
  const cacheRef = useRef<Map<string, Cached>>(new Map());
  const inflightRef = useRef<Map<string, Promise<Cached>>>(new Map());

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopSpeech();
    };
  }, []);

  // Persist the thread whenever it changes (trimmed to the most recent turns).
  useEffect(() => {
    try {
      localStorage.setItem(
        chatStorageKey(lang),
        JSON.stringify(turns.slice(-MAX_STORED_TURNS))
      );
    } catch {
      // storage unavailable — memory degrades gracefully
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns]);

  // Restore this language's thread on mount, and swap to the selected
  // language's own thread when the language changes. Runs after the first
  // render so the server never sees localStorage (no hydration clash).
  useEffect(() => {
    const t = loadSavedTurns(lang);
    // One-time restore per language (mount or switch) — deliberately replaces
    // the welcome state; safe here because nothing else sets state in this
    // effect and the persist effect only writes localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTurns(t);
    uidRef.current = t.reduce((m, x) => Math.max(m, x.uid), 0);
    // Bump the sequence so any reply still in flight from the previous thread
    // is dropped by its mySeq guard instead of landing in this language's
    // restored conversation (and being persisted there).
    seqRef.current++;
  }, [lang]);

  useEffect(() => {
    let alive = true;
    fetch('/api/chat')
      .then((r) => r.json())
      .then((d) => {
        if (alive) setGptReady(!!d.available);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = async () => {
    if (busyRef.current) return;
    setError('');
    setListening(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : undefined;
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = handleStop;
      recorderRef.current = rec;
      rec.start();
    } catch {
      stopTracks();
      setListening(false);
      setError(translate(lang, 'comp.errMic'));
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setListening(false);
  };

  // Translate a one-off (non-scripted) string into grandma's language, speak
  // it aloud, and show it as the companion's turn. `source` is the language
  // the text is authored in — Tamil-native content (riddles) is spoken
  // directly when the UI is Tamil, and translated on the fly otherwise.
  const speakDynamic = async (enText: string, mySeq: number, source: string = 'en-IN') => {
    busyRef.current = true;
    try {
      const target = grandmaLangCode();
      let text = enText;
      if (target !== source) {
        const tr = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: enText,
            source_language_code: source,
            target_language_code: target,
          }),
        });
        const trData = await tr.json();
        if (!tr.ok || !trData.translated_text) throw new Error(trData.error || 'reply failed');
        text = trData.translated_text;
      }
      // Scripted English says "Grandma"; swap in the right term for the target
      // language (பாட்டி / दादी / Paati…) after translation.
      text = localizeAddress(text, target);
      if (mySeq !== seqRef.current) {
        setThinking(false);
        return;
      }
      const turnUid = nextUid();
      setTurns((t) => [...t, { from: 'ai', text, uid: turnUid }]);
      const tts = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_language_code: target, speaker: grandmaVoice() }),
      });
      const ttsData = await tts.json();
      if (mySeq !== seqRef.current) {
        setThinking(false);
        return;
      }
      // Only release the mic once the reply is actually ready to play, so a
      // tap during the translate/TTS window can't start a second recording.
      setThinking(false);
      setSpeakingId(turnUid);
      playSpeech(ttsData.audio, () => {
        if (seqRef.current === mySeq) setSpeakingId(null);
      });
    } catch (err: any) {
      setThinking(false);
      setError(err.message || translate(lang, 'comp.errReply'));
    } finally {
      busyRef.current = false;
    }
  };

  // Pending riddle awaiting grandma's guess, plus the most recent riddle so its
  // answer can be re-revealed even after it has been consumed.
  const riddleRef = useRef<Riddle | null>(null);
  const lastRiddleRef = useRef<Riddle | null>(null);

  // Route the dynamic intents (health readings, steps, memory, riddles) — parse what was
  // said, persist to Supabase, then confirm aloud.
  const handleDynamic = async (intent: string, said: string, mySeq: number) => {
    if (intent === 'joke') {
      // Native Tamil riddle (விடுகதை). The question is authored in Tamil and
      // spoken directly in Tamil, or translated on the fly for other languages.
      // The pending riddle is stored so the next spoken utterance is treated
      // as grandma's guess.
      const riddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
      riddleRef.current = riddle;
      lastRiddleRef.current = riddle;
      await speakDynamic(
        `${riddle.q}? என்ன என்று சொல்லுங்கள், பாட்டி!`,
        mySeq,
        'ta-IN'
      );
      return;
    }
    if (intent === 'sugar') {
      const nums = extractNumbers(said);
      const n = nums[0];
      if (n === undefined) {
        await speakDynamic('I heard sugar, but I could not catch the number. Please say it again, like: sugar 140.', mySeq);
        return;
      }
      try {
        const res = await fetch('/api/health-checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric: 'sugar', value: String(n), unit: 'mg/dL', note: said }),
        });
        if (!res.ok) throw new Error('save failed');
        const savedSugar = await res.json().catch(() => null);
        const sugarWarn = savedSugar?.flagged
          ? ' That reading is outside your usual range, Paati — please take care and rest a little.'
          : '';
        await speakDynamic(`Done, Grandma! I have recorded your sugar as ${n}. I will tell your family.${sugarWarn}`, mySeq);
      } catch {
        setThinking(false);
        setError(translate(lang, 'comp.errSave'));
      }
    } else if (intent === 'bp') {
      const bp = extractBP(said);
      if (!bp) {
        await speakDynamic('I heard blood pressure, but I could not catch the numbers. Please say it again, like: blood pressure 120 over 80.', mySeq);
        return;
      }
      try {
        const res = await fetch('/api/health-checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric: 'bp', value: `${bp.sys}/${bp.dia}`, unit: 'mmHg', note: said }),
        });
        if (!res.ok) throw new Error('save failed');
        const savedBp = await res.json().catch(() => null);
        const bpWarn = savedBp?.flagged
          ? ' That reading is outside your usual range, Paati — please rest and take care.'
          : '';
        await speakDynamic(`Done, Grandma! Blood pressure ${bp.sys} over ${bp.dia} — recorded.${bpWarn}`, mySeq);
      } catch {
        setThinking(false);
        setError(translate(lang, 'comp.errSave'));
      }
    } else if (intent === 'steps') {
      const nums = extractNumbers(said);
      const n = nums[0];
      if (n === undefined) {
        await speakDynamic('I heard steps, but I could not catch the count. Please say it again, like: I walked 3000 steps today.', mySeq);
        return;
      }
      try {
        const res = await fetch('/api/health-checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric: 'steps', value: String(n), unit: 'steps', note: said }),
        });
        if (!res.ok) throw new Error('save failed');
        await speakDynamic(`Great job, Grandma! I have recorded ${n} steps today.`, mySeq);
      } catch {
        setThinking(false);
        setError(translate(lang, 'comp.errSave'));
      }
    } else if (intent === 'remember') {
      const content = extractRemember(said);
      if (!content) {
        await speakDynamic('What would you like me to remember? Please tell me again.', mySeq);
        return;
      }
      try {
        const res = await fetch('/api/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, category: memoryCategory(content) }),
        });
        if (!res.ok) throw new Error('save failed');
        await speakDynamic(`I will remember that, Grandma: ${content}.`, mySeq);
      } catch {
        setThinking(false);
        setError(translate(lang, 'comp.errSave'));
      }
    } else if (intent === 'recall') {
      try {
        const res = await fetch('/api/memories');
        if (!res.ok) throw new Error('recall failed');
        const list = await res.json();
        const mems: { content: string }[] = Array.isArray(list) ? list : [];
        if (mems.length === 0) {
          await speakDynamic('You have not asked me to remember anything yet, Grandma.', mySeq);
          return;
        }
        const top = mems.slice(0, 3).map((m) => m.content).join('. ');
        await speakDynamic(`Here is what you asked me to remember: ${top}.`, mySeq);
      } catch {
        setThinking(false);
        setError(translate(lang, 'comp.errRecall'));
      }
    }
  };

  // A riddle is pending — treat this utterance as grandma's guess (or give-up).
  const guessRiddle = async (said: string, mySeq: number) => {
    const riddle = riddleRef.current;
    riddleRef.current = null; // consume the pending riddle either way
    if (!riddle) {
      setThinking(false);
      return;
    }
    lastRiddleRef.current = riddle;
    const lower = said.toLowerCase();
    const gaveUp = RIDDLE_GIVE_UP_WORDS.some((w) => lower.includes(w));
    const correct =
      !gaveUp && (riddleMatch(said, riddle.a) || riddleMatch(said, riddle.aEn));
    const text = correct
      ? `சரியான பதில், பாட்டி! 🎉 பதில்: ${riddle.a}. உங்களுக்கு மேலும் ஒரு விடுகதை கேட்கலாமா?`
      : gaveUp
      ? `பரவாயில்லை பாட்டி, பதில்: ${riddle.a}. மேலும் ஒரு விடுகதை கேட்கலாமா?`
      : `நல்ல யூகம், ஆனால் சரியல்ல! பதில்: ${riddle.a}. மேலும் ஒரு விடுகதை கேட்கலாமா?`;
    await speakDynamic(text, mySeq, 'ta-IN');
    // The reveal ends with "shall I ask another riddle?" — the next spoken
    // utterance is a yes/no consent answer, not a fresh command.
    awaitingConsentRef.current = true;
  };

  // Real "memory of the day": pull today's health readings, medicines taken
  // (from the same localStorage the Medicines page writes), and saved notes so
  // ChatGPT knows what's actually been going on, not just the chat history.
  const buildDayContext = async (): Promise<string> => {
    try {
      const [checkins, meds, memories] = await Promise.all([
        fetch('/api/health-checkins').then((r) => r.json()).catch(() => null),
        fetch('/api/medicines').then((r) => r.json()).catch(() => null),
        fetch('/api/memories').then((r) => r.json()).catch(() => null),
      ]);
      const parts: string[] = [];
      const dateStr = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      if (Array.isArray(checkins) && checkins.length > 0) {
        const latest: Record<string, string> = {};
        for (const c of checkins) {
          if (!latest[c.metric]) latest[c.metric] = `${c.value}${c.unit ? ' ' + c.unit : ''}`;
        }
        const bits: string[] = [];
        if (latest.sugar) bits.push(`sugar ${latest.sugar}`);
        if (latest.bp) bits.push(`blood pressure ${latest.bp}`);
        if (latest.steps) bits.push(`${latest.steps} steps`);
        if (bits.length > 0) parts.push(`Latest health readings: ${bits.join(', ')}.`);
      }
      if (Array.isArray(meds) && meds.length > 0) {
        let taken: Record<string, boolean> = {};
        try {
          taken = JSON.parse(localStorage.getItem(`bridge-meds-${new Date().toDateString()}`) || '{}');
        } catch {}
        const names = meds.filter((m) => taken[m.id]).map((m) => m.name);
        parts.push(
          names.length > 0
            ? `Medicines taken today: ${names.join(', ')}.`
            : 'No medicines marked as taken yet today.'
        );
      }
      if (Array.isArray(memories) && memories.length > 0) {
        parts.push(`${memories.length} saved note${memories.length === 1 ? '' : 's'}.`);
      }
      return parts.length > 0 ? `${dateStr}. ${parts.join(' ')}` : '';
    } catch {
      return '';
    }
  };

  // ChatGPT as the conversation brain: send the recent turns (plus the new
  // utterance) with a persona system prompt, then speak the reply. Falls back
  // to the scripted system below when /api/chat is unavailable, and degrades
  // to the scripted reply for this intent if the call fails mid-conversation.
  const chatViaGPT = async (userText: string, mySeq: number, fallbackIntent?: string) => {
    busyRef.current = true;
    try {
      const target = grandmaLangCode();
      const history = [
        ...turns.map((t) => ({
          role: t.from === 'user' ? ('user' as const) : ('assistant' as const),
          content: t.text,
        })),
        { role: 'user' as const, content: userText },
      ].slice(-12); // keep the last ~6 exchanges for context
      const context = await buildDayContext();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context, target_language_code: target }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'chat failed');
      if (mySeq !== seqRef.current) {
        setThinking(false);
        return;
      }
      const turnUid = nextUid();
      setTurns((t) => [...t, { from: 'ai', text: data.text, uid: turnUid }]);
      const tts = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.text, target_language_code: target, speaker: grandmaVoice() }),
      });
      const ttsData = await tts.json();
      if (!tts.ok || !ttsData.audio) throw new Error('tts failed');
      if (mySeq !== seqRef.current) {
        setThinking(false);
        return;
      }
      setThinking(false);
      setSpeakingId(turnUid);
      playSpeech(ttsData.audio, () => {
        if (seqRef.current === mySeq) setSpeakingId(null);
      });
    } catch (err: any) {
      setThinking(false);
      // A transient ChatGPT hiccup shouldn't leave grandma with an error — fall
      // back to the still-warm scripted reply for this intent.
      if (fallbackIntent) {
        await reply(fallbackIntent, mySeq);
        return;
      }
      setError(err.message || translate(lang, 'comp.errReply'));
    } finally {
      busyRef.current = false;
    }
  };

  const handleStop = async () => {
    const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || 'audio/webm' });
    stopTracks();
    if (blob.size < 1000) {
      setError(translate(lang, 'comp.errSilent'));
      return;
    }
    setThinking(true);
    setError('');
    try {
      const fd = new FormData();
      const ext = (recorderRef.current?.mimeType || 'audio/webm').includes('mp4') ? 'mp4' : 'webm';
      fd.append('audio', blob, `companion.${ext}`);
      const res = await fetch('/api/translate-voice?mode=transcribe', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'transcribe failed');
      const said: string = (data.original_text || '').trim();
      if (!said) {
        setThinking(false);
        setError(translate(lang, 'comp.errSilent'));
        return;
      }
      const mySeq = ++seqRef.current;
      setTurns((t) => [...t, { from: 'user', text: said, uid: nextUid() }]);
      const intent = detectIntent(said);
      const lower = said.toLowerCase();
      // If a riddle is pending, the next utterance is grandma's guess — UNLESS
      // it's clearly a real command (e.g. "சர்க்கரை 140"), which wins instead.
      if (riddleRef.current) {
        const gaveUp = RIDDLE_GIVE_UP_WORDS.some((w) => lower.includes(w));
        if (gaveUp || intent === 'default') {
          await guessRiddle(said, mySeq);
          return;
        }
        riddleRef.current = null; // user moved on to a real command
      }
      // The companion just asked "shall I ask another riddle?" — a short
      // yes/no (சரி / ஆமாம் / வேண்டாம் / no…) answers that. Gated on
      // intent === 'default' (like the riddle-guess and asksAnswer checks) so
      // a real command that happens to contain a consent word — e.g.
      // "சரி, வேற கதை சொல்லு" (ok, but tell a different story) — wins instead
      // of being hijacked into another riddle. Any other utterance falls
      // through to normal handling.
      if (awaitingConsentRef.current && intent === 'default') {
        awaitingConsentRef.current = false; // consume the consent either way
        const yes = CONSENT_YES.some((w) => lower.includes(w));
        const no = CONSENT_NO.some((w) => lower.includes(w));
        if (yes && !no) {
          await handleDynamic('joke', '', mySeq);
          return;
        }
        if (no && !yes) {
          await speakDynamic(
            'No problem, Paati! What would you like to do instead — a story, some news, or just a chat?',
            mySeq
          );
          return;
        }
      } else if (awaitingConsentRef.current) {
        awaitingConsentRef.current = false; // user moved on to a real command
      }
      // Asking for the answer to a riddle that was already revealed?
      // "எனக்கு அதோட பதில் சொல்லு" resolves to intent 'default' (after the
      // 'சொல்லு' story-keyword removal), so this is caught before the generic
      // reply path. Gated on intent === 'default' so a REAL command that happens
      // to contain பதில்/answer (e.g. "உடல்நலம் பதில்") can't be hijacked.
      const asksAnswer =
        intent === 'default' &&
        !!lastRiddleRef.current &&
        ['பதில்', 'விடை', 'answer', 'উত্তর', 'उत्तर', 'જવાબ', 'ਜਵਾਬ', 'ଉତ୍ତର'].some((w) => lower.includes(w));
      if (asksAnswer) {
        const r = lastRiddleRef.current;
        if (!r) {
          setThinking(false);
          return;
        }
        await speakDynamic(
          `பதில்: ${r.a}. மேலும் ஒரு விடுகதை கேட்கலாமா, பாட்டி?`,
          mySeq,
          'ta-IN'
        );
        // Same as guessRiddle: the reveal asks "another riddle?", so the next
        // utterance is a yes/no consent answer.
        awaitingConsentRef.current = true;
        return;
      }
      if (DYNAMIC_INTENTS.includes(intent)) {
        await handleDynamic(intent, said, mySeq);
      } else if (gptReady) {
        // Conversational turns get the full ChatGPT brain (with context of the
        // whole chat) — this is what makes "சரி." after a question work.
        await chatViaGPT(said, mySeq, intent);
      } else {
        await reply(intent, mySeq);
      }
    } catch (err: any) {
      setThinking(false);
      setError(err.message || translate(lang, 'comp.errTranscribe'));
    }
  };

  const ensureCached = async (intent: string, target: string): Promise<Cached> => {
    const key = `${intent}:${target}`;
    const hit = cacheRef.current.get(key);
    if (hit) return hit;
    const existing = inflightRef.current.get(key);
    if (existing) return existing;
    const p = (async () => {
      const scripted = REPLIES[intent] || REPLIES.default;
      // When the UI language is English there is nothing to translate
      // (en-IN -> en-IN is rejected by Sarvam with a 400). Reply in English
      // directly instead of calling the API.
      let text = scripted;
      if (target !== 'en-IN') {
        const tr = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: scripted,
            source_language_code: 'en-IN',
            target_language_code: target,
          }),
        });
        const trData = await tr.json();
        if (!tr.ok || !trData.translated_text) throw new Error(trData.error || 'reply failed');
        text = trData.translated_text;
      }
      // Localize the address BEFORE TTS so the audio matches the text.
      text = localizeAddress(text, target);
      const tts = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_language_code: target, speaker: grandmaVoice() }),
      });
      const ttsData = await tts.json();
      if (!tts.ok || !ttsData.audio) throw new Error('tts failed');
      const entry: Cached = { text, audio: ttsData.audio };
      cacheRef.current.set(key, entry);
      return entry;
    })();
    inflightRef.current.set(key, p);
    try {
      return await p;
    } finally {
      inflightRef.current.delete(key);
    }
  };

  // Reply using the cache — near-instant on tap.
  const reply = async (intent: string, mySeq?: number) => {
    if (mySeq === undefined) mySeq = ++seqRef.current;
    busyRef.current = true;
    try {
      const target = grandmaLangCode();
      const { text, audio } = await ensureCached(intent, target);
      if (mySeq !== seqRef.current) {
        setThinking(false);
        return;
      }
      const turnUid = nextUid();
      setTurns((t) => [...t, { from: 'ai', text, uid: turnUid }]);
      setThinking(false);
      setSpeakingId(turnUid);
      playSpeech(audio, () => {
        if (seqRef.current === mySeq) setSpeakingId(null);
      });
    } catch (err: any) {
      setThinking(false);
      setError(err.message || translate(lang, 'comp.errReply'));
    } finally {
      busyRef.current = false;
    }
  };

  const toggleMic = () => {
    if (listening) stop();
    else start();
  };

  const pick = (intent: string) => {
    if (busyRef.current || thinking) return;
    setError('');
    awaitingConsentRef.current = false; // a tap is a fresh command, not a riddle yes/no
    setTurns((t) => [
      ...t,
      { from: 'user', text: translate(lang, `comp.${intent}`), uid: nextUid() },
    ]);
    setThinking(true);
    const mySeq = ++seqRef.current;
    if (DYNAMIC_INTENTS.includes(intent)) {
      // Dynamic intents (riddles, health) run the real flow, not the cache.
      handleDynamic(intent, '', mySeq);
    } else if (gptReady) {
      chatViaGPT(translate(lang, `comp.${intent}`), mySeq, intent);
    } else {
      reply(intent, mySeq);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink"><T k="comp.title" /></h1>
        <p className="text-sm text-ink-muted"><T k="comp.subtitle" /></p>
      </div>

      {/* Mic */}
      <div className="flex flex-col items-center rounded-3xl border border-line bg-card p-8 shadow-soft">
        <button
          onClick={toggleMic}
          disabled={thinking}
          className={`flex h-24 w-24 items-center justify-center rounded-full text-white transition-all ${
            listening
              ? 'bg-terra sos-pulse scale-105'
              : 'bg-gradient-to-br from-accent to-brand shadow-soft hover:scale-105'
          } ${thinking ? 'opacity-60' : ''}`}
          aria-label="Talk to AI"
        >
          {thinking ? <Sparkles size={32} className="animate-spin" /> : <Mic size={36} />}
        </button>
        <p className="mt-4 text-sm font-semibold text-ink">
          <T k={listening ? 'comp.listening' : thinking ? 'comp.thinking' : 'comp.tapToTalk'} />
        </p>
        <p className="text-xs text-ink-muted">{translate(lang, 'comp.voiceHint')}</p>
      </div>

      {error && (
        <p className="rounded-2xl bg-terra-soft px-4 py-2 text-xs font-semibold text-terra">{error}</p>
      )}

      {/* Suggestions */}
      <div className="grid grid-cols-2 gap-3">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s.intent}
            onClick={() => pick(s.intent)}
            disabled={busyRef.current || thinking}
            className="anim-fade-up flex items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-soft disabled:opacity-50"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <s.icon size={18} />
            </span>
            <T k={`comp.${s.intent}`} />
          </button>
        ))}
      </div>

      {/* Conversation */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="comp.conversation" /></h2>
        <div className="space-y-3 rounded-3xl border border-line bg-card p-4">
          {turns.map((t) => (
            <div key={t.uid} className={`flex ${t.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  t.from === 'user' ? 'rounded-br-sm bg-accent text-white' : 'rounded-bl-sm bg-brand-soft text-ink'
                }`}
              >
                <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">
                  {t.from === 'user' ? translate(lang, 'comp.you') : <Sparkles size={10} />}
                  {t.from === 'user' ? '' : translate(lang, 'comp.companion')}
                  {t.from === 'ai' && speakingId === t.uid && (
                    <Volume2 size={10} className="animate-pulse" />
                  )}
                </span>
                {t.text}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
