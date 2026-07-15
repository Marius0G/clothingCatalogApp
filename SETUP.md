# Setup — pași manuali

Ce trebuie făcut de mână (o singură dată) ca aplicația să meargă cap-coadă. Ordinea contează.

## 1. Supabase (obligatoriu — aplicația nu pornește fără)

1. Cont pe [supabase.com](https://supabase.com) → **New project** (regiunea `eu-central-1`, Frankfurt — aproape de România).
2. Din **Project Settings → API** copiază `URL` și `anon public key` în `.env` (copiază întâi `.env.example` → `.env`).
3. Local: `npx supabase login`, apoi `npx supabase link --project-ref <ref-ul-proiectului>`.
4. Aplică schema: `npx supabase db push` (rulează `supabase/migrations/0001_init.sql`).
5. Deploy funcția de ștergere cont: `npx supabase functions deploy delete-account`.

Pentru dezvoltare locală completă (opțional dar recomandat): instalează **Docker Desktop** (backend WSL2), apoi `npx supabase start` îți dă Postgres + Auth + Storage local.

## 2. Conturi de developer (obligatoriu pentru build-uri pe telefon)

- **Expo**: cont gratuit pe [expo.dev](https://expo.dev) → `npx eas login`.
- **Apple Developer** — 99 $/an, [developer.apple.com](https://developer.apple.com). Fără el nu există build de iOS (nici măcar de test). După înscriere: `npx eas device:create` ca să înregistrezi UDID-ul iPhone-ului de test.
- **Google Play Console** — 25 $ o singură dată, [play.google.com/console](https://play.google.com/console). Necesar abia la publicare; build-urile de test Android merg și fără (APK direct).

Primul build de development (după ce ai conturile):

```
npx eas build --profile development --platform android
npx eas build --profile development --platform ios
```

Apoi local: `npx expo start` și deschizi aplicația din dev client.

## 3. Google Sign-In

1. [Google Cloud Console](https://console.cloud.google.com) → proiect nou → **OAuth consent screen** (External).
2. Creează 3 OAuth Client IDs: **Web** (pentru Supabase), **Android** (package `app.clothingcatalog.mobile` + SHA-1 din `npx eas credentials`), **iOS** (bundle `app.clothingcatalog.mobile`).
3. În Supabase: **Authentication → Providers → Google** → activează și pune Web client ID + secret.
4. În `.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Web client ID) și `GOOGLE_IOS_URL_SCHEME` (iOS client ID inversat, îl vezi în consolă).

## 4. Apple Sign-In

1. În Apple Developer: activează capability-ul **Sign in with Apple** pe App ID (EAS o face automat la primul build iOS, verifică doar).
2. În Supabase: **Authentication → Providers → Apple** → activează, cu Service ID + key generate din Apple Developer (urmează ghidul Supabase pentru „Sign in with Apple on native").

## 5. Featherless AI (necesar din M1 — auto-tagging)

- Cheia API din contul Featherless → o setezi ca secret pe funcții: `npx supabase secrets set FEATHERLESS_API_KEY=...`
- Nu o pune NICIODATĂ în `.env` al aplicației (ar ajunge în bundle).

## 6. Afiliere (necesar din M6 — pornit din M4, aprobarea durează săptămâni)

Partenerul de business își face cont de afiliat pe **2performant.com** și **profitshare.ro** și aplică la programele advertiserilor de fashion (Answear, Fashion Days, ABOUT YOU etc.).

## Verificare rapidă că totul e legat

1. `.env` completat → `npx expo start` → aplicația pornește fără eroarea de env.
2. Creezi cont cu email → primești mail de confirmare → după confirmare intri și vezi onboarding-ul.
3. În Supabase dashboard → **Table Editor**: există rândul tău în `profiles` și colecția `Wishlist` în `collections`.
4. Ștergi contul din Profil → rândurile dispar.
