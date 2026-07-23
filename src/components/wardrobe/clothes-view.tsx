import type { Item } from '@shared/types';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIcon, HangerIcon } from '@/components/icons';
import { ItemCard } from '@/components/item-card';
import { EmptyState } from '@/components/ui/empty-state';
import { colors } from '@/lib/theme';

/** Clothes mode of the wardrobe tab: count + 2-column grid (or empty state). */
export function ClothesView({
  items,
  empty,
  onLongPressItem,
  justWornId,
}: {
  items: Item[];
  empty: boolean;
  onLongPressItem: (item: Item) => void;
  justWornId: string | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (empty) {
    return (
      <EmptyState
        icon={<HangerIcon size={42} color={colors.iconmuted} strokeWidth={1.4} />}
        title={t('wardrobe.emptyTitle')}
        body={t('wardrobe.emptySub')}
        ctaLabel={t('wardrobe.emptyCta')}
        ctaIcon={<CameraIcon size={18} color={colors.bright} />}
        onPressCta={() => router.push('/add-item')}
      />
    );
  }

  return (
    <View className="flex-1">
      <Text className="mt-4 px-6 font-sans text-[12.5px] text-muted">
        {t('wardrobe.items', { count: items.length })}
      </Text>
      <FlashList
        data={items}
        numColumns={2}
        keyExtractor={(item) => item.id}
        extraData={justWornId}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onLongPress={() => onLongPressItem(item)}
            justWorn={justWornId === item.id}
          />
        )}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 8,
          paddingBottom: insets.bottom + 110,
        }}
      />
    </View>
  );
}
