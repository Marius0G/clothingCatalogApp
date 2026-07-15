import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Screen } from '@/components/ui/screen';
import {
  authErrorKey,
  SignInCancelled,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
} from '@/features/auth/api';

export default function SignInScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);

  const run = async (kind: 'email' | 'google' | 'apple', action: () => Promise<void>) => {
    setError(null);
    setBusy(kind);
    try {
      await action();
      // Success: the auth provider flips the navigation gate automatically.
    } catch (err) {
      if (!(err instanceof SignInCancelled)) {
        setError(t(authErrorKey(err)));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <View className="flex-1 justify-center gap-8 py-10">
        <View className="gap-2">
          <Text className="text-4xl font-bold tracking-tight text-ink">
            {t('common.appName')}
          </Text>
          <Text className="text-base text-ink-faint">{t('common.tagline')}</Text>
        </View>

        <View className="gap-4">
          <TextField
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            label={t('auth.password')}
            placeholder={t('auth.passwordPlaceholder')}
            secureTextEntry
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
            error={error}
          />
          <Button
            label={t('auth.signIn')}
            loading={busy === 'email'}
            disabled={!email || !password}
            onPress={() => run('email', () => signInWithEmail(email.trim(), password))}
          />
        </View>

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-ink/10" />
          <Text className="text-sm text-ink-faint">{t('common.or')}</Text>
          <View className="h-px flex-1 bg-ink/10" />
        </View>

        <View className="gap-3">
          <Button
            variant="secondary"
            label={t('auth.signInWithGoogle')}
            loading={busy === 'google'}
            onPress={() => run('google', signInWithGoogle)}
          />
          {Platform.OS === 'ios' ? (
            <Button
              variant="secondary"
              label={t('auth.signInWithApple')}
              loading={busy === 'apple'}
              onPress={() => run('apple', signInWithApple)}
            />
          ) : null}
        </View>

        <View className="flex-row justify-center gap-1.5">
          <Text className="text-ink-faint">{t('auth.noAccount')}</Text>
          <Link href="/sign-up" className="font-semibold text-ink underline">
            {t('auth.signUp')}
          </Link>
        </View>
      </View>
    </Screen>
  );
}
