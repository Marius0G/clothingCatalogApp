import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useUpdateProfile } from '@/features/profile/hooks';

const SEX_OPTIONS = ['male', 'female', 'other'] as const;

export default function OnboardingProfileScreen() {
  const { t } = useTranslation();
  const updateProfile = useUpdateProfile();

  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<(typeof SEX_OPTIONS)[number] | null>(null);

  const sexLabels = {
    male: t('onboarding.sexMale'),
    female: t('onboarding.sexFemale'),
    other: t('onboarding.sexOther'),
  } as const;

  const saveAndContinue = async () => {
    const parsedAge = parseInt(age, 10);
    try {
      await updateProfile.mutateAsync({
        nickname: nickname.trim() || null,
        sex,
        birth_year: Number.isFinite(parsedAge) ? new Date().getFullYear() - parsedAge : null,
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
          <Text className="font-serif text-[29px] leading-[34px] text-ink">
            {t('onboarding.profileTitle')}
          </Text>
          <Text className="font-sans text-[13.5px] leading-[20px] text-soft">
            {t('onboarding.profileSubtitle')}
          </Text>
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

        <View className="gap-2">
          <Text className="text-[13px] font-sansmed text-label">{t('onboarding.sex')}</Text>
          <View className="flex-row gap-2">
            {SEX_OPTIONS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setSex(sex === option ? null : option)}
                className={`h-11 flex-1 items-center justify-center rounded-full ${
                  sex === option ? 'bg-dark' : 'border border-field bg-bright'
                }`}
              >
                <Text
                  className={
                    sex === option
                      ? 'font-sansmed text-[13px] text-bright'
                      : 'font-sans text-[13px] text-soft'
                  }
                >
                  {sexLabels[option]}
                </Text>
              </Pressable>
            ))}
          </View>
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
