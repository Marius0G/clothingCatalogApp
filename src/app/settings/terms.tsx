import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon } from '@/components/icons';
import { colors } from '@/lib/theme';

export default function TermsScreen() {
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
      <Text className="font-serif text-[29px] text-ink">{t('terms.title')}</Text>
      <Text className="mt-5 font-sansbold text-[15px] text-ink">{t('terms.termsHeading')}</Text>
      <Text className="mt-2 font-sans text-[13.5px] leading-[21px] text-body">
        {t('terms.termsBody')}
      </Text>
      <Text className="mt-6 font-sansbold text-[15px] text-ink">{t('terms.privacyHeading')}</Text>
      <Text className="mt-2 font-sans text-[13.5px] leading-[21px] text-body">
        {t('terms.privacyBody')}
      </Text>
    </ScrollView>
  );
}
