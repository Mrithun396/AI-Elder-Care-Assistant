# AI Elder Care Assistant

A voice-first AI companion for grandparents, with a family dashboard for caregivers. The grandparent talks to an AI companion in their own language (11 Indian languages supported), and the family can monitor health, messages, mood, and emergencies from any device.

## Core features

- **AI companion** — voice conversation (speech-to-text + LLM brain + text-to-speech via Sarvam AI), with memory of past conversations and the grandparent's name/context. Saves health readings (blood pressure, sugar), medicines, and reminders by voice.
- **11-language UI** — Tamil, Hindi, Telugu, Bengali, Kannada, Marathi, Gujarati, Punjabi, Odia, Malayalam, and English. Every screen, voice, and AI reply is localized; the AI code-mixes English naturally (e.g. "ரொம்ப நல்லா இருக்கு Grandma!").
- **Emergency SOS** — a big SOS button (10s countdown, cancellable) or saying "உதவி!" / "help" to the companion triggers an alert with the grandparent's GPS location; the family dashboard shows a live red banner with "All clear".
- **Health tracking** — grandparent updates BP/sugar by voice or on-screen; the family dashboard shows readings, mood, and trends (charts).
- **Medicines & reminders** — medicine schedules with a voice reminder alert; reminders announced by the AI.
- **News** — the companion reads today's real regional headlines (from GPS-reverse-geocoded state + Google News RSS), translated into grandma's language, then offers national news.
- **Messages** — grandparent ↔ family messaging.
- **Family dashboard** — separate login for family members, polling live every ~2.5s for alerts, readings, mood, and messages.
- **Voice selection** — 8 Sarvam voices to choose from, with cached previews.

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript (React components, API routes, all logic) |
| Framework | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS v4 |
| Database / auth | Supabase (Postgres) — tables for medicines, reminders, health check-ins, memories, messages, family members, alerts |
| Voice AI | Sarvam AI — speech-to-text, translation, text-to-speech |
| News | Google News RSS (free) + BigDataCloud reverse-geocoding |
| Hosting | Netlify (Next.js runtime, `netlify.toml`) |

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000 (or :3100 if configured)
```

### Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SARVAM_API_KEY=...
```

- `NEXT_PUBLIC_*` variables are public and inlined into the browser bundle — the Supabase URL/anon key are safe to expose.
- `SUPABASE_SERVICE_ROLE_KEY` and `SARVAM_API_KEY` are server-only secrets. Never expose them to the client; set them as Netlify environment variables for deploys.

> **Note:** Sarvam AI is a paid API — every voice interaction (STT / TTS / translation) spends credits. Don't hammer the mic while testing.

## Project structure

```
app/
  (app)/              # Grandparent-side UI (App Shell with bottom nav)
    companion/        # AI companion chat + voice
    medicines/        # Medicine schedules
    health/           # BP / sugar / mood
    messages/         # Chat with family
    emergency/        # SOS
    settings/         # Language, voice, theme
  family/             # Family dashboard + login
  api/                # Server routes (chat, tts, translate, news, emergency, auth, ...)
  components/         # AppShell, HealthCharts, TalkAndTranslate, ...
  lib/                # i18n (11 languages), auth, supabase, audio, location, numwords
public/               # Static assets
netlify.toml          # Netlify build config (Next.js runtime, secrets-scan whitelist)
```

## Deployment (Netlify)

Auto-builds on every push to `main` (~2 min). The `netlify.toml` pins the Next.js runtime, the publish directory, and whitelists `NEXT_PUBLIC_SUPABASE_URL` from the secrets scanner (it's a public URL that Next.js inlines into bundles by design). Set the env vars above in **Site configuration → Environment variables**.
