# Setup — pași manuali

Ce trebuie făcut de mână (o singură dată) ca aplicația să meargă cap-coadă. Ordinea contează.

## 1. Supabase — ✅ GATA (16 iul 2026)

Proiectul cloud există: **clothing-catalog** (`kzoscldpakbhtpulujdw`, Frankfurt) — [dashboard](https://supabase.com/dashboard/project/kzoscldpakbhtpulujdw). Schema e aplicată, `delete-account` și `tag-item` sunt deploy-ate, cheia Featherless e setată ca secret. Valorile pentru `.env` (varianta cloud) sunt deja în `.env`, comentate.

Dezvoltarea de zi cu zi merge pe stack-ul local: `npx supabase start` (cere Docker Desktop pornit) + `.env`-ul activ pointează la `10.0.2.2:54321`. După fiecare migrare nouă: `npx supabase db push` o aplică și în cloud.

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

## 5. Featherless AI — ✅ GATA (16 iul 2026)

Cheia e setată ca secret pe funcțiile cloud și local în `supabase/functions/.env` (gitignored). Model vision: `Qwen/Qwen2.5-VL-72B-Instruct` (7B e frecvent la capacitate). Nu pune cheia NICIODATĂ în `.env`-ul aplicației (ar ajunge în bundle).

## 6. Afiliere (aprobarea durează săptămâni — pornește aplicațiile devreme)

Partenerul de business își face cont de afiliat pe **2performant.com** și **profitshare.ro** și aplică la programele advertiserilor de fashion (Answear, Fashion Days, ABOUT YOU etc.). Infrastructura există deja: când aveți URL-ul de feed real, îl ingerați cu:

```
curl -X POST https://kzoscldpakbhtpulujdw.supabase.co/functions/v1/ingest-affiliate \
  -H "Authorization: Bearer <service_role_key>" -H "Content-Type: application/json" \
  -d '{"feed_url":"<URL-ul feed-ului CSV>","network":"2performant"}'
```

(coloanele CSV sunt mapate flexibil — vezi `supabase/functions/ingest-affiliate/index.ts`; există și un feed de test în `sample-feed.csv`). Pentru rulare zilnică automată, adăugați un cron nou în migrare după modelul celor existente.

## 7. Push notifications reale (opțional până la lansare)

Outbox-ul + dispatcher-ul de notificări **funcționează deja** (cron la 5 min în cloud); ce lipsește e livrarea pe telefon, care cere:
1. Cont Expo + `npx eas init` (setează `extra.eas.projectId` — codul de înregistrare push îl folosește automat).
2. Proiect Firebase (gratuit) → FCM credentials încărcate cu `npx eas credentials` (Android).
3. Rebuild dev client. Fără acești pași, notificările rămân în DB cu status `no_token` — nimic nu se pierde.

## Note modele AI

- Text: `Qwen/Qwen2.5-72B-Instruct` (Llama-3.3 e gated pe Featherless — ar cere verificare HuggingFace).
- Vision: `Qwen/Qwen2.5-VL-72B-Instruct` (7B e frecvent la capacitate).
- Ambele se pot suprascrie prin secrets: `TEXT_MODEL`, `VISION_MODEL`, `VISION_BASE_URL`, `VISION_API_KEY`.

## Verificare rapidă că totul e legat

1. `.env` completat → `npx expo start` → aplicația pornește fără eroarea de env.
2. Creezi cont cu email → primești mail de confirmare → după confirmare intri și vezi onboarding-ul.
3. În Supabase dashboard → **Table Editor**: există rândul tău în `profiles` și colecția `Wishlist` în `collections`.
4. Ștergi contul din Profil → rândurile dispar.
