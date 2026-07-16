import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertToggles } from '@/components/alert-toggles';
import { InfoIcon, LinkIcon, PlusIcon } from '@/components/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { ImportFailed, type WishlistEntry } from '@/features/wishlist/api';
import { formatPrice, useImportFromLink, useWishlist } from '@/features/wishlist/hooks';
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
  const importLink = useImportFromLink();
  const inputRef = useRef<TextInput>(null);
  const [link, setLink] = useState('');

  const submit = () => {
    if (!link.trim() || importLink.isPending) return;
    importLink.mutate(link.trim(), {
      onSuccess: () => setLink(''),
    });
  };

  const noteText = (() => {
    if (importLink.isPending) return t('wishlist.importing');
    if (importLink.isError) {
      const reason = importLink.error instanceof ImportFailed ? importLink.error.reason : 'generic';
      return t(
        reason === 'invalid'
          ? 'wishlist.importInvalid'
          : reason === 'parse'
            ? 'wishlist.importParseError'
            : 'wishlist.importError',
      );
    }
    return t('wishlist.fetchNote');
  })();

  const empty = !isPending && entries?.length === 0;

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 18 }}>
      <View className="px-6">
        <Text className="font-serif text-[30px] text-ink">{t('wishlist.title')}</Text>
        <View className="mt-5 flex-row items-center gap-3 rounded-[14px] border bg-card px-4 py-3">
          <LinkIcon size={18} color={colors.muted} />
          <TextInput
            ref={inputRef}
            className="flex-1 font-sans text-[14px] text-ink"
            placeholder={t('wishlist.pastePh')}
            placeholderTextColor={colors.faint}
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={submit}
            editable={!importLink.isPending}
          />
          <Pressable
            accessibilityRole="button"
            onPress={submit}
            disabled={importLink.isPending}
            className="h-8 w-8 items-center justify-center rounded-[9px] bg-dark"
          >
            {importLink.isPending ? (
              <ActivityIndicator size="small" color={colors.bright} />
            ) : (
              <PlusIcon size={16} color={colors.bright} strokeWidth={2} />
            )}
          </Pressable>
        </View>
        <View className="mt-2.5 flex-row items-center gap-2 px-0.5">
          <InfoIcon size={14} color={importLink.isError ? colors.sale : colors.muted} />
          <Text
            className={`flex-1 font-sans text-[12px] ${importLink.isError ? 'text-sale' : 'text-muted'}`}
          >
            {noteText}
          </Text>
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
