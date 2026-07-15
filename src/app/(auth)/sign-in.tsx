import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';

import { AppleIcon, EyeIcon, GoogleIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import {
  authErrorKey,
  SignInCancelled,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
} from '@/features/auth/api';
import { colors } from '@/lib/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);

  const run = async (kind: 'email' | 'google' | 'apple', action: () => Promise<void>) => {
    setError(null);
    setBusy(kind);
    try {
      await action();
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
      <View className="flex-1 justify-center py-10">
        <Text className="font-serif text-[35px] leading-[40px] tracking-tight text-ink">
          {t('auth.signIn')}
        </Text>
        <Text className="mt-3 font-sans text-[14.5px] text-soft">{t('auth.subtitle')}</Text>

        <View className="mt-8 gap-[18px]">
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
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
            error={error}
            rightIcon={<EyeIcon size={20} color={colors.muted} />}
            onPressRightIcon={() => setShowPassword((show) => !show)}
          />
          <Button
            label={t('auth.signIn')}
            loading={busy === 'email'}
            disabled={!email || !password}
            onPress={() => run('email', () => signInWithEmail(email.trim(), password))}
          />
        </View>

        <View className="mt-6 flex-row items-center gap-3.5">
          <View className="h-px flex-1 bg-[rgba(28,27,25,0.12)]" />
          <Text className="font-sans text-[12px] text-faint">{t('common.or')}</Text>
          <View className="h-px flex-1 bg-[rgba(28,27,25,0.12)]" />
        </View>

        <View className="mt-6 gap-3">
          {Platform.OS === 'ios' ? (
            <Button
              variant="secondary"
              label={t('auth.apple')}
              icon={<AppleIcon size={18} color={colors.ink} />}
              loading={busy === 'apple'}
              onPress={() => run('apple', signInWithApple)}
            />
          ) : null}
          <Button
            variant="secondary"
            label={t('auth.google')}
            icon={<GoogleIcon size={18} />}
            loading={busy === 'google'}
            onPress={() => run('google', signInWithGoogle)}
          />
        </View>

        <View className="mt-6 flex-row justify-center gap-1.5">
          <Text className="font-sans text-[13.5px] text-soft">{t('auth.noAccount')}</Text>
          <Link href="/" className="font-sansbold text-[13.5px] text-ink underline">
            {t('auth.signUp')}
          </Link>
        </View>
      </View>
    </Screen>
  );
}
