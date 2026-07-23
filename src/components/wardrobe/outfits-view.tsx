import type { Item, Outfit } from '@shared/types';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BookmarkIcon,
  CloseIcon,
  HangerIcon,
  RegenerateIcon,
  SparkleIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  TrashIcon,
} from '@/components/icons';
import { OutfitProgress } from '@/components/outfit-progress';
import { OutfitThumb } from '@/components/outfit-thumb';
import { Button } from '@/components/ui/button';
import { CarouselRow } from '@/components/ui/carousel-row';
import { SectionHeader } from '@/components/ui/section-header';
import type { SavedOutfitWithItems } from '@/features/outfits/api';
import {
  outfitItemsKey,
  useDeleteOutfit,
  useItemLookup,
  useOutfitVotes,
  useRecordWear,
  useSavedOutfits,
  useSaveOutfit,
  useSendOutfitFeedback,
  type OutfitVote,
} from '@/features/outfits/hooks';
import { useAuth } from '@/features/auth/provider';
import type { PurchaseSuggestion } from '@/features/recs/api';
import {
  MIN_OUTFIT_ITEMS,
  NotEnoughItems,
  useOutfits,
  usePurchases,
  useRegenerateOutfits,
} from '@/features/recs/hooks';
import type { OutfitContextState } from '@/features/recs/use-outfit-context';
import { useItems } from '@/features/wardrobe/hooks';
import { formatPrice } from '@/features/wishlist/hooks';
import { colors } from '@/lib/theme';
import { useUiStore } from '@/lib/ui-store';

/** Tab-bar clearance for the pinned progress bar (floating pill sits at ~86px). */
const PROGRESS_OFFSET = 86;

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
            <Text className={`font-sansmed text-[12.5px] ${saved ? 'text-bright' : 'text-ink'}`}>
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
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: outfit.id } })}
      className="overflow-hidden rounded-[18px] border border-hairline bg-card active:bg-paper"
    >
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
    </Pressable>
  );
}

/** Compact inline state card (start / not-enough / error) — the generation
 * states live inside the scroll flow here, unlike Discover's full-screen ones. */
function StateCard({
  icon,
  title,
  body,
  ctaLabel,
  ctaIcon,
  onPressCta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaIcon?: ReactNode;
  onPressCta?: () => void;
}) {
  return (
    <View className="mt-3.5 items-center rounded-[18px] border border-hairline bg-card px-8 py-8">
      {icon}
      <Text className="mt-3 text-center font-serif text-[19px] text-ink">{title}</Text>
      <Text className="mt-1.5 max-w-[250px] text-center font-sans text-[12.5px] leading-[19px] text-soft">
        {body}
      </Text>
      {ctaLabel && onPressCta ? (
        <View className="mt-5">
          <Button label={ctaLabel} icon={ctaIcon} onPress={onPressCta} />
        </View>
      ) : null}
    </View>
  );
}

/** Outfits mode of the wardrobe tab: generator (folded-in Discover), saved
 * outfits and shop suggestions in one scroll. Generation is on-demand only. */
