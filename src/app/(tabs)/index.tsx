import type { CollectionSummary, Item } from '@shared/types';
import { Image } from 'expo-image';
import { Link, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckinCard } from '@/components/checkin-card';
import {
  BookmarkIcon,
  FolderIcon,
  HangerIcon,
  HeartIcon,
  SparkleIcon,
} from '@/components/icons';
import { OutfitThumb } from '@/components/outfit-thumb';
import { CarouselRow } from '@/components/ui/carousel-row';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { useCollectionSummaries } from '@/features/collections/hooks';
import type { SavedOutfitWithItems } from '@/features/outfits/api';
import { useCheckinCandidate } from '@/features/outfits/checkin';
import {
  useItemLookup,
  useRecordWear,
  useSavedOutfits,
  useSendOutfitFeedback,
} from '@/features/outfits/hooks';
import { useAuth } from '@/features/auth/provider';
import { useProfile } from '@/features/profile/hooks';
import { MIN_OUTFIT_ITEMS } from '@/features/recs/hooks';
import { OCCASIONS } from '@/features/recs/use-outfit-context';
import { useItems, useSignedImageUrl } from '@/features/wardrobe/hooks';
import type { WishlistEntry } from '@/features/wishlist/api';
import { formatPrice, useWishlist } from '@/features/wishlist/hooks';
import { colors } from '@/lib/theme';
import { useUiStore } from '@/lib/ui-store';

const OUTFITS_HREF: Href = { pathname: '/wardrobe', params: { view: 'outfits' } };
const CLOTHES_HREF: Href = { pathname: '/wardrobe', params: { view: 'clothes' } };

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingDay';
  return 'home.greetingEvening';
}

type HeroOutfit = {
  title: string;
  occasion: string | null;
  rationale: string | null;
  item_ids: string[];
  href: Href;
};

