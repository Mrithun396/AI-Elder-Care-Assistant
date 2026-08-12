import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

const TIMEOUT_MS = 12000;

// Fallback region when GPS is unavailable/denied: grandma's UI language is a
// reliable proxy for the state she lives in (Tamil -> Tamil Nadu, etc.).
// English and Hindi span the whole country, so they get national news.
const STATE_BY_LANG: Record<string, string> = {
  ta: 'Tamil Nadu',
  ml: 'Kerala',
  te: 'Andhra Pradesh',
  kn: 'Karnataka',
  bn: 'West Bengal',
  mr: 'Maharashtra',
  gu: 'Gujarat',
  pa: 'Punjab',
  od: 'Odisha',
  hi: 'India',
  en: 'India',
};

// Reverse-geocode coordinates into an Indian state name (free, keyless).
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.countryName !== 'India') return null;
    const state: string | undefined = data?.principalSubdivision;
    if (!state || state === 'Unknown') return null;
    return state;
  } catch {
    return null;
  }
}

function cleanTitle(title: string): string {
  return title
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// GET /api/news?lat=<lat>&lng=<lng>&lang=<ta|ml|…>
// Returns today's top headlines for grandma's region, localized to her
// language. Region comes from GPS (reverse-geocoded) or her UI language.
// Source: Google News RSS — free, no API key, region + language aware.
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const lat = parseFloat(sp.get('lat') || '');
    const lng = parseFloat(sp.get('lng') || '');
    const lang = (sp.get('lang') || 'ta').slice(0, 2).toLowerCase();
    const national = sp.get('national') === '1';

    // national=1 forces country-wide headlines (in grandma's language);
    // otherwise the region comes from GPS or her UI language.
    let region: string | null = null;
    if (!national) {
      if (!isNaN(lat) && !isNaN(lng)) region = await reverseGeocode(lat, lng);
      region = region || STATE_BY_LANG[lang] || 'India';
    } else {
      region = 'India';
    }

    const url =
      `https://news.google.com/rss/search?q=${encodeURIComponent(`${region} news`)}` +
      `&hl=${lang}-IN&gl=IN&ceid=IN:${lang}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`news feed ${res.status}`);
    const xml = await res.text();

    // Pull the <title> of up to 4 <item> blocks.
    const titles: string[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) !== null && titles.length < 4) {
      const titleMatch = m[1].match(/<title>([\s\S]*?)<\/title>/);
      if (!titleMatch) continue;
      let t = cleanTitle(titleMatch[1]);
      if (!t || t.includes('Google')) continue;
      // Google appends the source name after a dash or a pipe ("… - NDTV",
      // "… | India News - Hindustan Times") — drop it so TTS reads cleanly.
      // Sources are Latin-script names ("Indian Express", "DinaMani") while
      // the headline is in the native script, so keep stripping trailing
      // separator+chunk groups while the tail chunk is Latin-only — this also
      // handles multi-word editions ("… - Indian Express - Tamil"). A Tamil
      // tail chunk ("… - அன்புமணி") is real attribution, not a source, so it
      // is kept.
      const stripTail = (s: string) => s.replace(/\s+[-|\u2013\u2014]\s+[^-|\u2013\u2014]+$/, '');
      t = stripTail(t);
      let tail = t.match(/\s+[-|\u2013\u2014]\s+([^-|\u2013\u2014]+)$/);
      while (tail && /^[\x20-\x7E]+$/.test(tail[1].trim())) {
        t = stripTail(t);
        tail = t.match(/\s+[-|\u2013\u2014]\s+([^-|\u2013\u2014]+)$/);
      }
      // Strip emoji/control noise but keep letters (incl. Indic combining
      // marks), numbers, punctuation, spaces, currency.
      t = t.replace(/[^\p{L}\p{M}\p{N}\p{P}\p{Z}\p{Sc}]/gu, '').trim();
      if (t.length > 15) titles.push(t);
    }

    if (titles.length === 0) {
      return NextResponse.json({ error: 'No news found for this region' }, { status: 502 });
    }
    return NextResponse.json({ region, headlines: titles });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || 'News failed' }, { status: 500 });
  }
}
