import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemCard } from '@/components/item-card';
import { EmptyState } from '@/components/ui/empty-state';
import { useCollectionItems, useCollections } from '@/features/collections/hooks';

export default function CollectionDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: items, isPending } = useCollectionItems(id);
  const { data: collections } = useCollections();

  const collection = collections?.find((c) => c.id === id);
  const name = collection?.is_system ? t('tabs.wishlist') : (collection?.name ?? '');

  return (
    <View className="flex-1 bg-paper-warm" style={{ paddingTop: insets.top + 8 }}>
      <Text className="px-6 pb-3 text-3xl font-bold tracking-tight text-ink">{name}</Text>
      {!isPending && items?.length === 0 ? (
        <EmptyState title={t('collections.emptyTitle')} body={t('collections.emptyBody')} />
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