/** Design 1c hero card: latest outfit preview + optional wear check-in. */
function TodaysOutfitCard({
  hero,
  occasionLabel,
  itemsById,
  showCheckin,
  onYes,
  onNo,
  onThumbsDown,
  onExpire,
}: {
  hero: HeroOutfit;
  occasionLabel: string;
  itemsById: Map<string, Item>;
  showCheckin: boolean;
  onYes: () => void;
  onNo: () => void;
  onThumbsDown: () => void;
  onExpire: () => void;
}) {
  const items = hero.item_ids.map((id) => itemsById.get(id)).filter(Boolean) as Item[];

  return (
    <Link href={hero.href} asChild>
      <Pressable className="mt-3.5 overflow-hidden rounded-[18px] border border-hairline bg-card active:bg-paper">
        <View className="flex-row items-end gap-2 bg-imagebg px-4 py-4">
          {items.slice(0, 4).map((item) => (
            <OutfitThumb key={item.id} item={item} height={100} />
          ))}
        </View>
        <View className="p-4">
          <Text className="font-serif text-[19px] text-ink">{hero.title}</Text>
          <Text className="mt-0.5 font-sans text-[12px] text-muted">{occasionLabel}</Text>
          {hero.rationale ? (
            <Text
              numberOfLines={2}
              className="mt-2 font-sans text-[12.5px] leading-[19px] text-body"
            >
              {hero.rationale}
            </Text>
          ) : null}
          {showCheckin ? (
            <CheckinCard onYes={onYes} onNo={onNo} onThumbsDown={onThumbsDown} onExpire={onExpire} />
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

function OutfitMiniCard({
  outfit,
  itemsById,
}: {
  outfit: SavedOutfitWithItems;
  itemsById: Map<string, Item>;
}) {
  const items = outfit.item_ids.map((id) => itemsById.get(id)).filter(Boolean) as Item[];

  return (
    <Link href={{ pathname: '/outfit/[id]', params: { id: outfit.id } }} asChild>
      <Pressable className="w-[172px] overflow-hidden rounded-[14px] border border-hairline bg-card active:bg-paper">
        <View className="flex-row items-end gap-1 bg-imagebg px-2.5 py-2.5">
          {items.slice(0, 3).map((item) => (
            <OutfitThumb key={item.id} item={item} height={64} />
          ))}
        </View>
        <View className="px-3 py-2.5">
          <Text numberOfLines={1} className="font-serif text-[15px] text-ink">
            {outfit.title}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

function WishlistMiniCard({ entry, percent }: { entry: WishlistEntry; percent: number | null }) {
  const { data: imageUrl } = useSignedImageUrl(entry.image_path);
  const product = entry.tracked_product;

  return (
    <Link href={{ pathname: '/item/[id]', params: { id: entry.id } }} asChild>
      <Pressable className="w-[136px] active:opacity-90">
        <View className="h-[150px] overflow-hidden rounded-[14px] border border-hairline bg-card">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ flex: 1 }}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <HeartIcon size={24} color={colors.iconmuted} strokeWidth={1.4} />
            </View>
          )}
          {percent != null ? (
            <View className="absolute left-2 top-2 rounded-full bg-sale px-2 py-0.5">
              <Text className="font-sansbold text-[11px] text-bright">-{percent}%</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} className="mt-2 font-sansbold text-[13px] text-ink">
          {entry.brand || entry.title || ''}
        </Text>
        {product?.current_price != null ? (
          <Text className="mt-0.5 font-sans text-[12px] text-soft">
            {formatPrice(product.current_price, product.currency)}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

function ClothesMiniCard({ item }: { item: Item }) {
  const { data: imageUrl } = useSignedImageUrl(item.image_path);

  return (
    <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
      <Pressable className="h-[150px] w-[120px] overflow-hidden rounded-[14px] border border-hairline bg-card active:bg-paper">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ flex: 1 }}
            contentFit="contain"
            transition={150}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-2">
            <HangerIcon size={24} color={colors.iconmuted} strokeWidth={1.4} />
            {item.title ? (
              <Text
                numberOfLines={2}
                className="px-2 text-center font-sans text-[11px] leading-[15px] text-muted"
              >
                {item.title}
              </Text>
            ) : null}
          </View>
        )}
      </Pressable>
    </Link>
  );
}

function CollectionMiniCard({ collection }: { collection: CollectionSummary }) {
  const { t } = useTranslation();
  const { data: coverUrl } = useSignedImageUrl(collection.cover_image_path);

  return (
    <Link href={{ pathname: '/collections/[id]', params: { id: collection.id } }} asChild>
      <Pressable className="w-[150px] active:opacity-90">
        <View className="h-[110px] overflow-hidden rounded-[14px] border border-hairline bg-imagebg">
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={{ flex: 1 }} contentFit="cover" transition={150} />
          ) : (
            <View className="flex-1 items-center justify-center">
              <FolderIcon size={24} color={colors.iconmuted} strokeWidth={1.4} />
            </View>
          )}
        </View>
        <Text numberOfLines={1} className="mt-2 font-serif text-[15px] text-ink">
          {collection.name}
        </Text>
        <Text className="mt-0.5 font-sans text-[11.5px] text-muted">
          {t('collections.itemCount', { count: collection.item_count })}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const { data: wardrobeItems } = useItems('wardrobe');
  const { data: wishlistEntries } = useWishlist();
  const { data: savedOutfits } = useSavedOutfits();
  const { data: collectionSummaries } = useCollectionSummaries();

  const name = profile?.nickname ? `, ${profile.nickname}` : '';

  const { session } = useAuth();
  const itemsById = useItemLookup();
  const storedGenerated = useUiStore((state) => state.lastGenerated);
  const markPrompted = useUiStore((state) => state.markPrompted);
  // The persisted store is device-global; ignore another account's entry.
  const lastGenerated =
    storedGenerated && storedGenerated.userId === session?.user.id ? storedGenerated : null;

  // The check-in timer must only run while Home is actually visible — the tab
  // stays mounted when blurred/covered, and an off-screen expiry would consume
  // the one-shot prompt invisibly.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const checkin = useCheckinCandidate();
  const recordWear = useRecordWear();
  const sendFeedback = useSendOutfitFeedback();

  const answerYes = () => {
    if (!checkin) return;
    recordWear.mutate(checkin.item_ids);
    markPrompted(checkin.key);
  };
  const answerNo = () => {
    if (checkin) markPrompted(checkin.key);
  };
  const answerDislike = () => {
    if (!checkin) return;
    sendFeedback.mutate({
      // OutfitSchema requires non-empty occasion/rationale; runtime only uses item_ids.
      outfit: {
        item_ids: checkin.item_ids,
        occasion: checkin.occasion ?? checkin.title,
        rationale: checkin.rationale ?? checkin.title,
      },
      occasion: checkin.occasion,
      vote: 'down',
    });
    markPrompted(checkin.key);
  };
  const expire = () => {
    if (checkin) markPrompted(checkin.key);
  };

  // Hero: the newer of the latest saved outfit and the last generated one.
  const hero = useMemo<HeroOutfit | null>(() => {
    const saved = savedOutfits?.[0];
    const savedAt = saved ? new Date(saved.created_at).getTime() : 0;
    if (lastGenerated && lastGenerated.at > savedAt) {
      return {
        title: lastGenerated.outfit.occasion,
        occasion: lastGenerated.occasion,
        rationale: lastGenerated.outfit.rationale,
        item_ids: lastGenerated.outfit.item_ids,
        href: OUTFITS_HREF,
      };
    }
    if (saved) {
      return {
        title: saved.title,
        occasion: saved.occasion,
        rationale: saved.rationale,
        item_ids: saved.item_ids,
        href: { pathname: '/outfit/[id]', params: { id: saved.id } },
      };
    }
    return null;
  }, [savedOutfits, lastGenerated]);

  const occasionLabel = !hero?.occasion
    ? t('home.fromWardrobe')
    : (OCCASIONS as string[]).includes(hero.occasion)
      ? t(`discover.occasions.${hero.occasion}`)
      : hero.occasion;

  const salePercent = (entry: WishlistEntry): number | null => {
    const product = entry.tracked_product;
    if (
      !product ||
      product.current_price == null ||
      product.original_price == null ||
      product.current_price >= product.original_price
    ) {
      return null;
    }
    const percent = Math.round((1 - product.current_price / product.original_price) * 100);
    return percent >= 1 ? percent : null;
  };

  const collections = (collectionSummaries ?? []).filter((c) => !c.is_system);
  const enoughForOutfits = (wardrobeItems?.length ?? 0) >= MIN_OUTFIT_ITEMS;

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 110 }}
      contentContainerClassName="px-6"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="font-serif text-[30px] leading-[36px] text-ink">
            {t(greetingKey(), { name })}
          </Text>
          <Text className="mt-1.5 font-sans text-[14px] text-soft">{t('home.greetingSub')}</Text>
        </View>
      </View>

      <View className="mt-6 flex-row gap-2.5">
        <StatCard
          icon={<HeartIcon size={19} color={colors.ink} strokeWidth={1.5} />}
          value={wishlistEntries?.length ?? 0}
          label={t('home.statWishlist')}
          href="/wishlist"
        />
        <StatCard
          icon={<HangerIcon size={19} color={colors.ink} strokeWidth={1.5} />}
          value={wardrobeItems?.length ?? 0}
          label={t('home.statWardrobe')}
          href={CLOTHES_HREF}
        />
        <StatCard
          icon={<BookmarkIcon size={19} color={colors.ink} strokeWidth={1.5} />}
          value={savedOutfits?.length ?? 0}
          label={t('home.statOutfits')}
          href={OUTFITS_HREF}
        />
        <StatCard
          icon={<FolderIcon size={19} color={colors.ink} strokeWidth={1.5} />}
          value={collections.length}
          label={t('home.statCollections')}
          href="/collections"
        />
      </View>

      <SectionHeader title={t('home.todaysOutfit')} href={OUTFITS_HREF} />

      {hero ? (
        <TodaysOutfitCard
          hero={hero}
          occasionLabel={occasionLabel}
          itemsById={itemsById}
          showCheckin={checkin !== null && focused}
          onYes={answerYes}
          onNo={answerNo}
          onThumbsDown={answerDislike}
          onExpire={expire}
        />
      ) : (
        <Link href={enoughForOutfits ? OUTFITS_HREF : '/add-item'} asChild>
          <Pressable className="mt-3.5 items-center rounded-[18px] border border-hairline bg-card px-8 py-9 active:bg-paper">
            <SparkleIcon size={22} color={colors.iconmuted} />
            <Text className="mt-3 text-center font-serif text-[19px] text-ink">
              {t(enoughForOutfits ? 'home.inspReadyTitle' : 'home.emptyDiscTitle')}
            </Text>
            <Text className="mt-1.5 max-w-[250px] text-center font-sans text-[12.5px] leading-[19px] text-soft">
              {t(enoughForOutfits ? 'home.inspReadySub' : 'home.emptyDiscSub')}
            </Text>
          </Pressable>
        </Link>
      )}

      {(savedOutfits?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title={t('home.statOutfits')} href={OUTFITS_HREF} />
          <CarouselRow>
            {savedOutfits!.slice(0, 10).map((outfit) => (
              <OutfitMiniCard key={outfit.id} outfit={outfit} itemsById={itemsById} />
            ))}
          </CarouselRow>
        </>
      ) : null}

      {(wishlistEntries?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title={t('home.statWishlist')} href="/wishlist" />
          <CarouselRow>
            {wishlistEntries!.slice(0, 10).map((entry) => (
              <WishlistMiniCard key={entry.id} entry={entry} percent={salePercent(entry)} />
            ))}
          </CarouselRow>
        </>
      ) : null}

      {(wardrobeItems?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title={t('home.rowClothes')} href={CLOTHES_HREF} />
          <CarouselRow>
            {wardrobeItems!.slice(0, 10).map((item) => (
              <ClothesMiniCard key={item.id} item={item} />
            ))}
          </CarouselRow>
        </>
      ) : null}

      {collections.length > 0 ? (
        <>
          <SectionHeader title={t('home.statCollections')} href="/collections" />
          <CarouselRow>
            {collections.slice(0, 10).map((collection) => (
              <CollectionMiniCard key={collection.id} collection={collection} />
            ))}
          </CarouselRow>
        </>
      ) : null}
    </ScrollView>
  );
}
