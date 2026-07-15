import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Screen } from '@/components/ui/screen';
import { authErrorKey, signUpWithEmail } from '@/features/auth/api';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const { needsEmailConfirmation } = await signUpWithEmail(email.trim(), password);
      if (needsEmailConfirmation) {
        setConfirmationSent(true);
      }
      // Otherwise a session exists and the root gate moves to onboarding.
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  if (confirmationSent) {
    return (
      <Screen>
        <View className="flex-1 justify-center gap-6 py-10">
          <Text className="text-3xl font-bold text-ink">{t('auth.signUp')}</Text>
          <Text className="text-base leading-6 text-ink-soft">{t('auth.checkEmail')}</Text>
          <Button label={t('auth.signIn')} onPress={() => router.dismissTo('/')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 justify-center gap-8 py-10">
        <Text className="text-3xl font-bold text-ink">{t('auth.signUp')}</Text>

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
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            error={error}
          />
          <Button
            label={t('auth.signUp')}
            loading={busy}
            disabled={!email || password.length < 8}
            onPress={submit}
          />
        </View>

        <View className="flex-row justify-center gap-1.5">
          <Text className="text-ink-faint">{t('auth.haveAccount')}</Text>
          <Link href="/" className="font-semibold text-ink underline">
            {t('auth.signIn')}
          </Link>
        </View>
      </View>
    </Screen>
  );
}
