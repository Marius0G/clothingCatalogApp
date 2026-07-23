import type { Profile } from '@shared/types';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/features/auth/provider';
import { useProfile, useUpdateProfile } from '@/features/profile/hooks';
import { colors } from '@/lib/theme';

const SEX_OPTIONS = ['male', 'female', 'other'] as const;

/** Rendered only once the profile is loaded, so state seeds from it directly. */
function AccountForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const updateProfile = useUpdateProfile();

  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [sex, setSex] = useState<Profile['sex']>(profile.sex);
  const [birthYear, setBirthYear] = useState(
    profile.birth_year ? String(profile.birth_year) : '',
  );
  const [error, setError] = useState(false);

  const save = async () => {
    setError(false);
    const year = Number.parseInt(birthYear, 10);
    try {
      await updateProfile.mutateAsync({
        nickname: nickname.trim() || null,
        sex,
        birth_year: Number.isFinite(year) && year >= 1900 && year <= 2100 ? year : null,
      });
      router.back();
    } catch {
      setError(true);
    }
  };

  return (
    <View className="flex-1 bg-paper px-6" style={{ paddingTop: insets.top + 16 }}>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
        <ChevronLeftIcon size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-serif text-[29px] text-ink">{t('settings.accountInfo')}</Text>

      <View className="mt-6 gap-5">
        <View className="gap-2">
          <Text className="text-[13px] font-sansmed text-label">{t('account.email')}</Text>
          <Text className="font-sans text-[15px] text-soft">{session?.user.email}</Text>
        </View>
        <TextField
          label={t('onboarding.nickname')}
          placeholder={t('onboarding.nicknamePlaceholder')}
          value={nickname}
          onChangeText={setNickname}
        />
        <View className="gap-2">
          <Text className="text-[13px] font-sansmed text-label">{t('onboarding.sex')}</Text>
          <View className="flex-row gap-2">
            {SEX_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={t(`onboarding.sex${option[0]!.toUpperCase()}${option.slice(1)}`)}
                selected={sex === option}
                onPress={() => setSex(sex === option ? null : option)}
              />
            ))}
          </View>
        </View>
        <TextField
          label={t('account.birthYear')}
          placeholder="1998"
          keyboardType="number-pad"
          value={birthYear}
          onChangeText={setBirthYear}
          error={error ? t('common.error') : null}
        />
        <Button label={t('account.save')} loading={updateProfile.isPending} onPress={save} />
      </View>
    </View>
  );
}

export default function AccountScreen() {
  const { data: profile } = useProfile();
  if (!profile) return <View className="flex-1 bg-paper" />;
  return <AccountForm profile={profile} />;
}
