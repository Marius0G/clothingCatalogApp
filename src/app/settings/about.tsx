import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon } from '@/components/icons';
import { colors } from '@/lib/theme';

export default function AboutScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
      contentContainerClassName="px-6"
    >
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
        <ChevronLeftIcon size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-serif text-[29px] text-ink">{t('about.title')}</Text>
      <Text className="mt-5 font-sans text-[14px] leading-[22px] text-body">{t('about.body')}</Text>
      <Text className="mt-8 font-sans text-[12px] text-muted">
        {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
      </Text>
    </ScrollView>
  );
}
