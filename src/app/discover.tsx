import type { Item, Outfit } from '@shared/types';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChevronLeftIcon,
  HangerIcon,
  RegenerateIcon,
  SparkleIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from '@/components/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { NotEnoughItems, useOutfits, useRegenerateOutfits } from '@/features/recs/hooks';
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

function OutfitCard({ outfit, itemsById }: { outfit: Outfit; itemsById: Map<string, Item> }) {
  const { t } = useTranslation();
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const items = outfit.item_ids.map((id) => itemsById.get(id)).filter(Boolean) as Item[];

  return (
    <View className="overflow-hidden rounded-[18px] border border-hairline bg-card">
      <View className="flex-row items-end gap-2 bg-imagebg px-4 py-5">
        {items.slice(0, 4).map((item) => (
          <OutfitThumb key={item.id} item={item} />
        ))}
      </View>
      <View className="p-4">
        <Text className="font-serif text-[19px] text-ink">{outfit.occasion}</Text>
        <View className="mt-2.5 flex-row items-start gap-2">
          <View className="mt-0.5">
            <SparkleIcon size={16} color={colors.ink} />
          </View>
          <Text className="flex-1 font-sans text-[12.5px] leading-[19px] text-body">
            <Text className="font-sansbold text-ink">{t('discover.whyThis')} · </Text>
            {outfit.rationale}
          </Text>
        </View>
        <View className="mt-4 flex-row gap-2.5">
          <Pressable
            accessibilityRole="button"
            onPress={() => setVote(vote === 'up' ? null : 'up')}
            className={`h-[42px] w-[42px] items-center justify-center rounded-[11px] border ${
              vote === 'up' ? 'border-dark bg-dark' : 'border-strong'
            }`}
          >
            <ThumbsUpIcon size={18} color={vote === 'up' ? colors.bright : colors.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setVote(vote === 'down' ? null : 'down')}
            className={`h-[42px] w-[42px] items-center justify-center rounded-[11px] border ${
              vote === 'down' ? 'border-dark bg-dark' : 'border-strong'
            }`}
          >
            <ThumbsDownIcon size={18} color={vote === 'down' ? colors.bright : colors.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const outfitsQuery = useOutfits();
  const regenerate = useRegenerateOutfits();
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

  const notEnough = outfitsQuery.error instanceof NotEnoughItems;
  const outfits = outfitsQuery.data?.outfits ?? [];

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
        <Pressable
          accessibilityRole="button"
          disabled={regenerate.isPending || notEnough}
          onPress={() => regenerate.mutate()}
          className="flex-row items-center gap-1.5 rounded-full border border-strong px-3 py-2 active:bg-sand/40"
        >
          {regenerate.isPending ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <RegenerateIcon size={14} color={colors.ink} />
          )}
          <Text className="font-sansmed text-[12.5px] text-ink">{t('discover.regenerate')}</Text>
        </Pressable>
      </View>

      {notEnough ? (
        <EmptyState
          icon={<SparkleIcon size={38} color={colors.iconmuted} />}
          title={t('discover.emptyTitle')}
          body={t('discover.emptySub')}
        />
      ) : outfitsQuery.isPending || (regenerate.isPending && outfits.length === 0) ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color={colors.ink} />
          <Text className="font-sans text-[13px] text-soft">{t('discover.generating')}</Text>
        </View>
      ) : outfitsQuery.isError ? (
        <EmptyState
          icon={<SparkleIcon size={38} color={colors.iconmuted} />}
          title={t('common.error')}
          body={t('discover.generationError')}
        />
      ) : (
        <ScrollView
          className="mt-3.5 flex-1"
          contentContainerClassName="gap-4 px-6"
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        >
          {outfits.map((outfit, index) => (
            <OutfitCard key={index} outfit={outfit} itemsById={itemsById} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
