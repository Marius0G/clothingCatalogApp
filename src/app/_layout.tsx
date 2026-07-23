import '../global.css';
import '@/lib/i18n';

import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthProvider, useAuth } from '@/features/auth/provider';
import { useProfile } from '@/features/profile/hooks';
import { registerPushToken } from '@/lib/push';
import { queryClient } from '@/lib/query';
import { useShareIntent } from '@/lib/share-intent';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, initializing } = useAuth();
  const { data: profile, isPending: profilePending } = useProfile();
  const { i18n } = useTranslation();
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });

  // Signed in → wait for the profile before choosing onboarding vs tabs.
  const ready = fontsLoaded && !initializing && (!session || !profilePending);
  const needsOnboarding = !!session && !profile?.onboarded_at;

  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  useEffect(() => {
    if (profile?.locale && profile.locale !== i18n.language) {
      i18n.changeLanguage(profile.locale);
    }
  }, [profile?.locale, i18n]);

  useEffect(() => {
    if (session) {
      registerPushToken(session.user.id);
    }
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps -- once per signed-in user

  useEffect(() => {
    if (!hasShareIntent || !ready) return;
    const url =
      shareIntent.webUrl ?? /https?:\/\/\S+/.exec(shareIntent.text ?? '')?.[0] ?? null;
    resetShareIntent();
    if (url && session && !needsOnboarding) {
      router.push({ pathname: '/share-import', params: { url } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per received intent
  }, [hasShareIntent, ready]);

  if (!ready) {
    return null; // splash screen stays visible
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && needsOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !needsOnboarding}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add-chooser"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
        <Stack.Screen name="wishlist-import" />
        <Stack.Screen name="share-import" />
        <Stack.Screen name="item/[id]" />
        <Stack.Screen name="outfit/[id]" />
        <Stack.Screen name="collections/index" />
        <Stack.Screen name="collections/[id]" />
        <Stack.Screen name="preferences" />
        <Stack.Screen name="support/index" />
        <Stack.Screen name="support/help" />
        <Stack.Screen name="support/feedback" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/account" />
        <Stack.Screen name="settings/security" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="settings/about" />
        <Stack.Screen name="settings/terms" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
