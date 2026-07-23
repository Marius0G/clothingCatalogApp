import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, ChevronLeftIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { changePassword } from '@/features/auth/api';
import { colors } from '@/lib/theme';

const MIN_PASSWORD_LENGTH = 8;

export default function SecurityScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('security.tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('security.mismatch'));
      return;
    }
    setSaving(true);
    try {
      await changePassword(password);
      setDone(true);
    } catch {
      setError(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-paper px-6" style={{ paddingTop: insets.top + 16 }}>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
        <ChevronLeftIcon size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-serif text-[29px] text-ink">{t('settings.security')}</Text>

      {done ? (
        <View className="mt-8 items-center rounded-2xl border border-hairline bg-card px-6 py-9">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-dark">
            <CheckIcon size={18} color={colors.bright} />
          </View>
          <Text className="mt-4 text-center font-sansbold text-[15px] text-ink">
            {t('security.changed')}
          </Text>
        </View>
      ) : (
        <View className="mt-6 gap-5">
          <TextField
            label={t('security.newPassword')}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
          <TextField
            label={t('security.confirmPassword')}
            secureTextEntry
            autoCapitalize="none"
            value={confirm}
            onChangeText={setConfirm}
            error={error}
          />
          <Button
            label={t('security.change')}
            loading={saving}
            disabled={!password || !confirm}
            onPress={submit}
          />
        </View>
      )}
    </View>
  );
}
