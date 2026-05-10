# Drivel — sort the chaos of people you've met

A small web app where you (and your friends) dump unstructured notes about
people you've met. Gemini auto-extracts structured fields into a shared,
dynamic-column table per "room." Add a column at any time and the model
retroactively fills it in for every existing row.

Live: <https://musabhasgithub.github.io/drivel-table/>

Built on Next.js 16 (static export) + Firestore + Google Gemini, hosted
on GitHub Pages. No real auth — anyone with the URL types their name on
first visit and that becomes the "submitted by" value.

## Architecture

Everything runs in the browser. Drivel submission and column adds both
trigger Gemini calls directly from the client; results are written back
to Firestore with the loosened rules in `firestore.rules` (which allow
entry updates that only touch the `extracted` map).

| File | Responsibility |
| --- | --- |
| `lib/firebase.ts` | Firestore singleton (`getDbOrNull` returns null without env) |
| `lib/gemini-client.ts` | Browser-side Gemini wrapper with dynamic JSON-schema response |
| `lib/entries.ts` | `submitEntry` (addDoc) + `runExtraction` (updateDoc per cell) |
| `lib/categories.ts` | `addCategory` + `reextractRoomCategory` (loops + concurrency 5) |
| `app/page.tsx` | Name gate + room switcher |
| `app/rooms/page.tsx` | Room view (reads `?id=…` from query — static export can't pre-render `[roomId]`) |
| `firestore.rules` | Open reads; creates require `submittedBy`/`createdBy`; entry updates allowed when only `extracted` map changes |

## Local dev

```bash
cp .env.local.example .env.local
# fill in the seven NEXT_PUBLIC_* values
npm install
npm run dev
```

Opens at <http://localhost:3000/> (no `basePath` in dev — only prod
gets the `/drivel-table` prefix for GitHub Pages).

## Deployment

Pushes to `main` automatically build a static export and publish to
GitHub Pages via [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
You need to set seven repository secrets and enable Pages.

### One-time setup

1. **Restrict the Gemini API key** in
   [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
   Click your Gemini key, set "Application restrictions" → "HTTP referrers",
   and add:
   - `https://musabhasgithub.github.io/*`
   - `http://localhost:*` (for local dev)

   Without this restriction the key is scrapeable from the deployed JS
   bundle and abusable from anywhere.

2. **Add seven repo secrets** at
   [Settings → Secrets and variables → Actions](https://github.com/MusabHasGithub/drivel-table/settings/secrets/actions):

   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_GEMINI_API_KEY`

   Values are the same as in your `.env.local`.

3. **Enable GitHub Pages** at
   [Settings → Pages](https://github.com/MusabHasGithub/drivel-table/settings/pages).
   Set "Source" to **GitHub Actions**.

4. Push any change (or re-run the workflow manually) and the site goes
   live at <https://musabhasgithub.github.io/drivel-table/>.

### Subsequent deploys

`git push origin main` — that's it. The workflow builds the static
export and publishes.

## Identity model

Name-only auth: type your name on first visit, it lands in localStorage,
gets stamped onto every entry as `submittedBy`. Two users typing the
same name are indistinguishable — by design, since this is for
trusted-friend-group use behind the API key restriction. If you ever
need real identity, swap to anonymous Firebase Auth (one-line
`signInAnonymously` + a `users/{uid}` doc).

## Plan

The original architectural plan that drove this build:
`/Users/realmusab/.claude/plans/i-need-an-site-iterative-key.md`.

## Tech

- Next.js 16.2.6 + React 19 + TypeScript + Tailwind v4 (static export)
- Firebase 12 web SDK
- `@google/generative-ai` 0.24 (`gemini-2.5-flash`) running in the browser
- TanStack Table v8 + dnd-kit (core + sortable)
- Zod v4 for runtime schemas
- Editorial type stack: Instrument Serif + Geist + JetBrains Mono
