// Sarvam's TTS reads bare digits one at a time ("2026" -> "2, 0, 2, 6"),
// which sounds broken in headlines. Convert numbers to spoken words before
// synthesis: Tamil gets Tamil words, everything else gets English words
// (Indian speech naturally code-mixes English numerals).
//
// Covers 0..999,999 — years and headline amounts. Larger numbers (lakhs /
// crores) are left as digits rather than risk a wrong reading.

const EN_ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function enUnder100(n: number): string {
  if (n < 20) return EN_ONES[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return EN_TENS[t] + (u ? '-' + EN_ONES[u] : '');
}

function enUnder1000(n: number): string {
  if (n < 100) return enUnder100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  return EN_ONES[h] + ' hundred' + (r ? ' ' + enUnder100(r) : '');
}

export function numToWordsEn(n: number): string {
  if (n < 0) return 'minus ' + numToWordsEn(-n);
  if (n < 1000) return enUnder1000(n);
  const t = Math.floor(n / 1000);
  const r = n % 1000;
  return enUnder1000(t) + ' thousand' + (r ? ' ' + enUnder1000(r) : '');
}

const TA_UNITS = ['', 'ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு', 'ஐந்து', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது'];
const TA_TEENS = [
  'பத்து', 'பதினொன்று', 'பன்னிரண்டு', 'பதின்மூன்று', 'பதினான்கு',
  'பதினைந்து', 'பதினாறு', 'பதினேழு', 'பதினெட்டு', 'பத்தொன்பது',
];
const TA_TENS = ['', '', 'இருபது', 'முப்பது', 'நாற்பது', 'ஐம்பது', 'அறுபது', 'எழுபது', 'எண்பது', 'தொண்ணூறு'];
const TA_TENS_INF = ['', '', 'இருபத்தி', 'முப்பத்தி', 'நாற்பத்தி', 'ஐம்பத்தி', 'அறுபத்தி', 'எழுபத்தி', 'எண்பத்தி', 'தொண்ணூற்றி'];
const TA_HUNDREDS = ['', 'நூறு', 'இருநூறு', 'முந்நூறு', 'நாநூறு', 'ஐந்நூறு', 'அறுநூறு', 'எழுநூறு', 'எண்ணூறு', 'தொள்ளாயிரம்'];
const TA_THOUSANDS = ['', 'ஆயிரம்', 'இரண்டாயிரம்', 'மூவாயிரம்', 'நாலாயிரம்', 'ஐயாயிரம்', 'ஆறாயிரம்', 'ஏழாயிரம்', 'எட்டாயிரம்', 'ஒன்பதாயிரம்'];
const TA_THOUSANDS_OBL = ['', 'ஆயிரத்து', 'இரண்டாயிரத்து', 'மூவாயிரத்து', 'நாலாயிரத்து', 'ஐயாயிரத்து', 'ஆறாயிரத்து', 'ஏழாயிரத்து', 'எட்டாயிரத்து', 'ஒன்பதாயிரத்து'];

function taUnder100(n: number): string {
  if (n < 10) return TA_UNITS[n];
  if (n < 20) return TA_TEENS[n - 10];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u ? TA_TENS_INF[t] + TA_UNITS[u] : TA_TENS[t];
}

function taUnder1000(n: number): string {
  if (n < 100) return taUnder100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  return TA_HUNDREDS[h] + (r ? ' ' + taUnder100(r) : '');
}

export function numToWordsTa(n: number): string {
  if (n < 0) return 'மைனஸ் ' + numToWordsTa(-n);
  if (n === 0) return 'பூஜ்யம்';
  if (n < 1000) return taUnder1000(n);
  const t = Math.floor(n / 1000);
  const r = n % 1000;
  const thousand =
    t < 10 ? (r ? TA_THOUSANDS_OBL[t] : TA_THOUSANDS[t]) : taUnder100(t) + (r ? ' ஆயிரத்து' : ' ஆயிரம்');
  return thousand + (r ? ' ' + taUnder1000(r) : '');
}

// Replace numeric tokens (with optional thousands separators) in arbitrary
// text with their spoken-word form, per the target language.
export function localizeNumbers(text: string, target: string): string {
  const tamil = target.toLowerCase().startsWith('ta');
  return text.replace(/\d[\d,]*/g, (m) => {
    const n = parseInt(m.replace(/,/g, ''), 10);
    if (isNaN(n) || n > 999999 || n < -999999) return m;
    return tamil ? numToWordsTa(n) : numToWordsEn(n);
  });
}
