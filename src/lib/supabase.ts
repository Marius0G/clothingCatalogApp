import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

/**
 * Session storage per Supabase's Expo guide: SecureStore has a 2048-byte limit,
 * too small for a session, so the AES key lives in SecureStore and the
 * encrypted session in AsyncStorage. Native only — on web AsyncStorage
 * (localStorage) is used directly, as SecureStore does not exist there.
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return null;
    }
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return null;
    }
    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Web session storage. Guarded because expo-router's static export prerenders
 * in Node, where localStorage doesn't exist (sessions there are just absent).
 */
const webStorage = {
  getItem: (key: string) =>
    typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env and fill it in.',
  );
}

/**
 * A cloud URL (https) is reachable from anywhere and passes through untouched.
 * A local-stack URL (http://…:54321) is only meaningful relative to the
 * machine running `npx supabase start` — which is the same machine running
 * Metro / serving the web build — so its host is re-derived per platform
 * instead of hand-edited in .env:
 *  - web: the host the page itself was loaded from (window.location.hostname);
 *    EXPO_PUBLIC_SUPABASE_URL_WEB still overrides for web served through a
 *    tunnel (ngrok), where the page is https and localhost is unreachable.
 *  - native dev: the host Metro is reached at (Constants.expoConfig.hostUri) —
 *    the emulator and a physical phone on the same Wi-Fi both get the right
 *    address. Falls back to the .env value (10.0.2.2 = emulator alias) when
 *    hostUri is localhost (adb reverse) or absent (release build).
 */
function resolveSupabaseUrl(envUrl: string): string {
  if (!envUrl.startsWith('http://')) {
    return envUrl;
  }
  const port = new URL(envUrl).port || '54321';
  if (Platform.OS === 'web') {
    const override = process.env.EXPO_PUBLIC_SUPABASE_URL_WEB;
    if (override) return override;
    const host =
      typeof window === 'undefined' || window.location.protocol === 'https:'
        ? '127.0.0.1'
        : window.location.hostname;
    return `http://${host}:${port}`;
  }
  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
    return `http://${metroHost}:${port}`;
  }
  return envUrl;
}

const resolvedUrl = resolveSupabaseUrl(supabaseUrl);

// ngrok's free tier answers browser requests with an HTML interstitial unless
// this header is sent; it is CORS-allowed in supabase/functions/_shared/cors.ts.
const tunnelHeaders = resolvedUrl.includes('ngrok')
  ? { 'ngrok-skip-browser-warning': 'true' }
  : undefined;

export const supabase = createClient(resolvedUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    // On web the OAuth redirect lands back on the app with tokens in the URL.
    detectSessionInUrl: Platform.OS === 'web',
  },
  ...(tunnelHeaders ? { global: { headers: tunnelHeaders } } : {}),
});

// Surface a broken backend at startup with an actionable message, instead of
// every query failing with an opaque "TypeError: Failed to fetch".
if (__DEV__) {
  fetch(`${resolvedUrl}/auth/v1/health`, {
    headers: { apikey: supabaseAnonKey, ...(tunnelHeaders ?? {}) },
  })
    .then((res) => {
      console.log(`[supabase] ${Platform.OS} → ${resolvedUrl} (health ${res.status})`);
    })
    .catch(() => {
      console.warn(
        `[supabase] ${resolvedUrl} is UNREACHABLE from this ${Platform.OS} client.\n` +
          (resolvedUrl.startsWith('http://')
            ? '  Local stack: is Docker Desktop running + `npx supabase start` done? ' +
              'Otherwise switch .env to the CLOUD block.'
            : '  Check the internet connection / EXPO_PUBLIC_SUPABASE_URL in .env.') +
          '\n  After any .env change, restart Metro with --clear (values are baked into the bundle).',
      );
    });
}

// Refresh tokens only while the app is foregrounded (Supabase-recommended).
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
