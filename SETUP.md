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

## 3. Google Sign-In — ✅ Android GATA (16 iul 2026)

Configurat pe proiectul Google Cloud **clothesapp-4cadf** (cel creat de Firebase):

- Client OAuth **Web** `176054135803-c2k1gii3ogmv0mb6n6hu592ulrjs1r03...` → în `.env` (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` + `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`); JSON-ul complet e păstrat gitignored în `google-oauth-web-client.json`.
- Client OAuth **Android** cu package `app.clothingcatalog.mobile` + SHA-1 de debug (`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`). ⚠️ La release, adaugă și SHA-1 al cheii de release (din `eas credentials`) ca al doilea fingerprint.
- Providerul Google e activat și în stack-ul local (`supabase/config.toml`, secret prin `env()` din `.env`) și în cloud (via Management API, `skip_nonce_check=true` — fluxul nativ nu trimite nonce).

Rămas pentru iOS (când există cont Apple Developer): client OAuth **iOS** (bundle `app.clothingcatalog.mobile`) → `GOOGLE_IOS_URL_SCHEME` în `.env`.

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

## 7. Push notifications reale — ✅ Android GATA (16 iul 2026)

Verificat cap-coadă pe emulator: Firebase `clothesapp-4cadf`, cheia FCM V1 încărcată în EAS (proiect `marius0gs-team/clothesapp`), token înregistrat în `push_tokens`, notificare livrată. Dispatcher-ul trimite cu `priority: high` (FCM amână mesajele normale pe device-uri în idle). iOS rămâne pentru când există cont Apple Developer. Pașii de mai jos rămân ca referință:

### 7a. Expo / EAS (o singură dată)

1. Cont gratuit pe [expo.dev](https://expo.dev).
2. În terminal (interactiv): `npx eas login`, apoi `npx eas init`.
3. `eas init` afișează un **projectId** (UUID). Config-ul fiind dinamic (`app.config.ts`), CLI-ul nu-l poate scrie singur — trebuie adăugat manual în `app.config.ts`:
   ```ts
   extra: { eas: { projectId: '<UUID-ul afișat>' } },
   ```
   `src/lib/push.ts` îl citește automat de acolo; fără el înregistrarea de token e no-op silențios.

### 7b. Firebase / FCM

4. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (ex. `clothing-catalog`; Google Analytics poate rămâne oprit).
5. În proiect: **Add app → Android** → package name exact `app.clothingcatalog.mobile` (SHA-1 nu e necesar pentru push) → **Register**.
6. Descarcă **`google-services.json`** și pune-l în **rădăcina repo-ului**. E deja în `.gitignore`, iar `app.config.ts` îl preia automat dacă există.
7. Cheia pentru serverul de push Expo: Firebase → ⚙️ **Project settings → Service accounts → Generate new private key** → salvează JSON-ul ca `firebase-service-account.json` (tot gitignored; NU se comite).
8. `npx eas credentials` (interactiv) → **Android** → profilul `development` → **Google Service Account** → **Manage … (FCM V1)** → **Set up** → dă calea către JSON-ul de la pasul 7.

### 7c. Rebuild + test

9. `google-services.json` intră în build-ul nativ, deci e nevoie de rebuild: `npx expo prebuild --platform android --clean` apoi `npx expo run:android`.
10. Atenție la emulator: push-ul cere **Google Play services** (imagine AVD „Google Play"); pe o imagine fără Play services testează pe un telefon Android real.
11. Verificare: deschide aplicația, acceptă permisiunea de notificări → apare un rând în `push_tokens`. Test rapid de livrare: [expo.dev/notifications](https://expo.dev/notifications) cu token-ul din DB; testul complet e pipeline-ul real (schimbi prețul unui produs urmărit → cron → notificare).

Fără acești pași nimic nu se pierde: notificările rămân în DB cu status `no_token`.

## Note modele AI

- Text: `Qwen/Qwen2.5-72B-Instruct` (Llama-3.3 e gated pe Featherless — ar cere verificare HuggingFace).
- Vision: `Qwen/Qwen2.5-VL-72B-Instruct` (7B e frecvent la capacitate).
- Ambele se pot suprascrie prin secrets: `TEXT_MODEL`, `VISION_MODEL`, `VISION_BASE_URL`, `VISION_API_KEY`.

## Verificare rapidă că totul e legat

1. `.env` completat → `npx expo start` → aplicația pornește fără eroarea de env.
2. Creezi cont cu email → primești mail de confirmare → după confirmare intri și vezi onboarding-ul.
3. În Supabase dashboard → **Table Editor**: există rândul tău în `profiles` și colecția `Wishlist` în `collections`.
4. Ștergi contul din Profil → rândurile dispar.