export function OutfitsView({ outfitCtx }: { outfitCtx: OutfitContextState }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { context, occasion, anchorItemId, clearAnchor, setGenerationActive } = outfitCtx;

  const outfitsQuery = useOutfits(context);
  const regenerate = useRegenerateOutfits(context);
  const { data: votes } = useOutfitVotes();
  const { data: savedOutfits, isPending: savedPending } = useSavedOutfits();
  const { data: wardrobeItems } = useItems('wardrobe');
  const itemsById = useItemLookup();
  const lastGenerated = useUiStore((state) => state.lastGenerated);
  const setLastGenerated = useUiStore((state) => state.setLastGenerated);

  const savedKeys = useMemo(
    () => new Set((savedOutfits ?? []).map((o) => outfitItemsKey(o.item_ids))),
    [savedOutfits],
  );

  const anchorItem = anchorItemId ? itemsById.get(anchorItemId) : undefined;
  const notEnough = outfitsQuery.error instanceof NotEnoughItems;
  const outfits = outfitsQuery.data?.outfits ?? [];
  const hasData = outfitsQuery.data !== undefined;
  const composing = outfitsQuery.isFetching || (regenerate.isPending && outfits.length === 0);

  // Purchase suggestions are an AI call too — fetch them only once outfits exist.
  const purchasesQuery = usePurchases(hasData);

  const generate = outfitsQuery.refetch;

  // While a generation is in flight (or results exist), the silent weather
  // prefill must NOT switch the query key — it would orphan the AI result.
  useEffect(() => {
    setGenerationActive(
      outfitsQuery.isFetching || regenerate.isPending || outfitsQuery.data !== undefined,
    );
  }, [outfitsQuery.isFetching, regenerate.isPending, outfitsQuery.data, setGenerationActive]);

  // Arriving anchored ("style this item") is an explicit request — generate
  // right away, but only once per anchor: without the ref guard this would
  // re-fire on every remount after an error or cache eviction.
  const firedAnchorRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      anchorItemId &&
      outfitsQuery.data === undefined &&
      !outfitsQuery.isError &&
      firedAnchorRef.current !== anchorItemId
    ) {
      firedAnchorRef.current = anchorItemId;
      generate();
    }
  }, [anchorItemId, outfitsQuery.data, outfitsQuery.isError, generate]);

  // The home hero survives restarts through the persisted store; the query
  // cache is memory-only. dataUpdatedAt guards against rewriting on remounts.
  useEffect(() => {
    const first = outfitsQuery.data?.outfits?.[0];
    const userId = session?.user.id;
    if (!first || !outfitsQuery.dataUpdatedAt || !userId) return;
    if (lastGenerated && lastGenerated.at >= outfitsQuery.dataUpdatedAt) return;
    setLastGenerated({ outfit: first, occasion, at: outfitsQuery.dataUpdatedAt, userId });
  }, [
    outfitsQuery.data,
    outfitsQuery.dataUpdatedAt,
    lastGenerated,
    occasion,
    setLastGenerated,
    session?.user.id,
  ]);

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {anchorItem ? (
          <View className="mt-3 flex-row items-center gap-2">
            <View className="flex-row items-center gap-2 rounded-full border border-strong bg-card px-3.5 py-2">
              <HangerIcon size={14} color={colors.ink} strokeWidth={1.5} />
              <Text className="font-sansmed text-[12.5px] text-ink" numberOfLines={1}>
                {t('discover.anchoredTo', { title: anchorItem.title ?? '' })}
              </Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={clearAnchor}>
                <CloseIcon size={14} color={colors.muted} />
              </Pressable>
            </View>
          </View>
        ) : null}

        <SectionHeader
          className="mt-4"
          title={t('discover.forYou')}
          right={
            hasData ? (
              <Pressable
                accessibilityRole="button"
                disabled={regenerate.isPending}
                onPress={() => regenerate.mutate()}
                className="flex-row items-center gap-1.5 rounded-full border border-strong px-3 py-2 active:bg-sand/40"
              >
                {regenerate.isPending ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <RegenerateIcon size={14} color={colors.ink} />
                )}
                <Text className="font-sansmed text-[12.5px] text-ink">
                  {t('discover.regenerate')}
                </Text>
              </Pressable>
            ) : undefined
          }
        />

        {notEnough && (wardrobeItems?.length ?? 0) >= MIN_OUTFIT_ITEMS ? (
          // Enough items were added since the 422 — offer the retry the cached
          // error would otherwise permanently hide.
          <StateCard
            icon={<SparkleIcon size={30} color={colors.iconmuted} />}
            title={t('discover.startTitle')}
            body={t('discover.startSub')}
            ctaLabel={t('discover.generate')}
            ctaIcon={<SparkleIcon size={17} color={colors.bright} />}
            onPressCta={() => generate()}
          />
        ) : notEnough ? (
          <StateCard
            icon={<SparkleIcon size={30} color={colors.iconmuted} />}
            title={t('discover.emptyTitle')}
            body={t('discover.emptySub')}
            ctaLabel={t('addItem.title')}
            ctaIcon={<HangerIcon size={17} color={colors.bright} strokeWidth={1.5} />}
            onPressCta={() => router.push('/add-item')}
          />
        ) : composing ? (
          <View className="mt-3.5 items-center rounded-[18px] border border-hairline bg-card px-8 py-10">
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : outfitsQuery.isError ? (
          <StateCard
            icon={<SparkleIcon size={30} color={colors.iconmuted} />}
            title={t('common.error')}
            body={t('discover.generationError')}
            ctaLabel={t('discover.generate')}
            ctaIcon={<SparkleIcon size={17} color={colors.bright} />}
            onPressCta={() => generate()}
          />
        ) : !hasData ? (
          <StateCard
            icon={<SparkleIcon size={30} color={colors.iconmuted} />}
            title={t('discover.startTitle')}
            body={t('discover.startSub')}
            ctaLabel={t('discover.generate')}
            ctaIcon={<SparkleIcon size={17} color={colors.bright} />}
            onPressCta={() => generate()}
          />
        ) : (
          <View className="mt-3.5 gap-4">
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
          </View>
        )}

        <SectionHeader title={t('outfits.title')} />
        {savedPending ? (
          <View className="mt-3.5 items-center py-6">
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : (savedOutfits?.length ?? 0) === 0 ? (
          <StateCard
            icon={<BookmarkIcon size={26} color={colors.iconmuted} />}
            title={t('outfits.emptyTitle')}
            body={t('outfits.emptySub')}
          />
        ) : (
          <View className="mt-3.5 gap-4">
            {savedOutfits!.map((outfit) => (
              <SavedOutfitCard key={outfit.id} outfit={outfit} itemsById={itemsById} />
            ))}
          </View>
        )}

        {(purchasesQuery.data?.suggestions.length ?? 0) > 0 ? (
          <View className="mt-8">
            <Text className="font-serif text-[20px] text-ink">{t('discover.completes')}</Text>
            <Text className="mt-0.5 font-sans text-[12.5px] text-muted">
              {t('discover.completesSub')}
            </Text>
            <CarouselRow>
              {purchasesQuery.data!.suggestions.map((suggestion) => (
                <PurchaseCard key={suggestion.catalog_product_id} suggestion={suggestion} />
              ))}
            </CarouselRow>
          </View>
        ) : null}
      </ScrollView>

      <OutfitProgress
        visible={outfitsQuery.isFetching || regenerate.isPending}
        label={t('discover.composing')}
        offset={PROGRESS_OFFSET}
      />
    </View>
  );
}
