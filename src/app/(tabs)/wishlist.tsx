import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertToggles } from '@/components/alert-toggles';
import { BookmarkIcon, LinkIcon } from '@/components/icons';
import { LinkImportField } from '@/components/link-import-field';
import { EmptyState } from '@/components/ui/empty-state';
import { type WishlistEntry } from '@/features/wishlist/api';
import { formatPrice, useWishlist } from '@/features/wishlist/hooks';
import { useSignedImageUrl } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';

function BookmarkBig() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={colors.iconmuted} strokeWidth={1.4}>
      <Path d="M6 3h12v18l-6-4-6 4z" />
    </Svg>
  );
}

function WishlistCard({ entry }: { entry: WishlistEntry }) {
  const { t } = useTranslation();
  const { data: imageUrl } = useSignedImageUrl(entry.image_path);
  const product = entry.tracked_product;

  return (
    <Link href={{ pathname: '/item/[id]', params: { id: entry.id } }} asChild>
      <Pressable className="flex-row gap-3.5 rounded-2xl border border-hairline bg-card p-3.5">
        <View className="h-[120px] w-24 overflow-hidden rounded-[10px] bg-imagebg">
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ flex: 1 }} contentFit="cover" />
          ) : null}
        </View>
        <View className="flex-1">
          <Text className="font-sansbold text-[15px] text-ink">
            {entry.brand || entry.title || t('wishlist.title')}
          </Text>
          {entry.brand && entry.title ? (
            <Text className="mt-0.5 font-sans text-[13px] text-soft" numberOfLines={1}>
              {entry.title}
            </Text>
          ) : entry.subcategory ? (
            <Text className="mt-0.5 font-sans text-[13px] text-soft">{entry.subcategory}</Text>
          ) : null}
          {product?.current_price != null ? (
            <Text className="mt-2 font-sansbold text-[18px] text-ink">
              {formatPrice(product.current_price, product.currency)}
            </Text>
          ) : null}
          {product ? (
            <View className="mt-auto pt-2">
              <AlertToggles trackedProductId={product.id} />
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

export default function WishlistScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: entries, isPending } = useWishlist();
  const inputRef = useRef<TextInput>(null);

  const empty = !isPending && entries?.length === 0;

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 18 }}>
      <View className="px-6">
        <View className="flex-row items-center justify-between">
          <Text className="font-serif text-[30px] text-ink">{t('wishlist.title')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('collections.title')}
            hitSlop={8}
            onPress={() => router.push('/collections')}
          >
            <BookmarkIcon size={22} color={colors.ink} />
          </Pressable>
        </View>
        <View className="mt-5">
          <LinkImportField inputRef={inputRef} />
        </View>
      </View>

      {empty ? (
        <EmptyState
          icon={<BookmarkBig />}
          title={t('wishlist.emptyTitle')}
          body={t('wishlist.emptySub')}
          ctaLabel={t('wishlist.emptyCta')}
          ctaIcon={<LinkIcon size={17} color={colors.bright} strokeWidth={1.8} />}
          onPressCta={() => inputRef.current?.focus()}
        />
      ) : (
        <ScrollView
          className="mt-5 flex-1"
          contentContainerClassName="gap-3.5 px-6"
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        >
          {(entries ?? []).map((entry) => (
            <WishlistCard key={entry.id} entry={entry} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
