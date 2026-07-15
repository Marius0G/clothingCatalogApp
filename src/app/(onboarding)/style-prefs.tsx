import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useUpdateProfile } from '@/features/profile/hooks';

export default function StylePrefsScreen() {
  const { t } = useTranslation();
  const updateProfile = useUpdateProfile();
  const [text, setText] = useState('');
  const [error, setError] = useState(false);

  const finish = async (withText: boolean) => {
    setError(false);
    try {
      await updateProfile.mutateAsync({
        style_preferences: withText && text.trim() ? text.trim() : null,
        onboarded_at: new Date().toISOString(),
      });
      // Root gate flips to (tabs) once the profile cache updates.
    } catch {
      setError(true);
    }
  };

  return (
    <Screen>
      <View className="flex-1 gap-6 py-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-ink">{t('onboarding.styleTitle')}</Text>
          <Text className="text-base leading-6 text-ink-faint">
            {t('onboarding.styleSubtitle')}
          </Text>
        </View>

        <TextInput
          multiline
          textAlignVertical="top"
          placeholder={t('onboarding.stylePlaceholder')}
          placeholderTextColor="#9a9a9a"
          value={text}
          onChangeText={setText}
          className="min-h-[180px] rounded-2xl border border-ink/15 bg-paper p-4 text-base leading-6 text-ink focus:border-ink"
        />

        {error ? <Text className="text-sm text-danger">{t('common.error')}</Text> : null}

        <View className="gap-3">
          <Button
            label={t('onboarding.finish')}
            loading={updateProfile.isPending}
            disabled={!text.trim()}
            onPress={() => finish(true)}
          />
          <Button variant="ghost" label={t('common.skip')} onPress={() => finish(false)} />
        </View>
      </View>
    </Screen>
  );
}
