import type { Item } from '@shared/types';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BookmarkIcon,
  ChevronLeftIcon,
  HangerIcon,
  SparkleIcon,
  TrashIcon,
} from '@/components/icons';
import { EmptyState } from '@/components/ui/empty-state';
import {
  useDeleteOutfit,
  useRecordWear,
  useSavedOutfits,
} from '@/features/outfits/hooks';
import type { SavedOutfitWithItems } from '@/features/outfits/api';
import { useWishlist } from '@/features/wishlist/hooks';
import { useItems, useSignedImageUrl } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';

function OutfitThumb({ item }: { item: Item | undefined }) {
  const { data: imageUrl } = useSignedImageUrl(item?.image_path ?? null);
  return (
    <View className="h-[118px] flex-1 items-center justify-center overflow-hidden rounded-lg">
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
      ) : (
        <View className="items-center gap-1.5 px-1">
          <HangerIcon size={22} color={colors.iconmuted} strokeWidth={1.4} />
          {item?.title ? (
            <Text numberOfLines={2} className="text-center font-sans text-[10px] text-muted">
              {item.title}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function SavedOutfitCard({
  outfit,
  itemsById,
}: {
  outfit: SavedOutfitWithItems;
  itemsById: Map<string, Item>;
}) {
  const { t } = useTranslation();
  const recordWear = useRecordWear();
  const deleteOutfit = useDeleteOutfit();
  const items = outfit.item_ids.map((id) => itemsById.get(id)).filter(Boolean) as Item[];

  const confirmDelete = () => {
    Alert.alert(t('outfits.deleteTitle'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('item.deleteConfirm'),
        style: 'destructive',
        onPress: () => deleteOutfit.mutate(outfit.id),
      },
    ]);
  };

  return (
    <View className="overflow-hidden rounded-[18px] border border-hairline bg-card">
      <View className="flex-row items-end gap-2 bg-imagebg px-4 py-5">
        {items.slice(0, 4).map((item) => (
          <OutfitThumb key={item.id} item={item} />
        ))}
      </View>
      <View className="p-4">
        <Text className="font-serif text-[19px] text-ink">{outfit.title}</Text>
        {outfit.rationale ? (
          <Text className="mt-1.5 font-sans text-[12.5px] leading-[19px] text-body">
            {outfit.rationale}
          </Text>
        ) : null}
        <View className="mt-4 flex-row items-center gap-2.5">
          <Pressable
            accessibilityRole="button"
            disabled={recordWear.isPending}
            onPress={() => recordWear.mutate(outfit.item_ids)}
            className="h-[42px] flex-row items-center justify-center gap-1.5 rounded-[11px] border border-strong px-3.5"
          >
            {recordWear.isPending ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <HangerIcon size={16} color={colors.ink} strokeWidth={1.5} />
            )}
            <Text className="font-sansmed text-[12.5px] text-ink">{t('outfits.woreIt')}</Text>
          </Pressable>
          <View className="flex-1" />
          <Pressable
            accessibilityRole="button"
            onPress={confirmDelete}
            className="h-[42px] w-[42px] items-center justify-center rounded-[11px] border border-strong"
          >
            <TrashIcon size={16} color={colors.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function OutfitsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: outfits, isPending } = useSavedOutfits();
  const { data: wardrobeItems } = useItems('wardrobe');
  const { data: wishlistEntries } = useWishlist();

  const itemsById = useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of wardrobeItems ?? []) map.set(item.id, item);
    for (const entry of wishlistEntries ?? []) {
      const { tracked_product: _tp, ...item } = entry;
      map.set(item.id, item as Item);
    }
    return map;
  }, [wardrobeItems, wishlistEntries]);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center gap-3.5 px-6 pb-3">
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()}>
          <ChevronLeftIcon size={22} color={colors.ink} />
        </Pressable>
        <Text className="font-serif text-[26px] text-ink">{t('outfits.title')}</Text>
      </View>

      {isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : (outfits?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<BookmarkIcon size={38} color={colors.iconmuted} />}
          title={t('outfits.emptyTitle')}
          body={t('outfits.emptySub')}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-6"
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        >
          {outfits!.map((outfit) => (
            <SavedOutfitCard key={outfit.id} outfit={outfit} itemsById={itemsById} />
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/discover')}
            className="mt-1 items-center rounded-[18px] border border-hairline bg-card px-8 py-6 active:bg-paper"
          >
            <SparkleIcon size={20} color={colors.iconmuted} />
            <Text className="mt-2 text-center font-sans text-[13px] text-soft">
              {t('outfits.discoverMore')}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
