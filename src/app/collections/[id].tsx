import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkIcon, ChevronLeftIcon } from '@/components/icons';
import { ItemCard } from '@/components/item-card';
import { EmptyState } from '@/components/ui/empty-state';
import { useCollectionItems, useCollections } from '@/features/collections/hooks';
import { colors } from '@/lib/theme';

export default function CollectionDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: items, isPending } = useCollectionItems(id);
  const { data: collections } = useCollections();

  const collection = collections?.find((c) => c.id === id);
  const name = collection?.is_system ? t('tabs.wishlist') : (collection?.name ?? '');

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 16 }}>
      <View className="px-6 pb-3">
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
          <ChevronLeftIcon size={22} color={colors.ink} />
        </Pressable>
        <Text className="font-serif text-[29px] text-ink">{name}</Text>
      </View>
      {!isPending && items?.length === 0 ? (
        <EmptyState
          icon={<BookmarkIcon size={38} color={colors.iconmuted} strokeWidth={1.4} />}
          title={t('collections.emptyTitle')}
          body={t('collections.emptyBody')}
        />
      ) : (
        <FlashList
          data={items ?? []}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 16 }}
        />
      )}
    </View>
  );
}
