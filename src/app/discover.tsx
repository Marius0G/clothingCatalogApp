import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon, RegenerateIcon, SparkleIcon } from '@/components/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { colors } from '@/lib/theme';

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center gap-3.5 px-6 pb-3">
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()}>
          <ChevronLeftIcon size={22} color={colors.ink} />
        </Pressable>
        <Text className="font-serif text-[26px] text-ink">{t('discover.title')}</Text>
      </View>

      <View className="mt-2 flex-row items-center justify-between px-6">
        <Text className="font-serif text-[20px] text-ink">{t('discover.forYou')}</Text>
        <View className="flex-row items-center gap-1.5 rounded-full border border-strong px-3 py-2">
          <RegenerateIcon size={14} color={colors.ink} />
          <Text className="font-sansmed text-[12.5px] text-ink">{t('discover.regenerate')}</Text>
        </View>
      </View>

      <EmptyState
        icon={<SparkleIcon size={38} color={colors.iconmuted} />}
        title={t('discover.emptyTitle')}
        body={t('discover.emptySub')}
      />
    </View>
  );
}
