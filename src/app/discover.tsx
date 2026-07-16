import type { Item, Occasion, Outfit, Weather } from '@shared/types';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BookmarkIcon,
  ChevronLeftIcon,
  CloseIcon,
  HangerIcon,
  LocationIcon,
  RegenerateIcon,
  SparkleIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from '@/components/icons';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import {
  outfitItemsKey,
  useOutfitVotes,
  useSavedOutfits,
  useSaveOutfit,
  useSendOutfitFeedback,
  type OutfitVote,
} from '@/features/outfits/hooks';
import type { PurchaseSuggestion } from '@/features/recs/api';
import {
  NotEnoughItems,
  useOutfits,
  usePurchases,
  useRegenerateOutfits,
  type OutfitContext,
} from '@/features/recs/hooks';
import { formatPrice, useWishlist } from '@/features/wishlist/hooks';
import { useItems, useSignedImageUrl } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';
import {
  detectCurrentWeather,
  hasLocationPermission,
  requestLocationPermission,
} from '@/lib/weather';

const OCCASIONS: Occasion[] = ['everyday', 'office', 'evening', 'sport', 'event', 'travel'];
const WEATHERS: Weather[] = ['hot', 'mild', 'cool', 'cold'];

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

function OutfitCard({
  outfit,
  itemsById,
  requestedOccasion,
  vote,
  saved,
}: {
  outfit: Outfit;
  itemsById: Map<string, Item>;
  requestedOccasion: string | null;
  vote: OutfitVote | null;
  saved: boolean;
}) {
  const { t } = useTranslation();
  const sendFeedback = useSendOutfitFeedback();
  const saveOutfit = useSaveOutfit();
  const items = outfit.item_ids.map((id) => itemsById.get(id)).filter(Boolean) as Item[];

  const setVote = (next: OutfitVote | null) => {
    sendFeedback.mutate({ outfit, occasion: requestedOccasion, vote: next });
  };

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
        <View className="mt-4 flex-row items-center gap-2.5">
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
          <View className="flex-1" />
          <Pressable
            accessibilityRole="button"
            disabled={saved || saveOutfit.isPending}
            onPress={() => saveOutfit.mutate({ outfit, occasion: requestedOccasion })}
            className={`h-[42px] flex-row items-center justify-center gap-1.5 rounded-[11px] border px-3.5 ${
              saved ? 'border-dark bg-dark' : 'border-strong'
            }`}
          >
            {saveOutfit.isPending ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <BookmarkIcon size={16} color={saved ? colors.bright : colors.ink} />
            )}
            <Text
              className={`font-sansmed text-[12.5px] ${saved ? 'text-bright' : 'text-ink'}`}
            >
              {saved ? t('discover.savedOutfit') : t('discover.saveOutfit')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PurchaseCard({ suggestion }: { suggestion: PurchaseSuggestion }) {
  const { t } = useTranslation();
  const product = suggestion.product;
  if (!product) return null;
  const shopUrl = product.affiliate_url ?? product.url;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => WebBrowser.openBrowserAsync(shopUrl)}
      className="w-[150px]"
    >
      <View className="h-[170px] overflow-hidden rounded-[14px] border border-hairline bg-card">
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={{ flex: 1 }} contentFit="cover" />
        ) : null}
      </View>
      {product.brand ? (
        <Text className="mt-2 font-sans text-[12px] text-soft" numberOfLines={1}>
          {product.brand}
        </Text>
      ) : null}
      <Text className="mt-0.5 font-sansbold text-[13px] text-ink" numberOfLines={2}>
        {product.title}
      </Text>
      <View className="mt-1.5 flex-row items-center justify-between">
        {product.price != null ? (
          <Text className="font-sansbold text-[14px] text-ink">
            {formatPrice(product.price, product.currency)}
          </Text>
        ) : (
          <View />
        )}
        <Text className="font-sansbold text-[12px] text-accent">{t('discover.shop')}</Text>
      </View>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { anchor } = useLocalSearchParams<{ anchor?: string }>();
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherAuto, setWeatherAuto] = useState(false);
  const [detecting, setDetecting] = useState(false);
  // Set once the user picks weather manually — a slow auto-detect finishing
  // afterwards must not override their choice.
  const userChoseWeather = useRef(false);

  const runAutoWeather = async (silent: boolean) => {
    setDetecting(true);
    const detected = await detectCurrentWeather();
    setDetecting(false);
    if (!detected || (silent && userChoseWeather.current)) return;
    setWeather(detected);
    setWeatherAuto(true);
  };

  useEffect(() => {
    // Already granted (from a previous session) → prefill silently, no prompt.
    hasLocationPermission().then((granted) => {
      if (granted) runAutoWeather(true);
    });
  }, []);

  const onAutoWeatherPress = async () => {
    userChoseWeather.current = false;
    if (await hasLocationPermission()) {
      runAutoWeather(false);
      return;
    }
    // In-app explainer BEFORE the OS permission dialog: location is used only
    // for local weather, and it's optional.
    Alert.alert(t('discover.locationTitle'), t('discover.locationBody'), [
      { text: t('common.skip'), style: 'cancel' },
      {
        text: t('common.continue'),
        onPress: async () => {
          if (await requestLocationPermission()) runAutoWeather(false);
        },
      },
    ]);
  };

  const pickWeather = (option: Weather) => {
    userChoseWeather.current = true;
    setWeatherAuto(false);
    setWeather(weather === option ? null : option);
  };

  const context: OutfitContext = useMemo(
    () => ({ occasion, weather, anchorItemId: anchor || null }),
    [occasion, weather, anchor],
  );

  const outfitsQuery = useOutfits(context);
  const purchasesQuery = usePurchases();
  const regenerate = useRegenerateOutfits(context);
  const { data: wardrobeItems } = useItems('wardrobe');
  const { data: wishlistEntries } = useWishlist();
  const { data: votes } = useOutfitVotes();
  const { data: savedOutfits } = useSavedOutfits();

  const itemsById = useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of wardrobeItems ?? []) map.set(item.id, item);
    for (const entry of wishlistEntries ?? []) {
      const { tracked_product: _tp, ...item } = entry;
      map.set(item.id, item as Item);
    }
    return map;
  }, [wardrobeItems, wishlistEntries]);

  const savedKeys = useMemo(
    () => new Set((savedOutfits ?? []).map((o) => outfitItemsKey(o.item_ids))),
    [savedOutfits],
  );

  const anchorItem = anchor ? itemsById.get(anchor) : undefined;
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-[38px]"
        contentContainerClassName="items-center gap-2 px-6"
      >
        {OCCASIONS.map((option) => (
          <Chip
            key={option}
            label={t(`discover.occasions.${option}`)}
            selected={occasion === option}
            onPress={() => setOccasion(occasion === option ? null : option)}
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-2 max-h-[38px]"
        contentContainerClassName="items-center gap-2 px-6"
      >
        <Pressable
          accessibilityRole="button"
          onPress={onAutoWeatherPress}
          className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 ${
            weatherAuto ? 'bg-dark' : 'border border-field bg-bright'
          }`}
        >
          {detecting ? (
            <ActivityIndicator size="small" color={weatherAuto ? colors.bright : colors.soft} />
          ) : (
            <LocationIcon size={13} color={weatherAuto ? colors.bright : colors.soft} />
          )}
          <Text
            className={
              weatherAuto ? 'font-sansmed text-[13px] text-bright' : 'font-sans text-[13px] text-soft'
            }
          >
            {t('discover.weatherAuto')}
          </Text>
        </Pressable>
        {WEATHERS.map((option) => (
          <Chip
            key={option}
            label={t(`discover.weathers.${option}`)}
            selected={weather === option}
            onPress={() => pickWeather(option)}
          />
        ))}
      </ScrollView>

      {anchorItem ? (
        <View className="mt-3 flex-row items-center gap-2 px-6">
          <View className="flex-row items-center gap-2 rounded-full border border-strong bg-card px-3.5 py-2">
            <HangerIcon size={14} color={colors.ink} strokeWidth={1.5} />
            <Text className="font-sansmed text-[12.5px] text-ink" numberOfLines={1}>
              {t('discover.anchoredTo', { title: anchorItem.title ?? '' })}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.setParams({ anchor: undefined })}
            >
              <CloseIcon size={14} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View className="mt-3 flex-row items-center justify-between px-6">
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
          {outfits.map((outfit, index) => {
            const key = outfitItemsKey(outfit.item_ids);
            return (
              <OutfitCard
                key={`${key}-${index}`}
                outfit={outfit}
                itemsById={itemsById}
                requestedOccasion={occasion}
                vote={votes?.get(key) ?? null}
                saved={savedKeys.has(key)}
              />
            );
          })}

          {(purchasesQuery.data?.suggestions.length ?? 0) > 0 ? (
            <View className="mt-3">
              <Text className="font-serif text-[20px] text-ink">{t('discover.completes')}</Text>
              <Text className="mt-0.5 font-sans text-[12.5px] text-muted">
                {t('discover.completesSub')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3.5"
                contentContainerClassName="gap-3"
              >
                {purchasesQuery.data!.suggestions.map((suggestion) => (
                  <PurchaseCard key={suggestion.catalog_product_id} suggestion={suggestion} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
