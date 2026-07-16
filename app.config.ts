import { existsSync } from 'fs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

// Set in .env (see .env.example) — used at build time for the Google Sign-In iOS URL scheme.
const GOOGLE_IOS_URL_SCHEME =
  process.env.GOOGLE_IOS_URL_SCHEME ?? 'com.googleusercontent.apps.REPLACE_ME';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Clothing Catalog',
  slug: 'clothesapp',
  owner: 'marius0gs-team',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'clothingcatalog',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'app.clothingcatalog.mobile',
    icon: './assets/expo.icon',
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'app.clothingcatalog.mobile',
    // Apare după setup-ul Firebase (SETUP.md §7); build-ul merge și fără el.
    ...(existsSync('./google-services.json')
      ? { googleServicesFile: './google-services.json' }
      : {}),
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#faf9f7',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-localization',
    'expo-secure-store',
    'expo-web-browser',
    'expo-apple-authentication',
    'expo-notifications',
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: GOOGLE_IOS_URL_SCHEME },
    ],
    [
      'expo-share-intent',
      {
        iosActivationRules: {
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          NSExtensionActivationSupportsText: true,
        },
        androidIntentFilters: ['text/*'],
      },
    ],
    './plugins/withMlkitManifestFix',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: { projectId: 'fd878087-39e1-437a-bb52-716aa8507ee4' },
  },
});
