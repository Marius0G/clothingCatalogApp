import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';

import { AppleIcon, CheckIcon, EyeIcon, GoogleIcon, MailIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import {
  authErrorKey,
  SignInCancelled,
  signInWithApple,
  signInWithGoogle,
  signUpWithEmail,
} from '@/features/auth/api';
import { colors } from '@/lib/theme';

/** Design 1a — Sign up as the entry screen. */
export default function SignUpScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

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

  const submitEmail = () =>
    run('email', async () => {
      const { needsEmailConfirmation } = await signUpWithEmail(email.trim(), password);
      if (needsEmailConfirmation) {
        setConfirmationSent(true);
      }
    });

  if (confirmationSent) {
    return (
      <Screen>
        <View className="flex-1 justify-center gap-6 py-10">
          <Text className="font-serif text-[35px] leading-[40px] text-ink">{t('auth.title')}</Text>
          <Text className="font-sans text-[14.5px] leading-[22px] text-soft">
            {t('auth.checkEmail')}
          </Text>
          <Link href="/sign-in" asChild>
            <Button label={t('auth.signIn')} />
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="pb-6 pt-10">
        <Text className="font-serif text-[35px] leading-[40px] tracking-tight text-ink">
          {t('auth.title')}
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
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            error={error}
            rightIcon={<EyeIcon size={20} color={colors.muted} />}
            onPressRightIcon={() => setShowPassword((show) => !show)}
          />
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed(!agreed)}
          className="mt-[18px] flex-row items-start gap-2.5"
        >
          <View
            className={`mt-0.5 h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] ${
              agreed ? 'border-dark bg-dark' : 'border-[rgba(28,27,25,0.3)]'
            }`}
          >
            {agreed ? <CheckIcon size={11} color={colors.bright} /> : null}
          </View>
          <Text className="flex-1 font-sans text-[12.5px] leading-[19px] text-soft">
            {t('auth.agreePre')} <Text className="text-ink underline">{t('auth.tos')}</Text>{' '}
            {t('auth.andW')} <Text className="text-ink underline">{t('auth.privacy')}</Text>
          </Text>
        </Pressable>

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
          <Button
            label={t('auth.contEmail')}
            icon={<MailIcon size={18} color={colors.bright} />}
            loading={busy === 'email'}
            disabled={!email || password.length < 8}
            onPress={submitEmail}
          />
        </View>

        <View className="mt-6 flex-row items-center gap-3.5">
          <View className="h-px flex-1 bg-[rgba(28,27,25,0.12)]" />
          <Text className="font-sans text-[12px] text-faint">{t('common.or')}</Text>
          <View className="h-px flex-1 bg-[rgba(28,27,25,0.12)]" />
        </View>

        <View className="mt-5 flex-row justify-center gap-1.5">
          <Text className="font-sans text-[13.5px] text-soft">{t('auth.haveAccount')}</Text>
          <Link href="/sign-in" className="font-sansbold text-[13.5px] text-ink underline">
            {t('auth.signIn')}
          </Link>
        </View>
      </View>
    </Screen>
  );
}
