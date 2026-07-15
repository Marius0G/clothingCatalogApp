import type { Item } from '@shared/types';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BellIcon, InfoIcon, LinkIcon, PlusIcon } from '@/components/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { useItems, useSignedImageUrl } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';

function BookmarkBig() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={colors.iconmuted} strokeWidth={1.4}>
      <Path d="M6 3h12v18l-6-4-6 4z" />
    </Svg>
  );
}

function WishlistCard({ item }: { item: Item }) {
  const { t } = useTranslation();
  const { data: imageUrl } = useSignedImageUrl(item.image_path);

  return (
    <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
      <Pressable className="flex-row gap-3.5 rounded-2xl border border-hairline bg-card p-3.5">
        <View className="h-[120px] w-24 overflow-hidden rounded-[10px] bg-imagebg">
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ flex: 1 }} contentFit="cover" />
          ) : null}
        </View>
        <View className="flex-1">
          <Text className="font-sansbold text-[15px] text-ink">
            {item.brand || item.title || t('wishlist.title')}
          </Text>
          {item.brand && item.title ? (
            <Text className="mt-0.5 font-sans text-[13px] text-soft">{item.title}</Text>
          ) : item.subcategory ? (
            <Text className="mt-0.5 font-sans text-[13px] text-soft">{item.subcategory}</Text>
          ) : null}
          <View className="mt-auto flex-row gap-2">
            <View className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[9px] border border-strong py-2">
              <BellIcon size={13} color={colors.ink} strokeWidth={1.7} />
              <Text className="font-sansmed text-[12px] text-ink">{t('wishlist.priceAlert')}</Text>
            </View>
            <View className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[9px] border border-strong py-2">
              <BellIcon size={13} color={colors.ink} strokeWidth={1.7} />
              <Text className="font-sansmed text-[12px] text-ink">
                {t('wishlist.restockAlert')}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export default function WishlistScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: items, isPending } = useItems('wishlist');
  const inputRef = useRef<TextInput>(null);
  const [link, setLink] = useState('');
  const [note, setNote] = useState(false);

  const empty = !isPending && items?.length === 0;

  const pasteBar = (
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
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => setNote(true)}
        className="h-8 w-8 items-center justify-center rounded-[9px] bg-dark"
      >
        <PlusIcon size={16} color={colors.bright} strokeWidth={2} />
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 18 }}>
      <View className="px-6">
        <Text className="font-serif text-[30px] text-ink">{t('wishlist.title')}</Text>
        {pasteBar}
        <View className="mt-2.5 flex-row items-center gap-2 px-0.5">
          <InfoIcon size={14} color={colors.muted} />
          <Text className="font-sans text-[12px] text-muted">
            {note ? t('wishlist.comingSoon') : t('wishlist.fetchNote')}
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
          {(items ?? []).map((item) => (
            <WishlistCard key={item.id} item={item} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
