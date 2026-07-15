# Clothing Catalog App

"All your favourite clothes in one app" — garderobă digitală + wishlist cu import prin link + recomandări AI. Piața RO, UI în ro/en.

Planul complet (arhitectură, milestones M0–M7, riscuri): `~/.claude/plans/ok-deci-eu-si-lovely-zephyr.md`. Pașii manuali de setup: `SETUP.md`.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Stack

- **Expo SDK 57** + expo-router (file-based, în `src/app/`), TypeScript strict, NativeWind v4
- **Supabase**: Postgres cu RLS peste tot, Auth (email/Google/Apple), Storage privat, Edge Functions (Deno, în `supabase/functions/`), migrations prin CLI (`npx supabase db push` — niciodată modificări de schemă din dashboard)
- **TanStack Query** pentru tot ce e server state; zustand doar pentru state efemer UI
- **Featherless.ai** pentru AI (cheie doar în secrets de edge functions, niciodată în app)
- **zod** în `shared/types.ts` = contractul app ↔ edge functions; orice output LLM se validează cu schemele de acolo

## Design system (OBLIGATORIU pentru orice UI)

Sursa canonică: **`design/Clothing-App.dc.html`** („Editorial minimal") — oglinda proiectului claude.ai/design „Aplicație Catalog Haine" (id `6687ebf5-f1ce-43fe-be80-226bf41ad196`). Orice ecran/component nou se construiește după acest fișier; dacă designul evoluează, se actualizează întâi acolo, apoi tokens-urile.

- **Tokens**: `tailwind.config.js` + `src/lib/theme.ts` (culori: paper/card/bright/ink/dark/accent/sale…; fonturi: Playfair Display pentru titluri serif, Instrument Sans pentru rest). Nu hardcoda culori/hex în componente.
- **Iconuri**: doar `src/components/icons.tsx` (SVG-urile exacte din design, stroke subțire) — nu Ionicons/alte seturi.
- **Structură**: tab bar 5 sloturi (Acasă/Favorite/[+]/Garderobă/Setări) cu buton central ridicat (`src/components/tab-bar.tsx`); Descoperă e ecran de stack, nu tab.
- **Litere**: titluri de ecran = `font-serif` 29-30px; secțiuni = `font-serif` 20-22px; butoane primare = fundal `dark`, radius 14, înălțime 54.

## Convenții

- Rutele doar orchestrează; logica de date stă în `src/features/*/api.ts` + `hooks.ts`
- Toate textele vizibile trec prin i18n (`src/lib/i18n/{ro,en}.json`) — fără stringuri hardcodate în componente
- Stilizare prin className (NativeWind) cu paleta din `tailwind.config.js` (ink/paper/accent)
- Edge functions: verifică JWT-ul caller-ului, nu au încredere în user id din body; scriu în `ai_usage` la fiecare apel AI
- `supabase/functions/` e cod Deno — exclus din tsconfig-ul aplicației, se verifică cu `deno check`

## Verificare

- `npx tsc --noEmit` și `npx expo lint` trebuie să treacă înainte de commit
- Dev loop: emulator Android local; iOS doar prin EAS build pe iPhone fizic (Windows — nu există build local iOS)
- Migrațiile se testează local cu `npx supabase start` + `npx supabase db reset` (necesită Docker)
