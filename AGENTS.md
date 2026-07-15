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
