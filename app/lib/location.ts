'use client';

// Shared geolocation helper: grab grandma's position once and persist it so
// features that need "which area does she live in" (regional news, SOS
// location) can reuse it without re-prompting for permission every time.
const LOCATION_KEY = 'bridge-location';

export type SavedLocation = { lat: number; lng: number; at: number };

export function readSavedLocation(): SavedLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLocation(lat: number, lng: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lng, at: Date.now() }));
  } catch {
    // storage blocked — in-memory only for this session
  }
}

// Best-effort GPS fix. Resolves null on denial, timeout, or unsupported
// browser (callers fall back to a language-based region guess).
export function grabLocation(timeoutMs = 5000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (v: { lat: number; lng: number } | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          saveLocation(loc.lat, loc.lng);
          finish(loc);
        },
        () => finish(null),
        { timeout: timeoutMs, maximumAge: 60000 }
      );
    } catch {
      finish(null);
    }
  });
}
