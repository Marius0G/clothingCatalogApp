import '../global.css';
import '@/lib/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthProvider, useAuth } from '@/features/auth/provider';
import { useProfile } from '@/features/profile/hooks';
import { queryClient } from '@/lib/query';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, initializing } = useAuth();
  const { data: profile, isPending: profilePending } = useProfile();
  const { i18n } = useTranslation();

  // Signed in → wait for the profile before choosing onboarding vs tabs.
  const ready = !initializing && (!session || !profilePending);

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

  if (!ready) {
    return null; // splash screen stays visible
  }

  const needsOnboarding = !!session && !profile?.onboarded_at;

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
        <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
        <Stack.Screen name="item/[id]" />
        <Stack.Screen name="collections/index" />
        <Stack.Screen name="collections/[id]" />
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
