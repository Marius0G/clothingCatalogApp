import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Screen } from '@/components/ui/screen';
import { useUpdateProfile } from '@/features/profile/hooks';

const SEX_OPTIONS = ['male', 'female', 'other'] as const;

export default function OnboardingProfileScreen() {
  const { t } = useTranslation();
  const updateProfile = useUpdateProfile();

  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<(typeof SEX_OPTIONS)[number] | null>(null);
  const [sizeTop, setSizeTop] = useState('');
  const [sizeBottom, setSizeBottom] = useState('');
  const [sizeShoe, setSizeShoe] = useState('');

  const sexLabels = {
    male: t('onboarding.sexMale'),
    female: t('onboarding.sexFemale'),
    other: t('onboarding.sexOther'),
  } as const;

  const saveAndContinue = async () => {
    const parsedAge = parseInt(age, 10);
    const sizes: Record<string, string> = {};
    if (sizeTop.trim()) sizes.top = sizeTop.trim();
    if (sizeBottom.trim()) sizes.bottom = sizeBottom.trim();
    if (sizeShoe.trim()) sizes.shoe = sizeShoe.trim();

    try {
      await updateProfile.mutateAsync({
        nickname: nickname.trim() || null,
        sex,
        birth_year: Number.isFinite(parsedAge)
          ? new Date().getFullYear() - parsedAge
          : null,
        sizes,
      });
    } catch {
      // Optional data — never block onboarding on a failed save.
    }
    router.push('/style-prefs');
  };

  return (
    <Screen>
      <View className="gap-6 py-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-ink">{t('onboarding.profileTitle')}</Text>
          <Text className="text-base text-ink-faint">{t('onboarding.profileSubtitle')}</Text>
        </View>

        <TextField
          label={t('onboarding.nickname')}
          placeholder={t('onboarding.nicknamePlaceholder')}
          value={nickname}
          onChangeText={setNickname}
        />
        <TextField
          label={t('onboarding.age')}
          keyboardType="number-pad"
          maxLength={3}
          value={age}
          onChangeText={setAge}
        />

        <View className="gap-1.5">
          <Text className="text-sm font-medium text-ink-soft">{t('onboarding.sex')}</Text>
          <View className="flex-row gap-2">
            {SEX_OPTIONS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setSex(sex === option ? null : option)}
                className={`h-11 flex-1 items-center justify-center rounded-full border ${
                  sex === option ? 'border-ink bg-ink' : 'border-ink/15 bg-paper'
                }`}
              >
                <Text className={sex === option ? 'font-medium text-paper' : 'text-ink-soft'}>
                  {sexLabels[option]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-4">
          <Text className="text-sm font-medium text-ink-soft">{t('onboarding.sizesTitle')}</Text>
          <TextField label={t('onboarding.sizeTop')} placeholder="S / M / L…" value={sizeTop} onChangeText={setSizeTop} />
          <TextField label={t('onboarding.sizeBottom')} placeholder="30 / 32 / M…" value={sizeBottom} onChangeText={setSizeBottom} />
          <TextField label={t('onboarding.sizeShoe')} placeholder="42" keyboardType="number-pad" value={sizeShoe} onChangeText={setSizeShoe} />
        </View>

        <View className="gap-3 pt-2">
          <Button
            label={t('common.continue')}
            loading={updateProfile.isPending}
            onPress={saveAndContinue}
          />
          <Button
            variant="ghost"
            label={t('common.skip')}
            onPress={() => router.push('/style-prefs')}
          />
        </View>
      </View>
    </Screen>
  );
}
