import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemCard } from '@/components/item-card';
import { EmptyState } from '@/components/ui/empty-state';
import { useItems } from '@/features/wardrobe/hooks';

export default function WardrobeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: items, isPending } = useItems('wardrobe');

  return (
    <View className="flex-1 bg-paper-warm" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between px-6 pb-3">
        <Text className="text-3xl font-bold tracking-tight text-ink">{t('tabs.wardrobe')}</Text>
        <View className="flex-row gap-2">
          <Link href="/collections" asChild>
            <Pressable
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-full bg-paper-sunken active:bg-paper"
            >
              <Ionicons name="albums-outline" size={20} color="#1a1a1a" />
            </Pressable>
          </Link>
          <Link href="/add-item" asChild>
            <Pressable
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-full bg-ink active:bg-ink-soft"
            >
              <Ionicons name="add" size={24} color="#ffffff" />
            </Pressable>
          </Link>
        </View>
      </View>

      {!isPending && items?.length === 0 ? (
        <EmptyState title={t('wardrobe.emptyTitle')} body={t('wardrobe.emptyBody')} />
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
