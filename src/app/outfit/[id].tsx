import type { Item } from '@shared/types';
import { Image } from 'expo-image';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon, ChevronRightIcon, HangerIcon, TrashIcon } from '@/components/icons';
import { OutfitThumb } from '@/components/outfit-thumb';
import {
  useDeleteOutfit,
  useItemLookup,
  useRecordWear,
  useSavedOutfits,
} from '@/features/outfits/hooks';
import { useSignedImageUrl } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';

function PieceRow({ item }: { item: Item }) {
  const { data: imageUrl } = useSignedImageUrl(item.image_path);
  return (
    <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
      <Pressable className="flex-row items-center gap-3.5 rounded-2xl border border-hairline bg-card p-3 active:bg-paper">
        <View className="h-16 w-14 overflow-hidden rounded-[10px] bg-imagebg">
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ flex: 1 }} contentFit="cover" />
          ) : null}
        </View>
        <View className="flex-1">
          <Text className="font-sansbold text-[14px] text-ink" numberOfLines={1}>
            {item.title || item.subcategory || item.brand || ''}
          </Text>
          {item.brand && item.title ? (
            <Text className="mt-0.5 font-sans text-[12px] text-soft" numberOfLines={1}>
              {item.brand}
            </Text>
          ) : null}
        </View>
        <ChevronRightIcon size={16} color={colors.muted} />
      </Pressable>
    </Link>
  );
}

export default function OutfitDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: outfits, isPending } = useSavedOutfits();
  const itemsById = useItemLookup();
  const recordWear = useRecordWear();
  const deleteOutfit = useDeleteOutfit();

  const outfit = outfits?.find((o) => o.id === id);
  const items = (outfit?.item_ids ?? [])
    .map((itemId) => itemsById.get(itemId))
    .filter(Boolean) as Item[];

  const confirmDelete = () => {
    if (!outfit) return;
    Alert.alert(t('outfits.deleteTitle'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('item.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          await deleteOutfit.mutateAsync(outfit.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center gap-3.5 px-6 pb-3">
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()}>
          <ChevronLeftIcon size={22} color={colors.ink} />
        </Pressable>
        <Text className="font-serif text-[26px] text-ink">{t('outfitDetail.title')}</Text>
      </View>

      {isPending || !outfit ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          <View className="overflow-hidden rounded-[18px] border border-hairline bg-imagebg">
            <View className="flex-row items-end gap-2 px-4 py-6">
              {items.slice(0, 4).map((item) => (
                <OutfitThumb key={item.id} item={item} height={150} />
              ))}
            </View>
          </View>

          <Text className="mt-5 font-serif text-[24px] text-ink">{outfit.title}</Text>
          {outfit.rationale ? (
            <Text className="mt-2 font-sans text-[13px] leading-[20px] text-body">
              {outfit.rationale}
            </Text>
          ) : null}

          <View className="mt-5 flex-row items-center gap-2.5">
            <Pressable
              accessibilityRole="button"
              disabled={recordWear.isPending}
              onPress={() => recordWear.mutate(outfit.item_ids)}
              className="h-[46px] flex-1 flex-row items-center justify-center gap-2 rounded-[12px] border border-strong"
            >
              {recordWear.isPending ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <HangerIcon size={17} color={colors.ink} strokeWidth={1.5} />
              )}
              <Text className="font-sansmed text-[13.5px] text-ink">{t('outfits.woreIt')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={confirmDelete}
              className="h-[46px] w-[46px] items-center justify-center rounded-[12px] border border-strong"
            >
              <TrashIcon size={17} color={colors.muted} />
            </Pressable>
          </View>

          <Text className="mt-7 font-serif text-[20px] text-ink">{t('outfitDetail.pieces')}</Text>
          <View className="mt-3 gap-3">
            {items.map((item) => (
              <PieceRow key={item.id} item={item} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
