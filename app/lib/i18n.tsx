'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type LangKey = 'en' | 'ta' | 'hi' | 'te' | 'ml' | 'kn';

const LANG_BY_CODE: Record<string, LangKey> = {
  'en-IN': 'en',
  'ta-IN': 'ta',
  'hi-IN': 'hi',
  'te-IN': 'te',
  'ml-IN': 'ml',
  'kn-IN': 'kn',
};

export const DEFAULT_LANG: LangKey = 'ta';

function readLang(): LangKey {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const code = localStorage.getItem('bridge-lang');
    return (code && LANG_BY_CODE[code]) || DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

const LangCtx = createContext<LangKey>(DEFAULT_LANG);

/** Reads `bridge-lang` (same key Settings writes) and re-renders on change. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<LangKey>(DEFAULT_LANG);
  useEffect(() => {
    const sync = () => setLang(readLang());
    sync();
    window.addEventListener('bridge-lang', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('bridge-lang', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>;
}

export function useLang(): LangKey {
  return useContext(LangCtx);
}

type Entry = { en: string; ta?: string; hi?: string; te?: string; ml?: string; kn?: string };

/**
 * UI strings dictionary. `ta` is fully translated (demo language). Languages
 * without an entry fall back to English main text (and the sub-line hides).
 */
export const DICT: Record<string, Entry> = {
  // ---- Navigation ----
  'nav.home': { en: 'Home', ta: 'முகப்பு' },
  'nav.messages': { en: 'Messages', ta: 'செய்திகள்' },
  'nav.companion': { en: 'AI Companion', ta: 'AI துணைவர்' },
  'nav.medicines': { en: 'Medicines', ta: 'மருந்துகள்' },
  'nav.health': { en: 'Health', ta: 'உடல்நலம்' },
  'nav.emergency': { en: 'Emergency', ta: 'அவசரம்' },
  'nav.settings': { en: 'Settings', ta: 'அமைப்புகள்' },
  'short.medicines': { en: 'Meds', ta: 'மருந்து' },
  'short.companion': { en: 'AI', ta: 'AI' },
  'short.health': { en: 'Health', ta: 'உடல்நலம்' },

  // ---- App shell ----
  'shell.tagline': { en: 'Elder Care Assistant', ta: 'முதியோர் பராமரிப்பு உதவியாளர்' },
  'shell.grandma': { en: 'Grandma Kamala', ta: 'பாட்டி கமலா' },
  'shell.role': { en: 'Loving grandmother', ta: 'அன்பான பாட்டி' },

  // ---- Home ----
  'greeting.hello': { en: 'Hello, Grandma', ta: 'வணக்கம், பாட்டி' },
  'greeting.morning': { en: 'Good Morning, Grandma', ta: 'காலை வணக்கம், பாட்டி' },
  'greeting.afternoon': { en: 'Good Afternoon, Grandma', ta: 'மதிய வணக்கம், பாட்டி' },
  'greeting.evening': { en: 'Good Evening, Grandma', ta: 'மாலை வணக்கம், பாட்டி' },
  'home.ready': { en: 'Everything is ready for you today.', ta: 'இன்று உங்களுக்காக எல்லாம் தயாராக உள்ளது.' },
  'home.quickActions': { en: 'Quick Actions', ta: 'விரைவு செயல்கள்' },
  'home.sendMessage': { en: 'Send Message', ta: 'செய்தி அனுப்பு' },

  'home.sendSub': { en: 'Talk & translate', ta: 'பேசி மொழிபெயர்க்கவும்' },
  'home.talkToAI': { en: 'Talk to AI', ta: 'AI-யிடம் பேசு' },
  'home.companionSub': { en: 'Your companion', ta: 'உங்கள் துணை' },
  'home.medSub': { en: 'Today 2 remaining', ta: 'இன்று 2 மீதம்' },
  'home.emergencySos': { en: 'Emergency SOS', ta: 'அவசர SOS' },
  'home.callFamilySub': { en: 'Call family now', ta: 'இப்போதே குடும்பத்தை அழைக்கவும்' },
  'home.recentActivity': { en: 'Recent Activity', ta: 'சமீபத்திய செயல்பாடு' },
  'home.todaysMedicines': { en: "Today's Medicines", ta: 'இன்றைய மருந்துகள்' },
  'home.medSummary': { en: '2 remaining · next at 1:00 PM', ta: '2 மீதம் · அடுத்தது பிற்பகல் 1:00' },
  'home.unread': { en: 'Unread Messages', ta: 'படிக்காத செய்திகள்' },
  'home.checking': { en: 'Checking…', ta: 'சரிபார்க்கிறது…' },
  'home.history': { en: '{n} message in history', ta: 'வரலாற்றில் {n} செய்தி' },
  'home.historyPlural': { en: '{n} messages in history', ta: 'வரலாற்றில் {n} செய்திகள்' },
  'home.healthCheck': { en: 'Health Check', ta: 'உடல்நல பரிசோதனை' },
  'home.lastCheck': { en: 'Last check: feeling good', ta: 'கடைசி பரிசோதனை: நலமாக உள்ளீர்கள்' },
  'home.openFamily': { en: 'Open Family Dashboard', ta: 'குடும்ப டாஷ்போர்டைத் திறக்கவும்' },

  // ---- Messages ----
  'messages.title': { en: 'Messages', ta: 'செய்திகள்' },
  'messages.subtitle': {
    en: 'Speak in your language — replies arrive translated and read aloud.',
    ta: 'உங்கள் மொழியில் பேசுங்கள் — பதில்கள் மொழிபெயர்க்கப்பட்டு சத்தமாக வாசிக்கப்படும்.',
  },
  'messages.conversation': { en: 'Conversation', ta: 'உரையாடல்' },
  'messages.empty': { en: 'No messages yet', ta: 'இன்னும் செய்திகள் இல்லை' },
  'messages.emptySub': {
    en: 'Your spoken messages and family replies will appear here.',
    ta: 'உங்கள் பேச்சு செய்திகளும் குடும்ப பதில்களும் இங்கே தோன்றும்.',
  },
  'messages.loadError': { en: 'Could not load message history.', ta: 'செய்தி வரலாற்றை ஏற்ற முடியவில்லை.' },
  'messages.ttsError': {
    en: 'Could not play audio — tap the speaker to try again.',
    ta: 'ஆடியோ இயக்க முடியவில்லை — மீண்டும் முயற்சிக்க ஸ்பீக்கரைத் தொடவும்.',
  },
  'messages.playAloud': { en: 'Play message aloud', ta: 'செய்தியை சத்தமாக இயக்கவும்' },
  'messages.langEnglish': { en: 'English', ta: 'ஆங்கிலம்' },

  // ---- Talk & Translate ----
  'tnt.title': { en: 'Talk & Translate', ta: 'பேசி மொழிபெயர்க்கவும்' },
  'tnt.subtitle': { en: 'Speak in any Indian language', ta: 'எந்த இந்திய மொழியிலும் பேசுங்கள்' },
  'tnt.sendTo': { en: 'Send to', ta: 'இதற்கு அனுப்பு' },
  'tnt.speak': { en: 'Speak', ta: 'பேசு' },
  'tnt.stop': { en: 'Stop', ta: 'நிறுத்து' },
  'tnt.listening': { en: 'Listening…', ta: 'கேட்கிறேன்…' },
  'tnt.tapAndSpeak': { en: 'Tap and speak', ta: 'தொட்டு பேசுங்கள்' },
  'tnt.translating': { en: 'Translating…', ta: 'மொழிபெயர்க்கிறது…' },
  'tnt.youSaid': { en: 'You said', ta: 'நீங்கள் சொன்னீர்கள்' },
  'tnt.translated': { en: 'Translated · English', ta: 'மொழிபெயர்ப்பு · ஆங்கிலம்' },
  'tnt.sending': { en: 'Sending…', ta: 'அனுப்புகிறது…' },
  'tnt.sendToName': { en: 'Send to {name}', ta: '{name}-க்கு அனுப்பு' },
  'tnt.sent': { en: 'Sent Successfully ✓', ta: 'வெற்றிகரமாக அனுப்பப்பட்டது ✓' },
  'tnt.errFamily': { en: 'Could not load family members', ta: 'குடும்ப உறுப்பினர்களை ஏற்ற முடியவில்லை' },
  'tnt.errTimeout': { en: 'Translation timed out — please try again.', ta: 'மொழிபெயர்ப்பு காலாவதியானது — மீண்டும் முயற்சிக்கவும்.' },
  'tnt.errFailed': { en: 'Translation failed', ta: 'மொழிபெயர்ப்பு தோல்வியடைந்தது' },
  'tnt.errSend': { en: 'Send failed', ta: 'அனுப்ப முடியவில்லை' },
  'tnt.errMic': {
    en: 'Could not start recording — microphone access denied or unsupported.',
    ta: 'பதிவைத் தொடங்க முடியவில்லை — மைக்ரோஃபோன் அணுகல் மறுக்கப்பட்டது.',
  },
  'tnt.errNoAudio': {
    en: 'No audio captured — try again and speak a bit longer.',
    ta: 'ஆடியோ கைப்பற்றப்படவில்லை — மீண்டும் முயற்சி செய்து சிறிது நேரம் பேசுங்கள்.',
  },
  'tnt.errShort': { en: 'Recording too short — hold and speak for a moment.', ta: 'பதிவு மிகவும் குறுகியது — சிறிது நேரம் பேசுங்கள்.' },
  'tnt.errNoSpeech': {
    en: 'No speech detected — mic may be muted or too quiet. Try again.',
    ta: 'பேச்சு கண்டறியப்படவில்லை — மைக்ரோஃபோன் அமைதியாக இருக்கலாம். மீண்டும் முயற்சிக்கவும்.',
  },

  // ---- Settings ----
  'settings.title': { en: 'Settings', ta: 'அமைப்புகள்' },
  'settings.subtitle': { en: 'Make Bridge feel like home.', ta: 'பிரிட்ஜ் உங்களுக்கு வீடு போல் இருக்கட்டும்.' },
  'settings.language': { en: 'Language', ta: 'மொழி' },
  'settings.voice': { en: 'Voice', ta: 'குரல்' },
  'settings.family': { en: 'Family Members', ta: 'குடும்ப உறுப்பினர்கள்' },
  'settings.loadingFamily': { en: 'Loading family members…', ta: 'குடும்ப உறுப்பினர்கள் ஏற்றப்படுகிறது…' },
  'settings.darkMode': { en: 'Dark Mode', ta: 'இருண்ட பயன்முறை' },
  'settings.light': { en: 'Light', ta: 'ஒளி' },
  'settings.dark': { en: 'Dark', ta: 'இருள்' },
  'settings.about': { en: 'About', ta: 'பற்றி' },
  'settings.openFamily': { en: 'Open Family Dashboard', ta: 'குடும்ப டாஷ்போர்டைத் திறக்கவும்' },

  // ---- Medicines ----
  'med.title': { en: 'Medicines', ta: 'மருந்துகள்' },
  'med.remaining': { en: '{remaining} remaining today · {taken} taken', ta: 'இன்று {remaining} மீதம் · {taken} எடுக்கப்பட்டது' },
  'med.today': { en: "Today's Medicines", ta: 'இன்றைய மருந்துகள்' },
  'med.taken': { en: 'Taken', ta: 'எடுக்கப்பட்டது' },
  'med.pending': { en: 'Pending', ta: 'நிலுவையில்' },
  'med.upcoming': { en: 'Upcoming Reminders', ta: 'வரவிருக்கும் நினைவூட்டல்கள்' },
  'med.afterLunch': { en: 'After lunch', ta: 'மதிய உணவுக்குப் பிறகு' },
  'med.afterDinner': { en: 'After dinner', ta: 'இரவு உணவுக்குப் பிறகு' },
  'med.completed': { en: 'Completed', ta: 'முடிந்தது' },

  // ---- Health ----
  'health.title': { en: 'Health', ta: 'உடல்நலம்' },
  'health.subtitle': { en: 'Your daily well-being at a glance.', ta: 'உங்கள் தினசரி நல்வாழ்வு ஒரே பார்வையில்.' },
  'health.mood': { en: 'How are you feeling today?', ta: 'இன்று நீங்கள் எப்படி உணர்கிறீர்கள்?' },
  'health.feeling': {
    en: 'Feeling good — last check this morning',
    ta: 'நலமாக உணர்கிறீர்கள் — கடைசி பரிசோதனை இன்று காலை',
  },
  'health.bp': { en: 'Blood Pressure', ta: 'இரத்த அழுத்தம்' },
  'health.hr': { en: 'Heart Rate', ta: 'இதயத் துடிப்பு' },
  'health.steps': { en: 'Steps Today', ta: 'இன்றைய நடை' },
  'health.water': { en: 'Water Intake', ta: 'தண்ணீர் உட்கொள்ளல்' },
  'health.ofSteps': { en: 'of 6,000', ta: '6,000-இல்' },
  'health.ofGlasses': { en: 'of 8 glasses', ta: '8 கிளாஸ்-இல்' },
  'health.trend': { en: 'Weekly Trend', ta: 'வாராந்திர போக்கு' },
  'health.sample': { en: 'Sample data · synced devices coming soon', ta: 'மாதிரி தரவு · இணைக்கப்பட்ட சாதனங்கள் விரைவில்' },

  // ---- Emergency ----
  'emergency.title': { en: 'Emergency', ta: 'அவசரம்' },
  'emergency.subtitle': { en: 'Help is one tap away.', ta: 'ஒரே தொடுதலில் உதவி.' },
  'emergency.tap': { en: 'Tap to alert your family', ta: 'உங்கள் குடும்பத்தை எச்சரிக்க தொடவும்' },
  'emergency.sub': { en: 'Sends an emergency alert with your location', ta: 'உங்கள் இருப்பிடத்துடன் அவசர எச்சரிக்கையை அனுப்புகிறது' },
  'emergency.calling': { en: 'Calling family in…', ta: 'குடும்பத்தை அழைக்கிறது…' },
  'emergency.sent': { en: 'Alert sent!', ta: 'எச்சரிக்கை அனுப்பப்பட்டது!' },
  'emergency.cancel': { en: 'Tap again to cancel', ta: 'ரத்து செய்ய மீண்டும் தொடவும்' },
  'emergency.notified': { en: 'Family has been notified (demo)', ta: 'குடும்பத்திற்கு அறிவிக்கப்பட்டது (டெமோ)' },
  'emergency.done': { en: 'Done', ta: 'முடிந்தது' },
  'emergency.contacts': { en: 'Emergency Contacts', ta: 'அவசர தொடர்புகள்' },
  'emergency.call': { en: 'Call', ta: 'அழைக்கவும்' },
  'emergency.uiOnly': { en: 'Call buttons are UI-only in this demo.', ta: 'அழைப்பு பொத்தான்கள் இந்த டெமோவில் UI மட்டுமே.' },
  'rel.son': { en: 'Son', ta: 'மகன்' },
  'rel.daughter': { en: 'Daughter', ta: 'மகள்' },
  'rel.doctor': { en: 'Family Doctor', ta: 'குடும்ப மருத்துவர்' },

  // ---- Companion ----
  'comp.title': { en: 'AI Companion', ta: 'AI துணைவர்' },
  'comp.subtitle': { en: 'Your friendly assistant, always here to talk.', ta: 'உங்கள் நட்பு உதவியாளர், எப்போதும் பேச தயார்.' },
  'comp.listening': { en: 'Listening…', ta: 'கேட்கிறேன்…' },
  'comp.tapToTalk': { en: 'Tap to talk', ta: 'பேச தொடவும்' },
  'comp.voicePreview': { en: 'Voice mode is a demo preview.', ta: 'குரல் முறை ஒரு டெமோ முன்னோட்டம்.' },
  'comp.story': { en: 'Tell me a story', ta: 'ஒரு கதை சொல்லுங்கள்' },
  'comp.news': { en: "Read today's news", ta: 'இன்றைய செய்திகளை படியுங்கள்' },
  'comp.talk': { en: "Let's talk", ta: 'பேசலாம்' },
  'comp.joke': { en: 'Tell me a joke', ta: 'ஒரு நகைச்சுவை சொல்லுங்கள்' },
  'comp.conversation': { en: 'Conversation', ta: 'உரையாடல்' },
  'comp.you': { en: 'You', ta: 'நீங்கள்' },
  'comp.companion': { en: 'Companion', ta: 'துணைவர்' },
  'comp.welcome': {
    en: 'Vanakkam, Grandma! I am your AI companion. What would you like to do today?',
    ta: 'வணக்கம் பாட்டி! நான் உங்கள் AI துணைவர். இன்று என்ன செய்ய விரும்புகிறீர்கள்?',
  },
  'comp.demoReply': {
    en: '(Demo) I would love to {label}! Voice chat is coming soon — this is a preview.',
    ta: '(டெமோ) நான் அதை விரும்புகிறேன்! குரல் அரட்டை விரைவில் வருகிறது — இது ஒரு முன்னோட்டம்.',
  },
  'comp.voiceNote': { en: '(voice note — demo)', ta: '(குரல் பதிவு — டெமோ)' },
  'comp.heard': {
    en: '(Demo) I heard you! Full voice conversations are on the way.',
    ta: '(டெமோ) நான் உங்களை கேட்டேன்! முழு குரல் உரையாடல்கள் விரைவில்.',
  },
};

export function translate(lang: LangKey, key: string): string {
  const e = DICT[key];
  if (!e) return key;
  return e[lang] ?? e.en ?? key;
}

export function fmt(lang: LangKey, key: string, vars: Record<string, string | number> = {}): string {
  let s = translate(lang, key);
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/**
 * Renders a UI string in the selected language, with the English translation
 * in a smaller, lighter-grey bracketed line right below it. The sub-line is
 * hidden when the UI language IS English (or falls back to English).
 */
export function T({
  k,
  sub = true,
  center = false,
  className = '',
  subClassName = '',
}: {
  k: string;
  sub?: boolean;
  center?: boolean;
  className?: string;
  subClassName?: string;
}) {
  const lang = useLang();
  const e = DICT[k] ?? { en: k };
  const main = e[lang] ?? e.en ?? k;
  const en = e.en ?? k;
  const showSub = sub && lang !== 'en' && en !== main;
  return (
    <span className={`inline-flex flex-col ${center ? 'items-center' : 'items-start'} ${className}`}>
      <span>{main}</span>
      {showSub && (
        <span className={`text-[10px] font-medium normal-case tracking-normal leading-tight text-ink-muted/70 ${subClassName}`}>
          ({en})
        </span>
      )}
    </span>
  );
}
