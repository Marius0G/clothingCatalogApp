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
- **Structură**: tab bar = **varianta 2c-B din design (pastilă neagră plutitoare, doar iconuri, + alb central)** — `src/components/tab-bar.tsx`; tab-urile: Acasă/Dorințe/[+]/Garderobă/Tu (You = hub de profil cu Preferences/Collections/Support/Settings ca ecrane de stack); plusul deschide chooser-ul „Add to…" (Dorințe = import prin link, Garderobă = flux foto). **Garderobă are două view-uri** (Haine / Ținute) comutate dintr-o pastilă cu iconuri + chips contextuale pe un singur rând (`?view=&anchor=` ca deep-link); generatorul de ținute e integrat în view-ul Ținute — fostele ecrane Descoperă și Ținute salvate au fost retrase (iterația din 22.07.2026). **Acasă = 6 secțiuni**: salut+statistici, „Ținuta de azi" (cu check-in de purtare, bară de 5s), carusele ținute / dorințe (badge reducere) / ultimele piese / colecții. Ecranele You/Preferences/Support/Settings/„Add to…" urmează pozele de referință din `design/references/you-tab/` (iterația din 19.07.2026, încă neadăugată în .dc.html).
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
- Web: `npx expo start --web --port 8082` (dev) sau `npx expo export --platform web` (static). Modulele native au fork-uri `.web.ts` (auth social, share-intent)
- Backend selection: `.env` alege cloud sau stack local (o singură secțiune activă; după schimbare, restart Metro cu `--clear`). Pentru URL-uri locale (`http://…:54321`), `src/lib/supabase.ts` rescrie host-ul automat per platformă (web → hostname-ul paginii, nativ → host-ul Metro din `hostUri`, fallback `10.0.2.2` pe emulator); pentru web prin tunel (ngrok) setează `EXPO_PUBLIC_SUPABASE_URL_WEB` la un al doilea tunel către `:54321`. La pornire, în dev, consola loghează `[supabase] <platformă> → <url>` sau un warning dacă backend-ul e de neatins
- Migrațiile se testează local cu `npx supabase start` + `npx supabase db reset` (necesită Docker)
- Web hosting (testare fără setup local): `npx expo export --platform web` apoi `npx eas deploy --prod` → **https://clothesapp.expo.app** (EAS Hosting, gratuit). Atenție: exportul copiază `.env`-ul activ în bundle — fă deploy DOAR cu secțiunea cloud activă
