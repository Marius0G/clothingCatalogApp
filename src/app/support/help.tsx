import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon } from '@/components/icons';
import { colors } from '@/lib/theme';

const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

export default function HelpCenterScreen() {
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
      <Text className="font-serif text-[29px] text-ink">{t('support.helpCenter')}</Text>

      <View className="mt-6 gap-3.5">
        {FAQ_KEYS.map((key) => (
          <View key={key} className="rounded-2xl border border-hairline bg-card p-4">
            <Text className="font-sansbold text-[14.5px] text-ink">
              {t(`support.faq.${key}`)}
            </Text>
            <Text className="mt-1.5 font-sans text-[13px] leading-[19px] text-soft">
              {t(`support.faq.a${key.slice(1)}`)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
