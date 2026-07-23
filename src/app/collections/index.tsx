import type { CollectionSummary } from '@shared/types';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon, ChevronRightIcon, FolderIcon, PlusIcon, TrashIcon } from '@/components/icons';
import {
  useCollectionSummaries,
  useCreateCollection,
  useDeleteCollection,
} from '@/features/collections/hooks';
import { useSignedImageUrl } from '@/features/wardrobe/hooks';
import { CANONICAL_COLOR_HEX, canonicalColorDots } from '@/lib/canonical-colors';
import { colors } from '@/lib/theme';

function CollectionCard({ collection }: { collection: CollectionSummary }) {
  const { t } = useTranslation();
  const deleteCollection = useDeleteCollection();
  const { data: coverUrl } = useSignedImageUrl(collection.cover_image_path);
  const dots = canonicalColorDots(collection.item_colors);

  const confirmDelete = () => {
    Alert.alert(t('collections.deleteTitle', { name: collection.name }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('item.deleteConfirm'),
        style: 'destructive',
        onPress: () => deleteCollection.mutate(collection.id),
      },
    ]);
  };

  return (
    <Link href={{ pathname: '/collections/[id]', params: { id: collection.id } }} asChild>
      <Pressable className="flex-row items-center gap-4 rounded-2xl border border-hairline bg-card p-3.5 active:bg-paper">
        <View className="h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[12px] bg-imagebg">
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={{ flex: 1, alignSelf: 'stretch' }} contentFit="cover" />
          ) : (
            <FolderIcon size={22} color={colors.iconmuted} />
          )}
        </View>
        <View className="flex-1">
          <Text className="font-sansbold text-[15.5px] text-ink">{collection.name}</Text>
          <Text className="mt-0.5 font-sans text-[12.5px] text-soft">
            {t('collections.itemCount', { count: collection.item_count })}
          </Text>
          {dots.length ? (
            <View className="mt-2 flex-row gap-1.5">
              {dots.map((color) => (
                <View
                  key={color}
                  className="h-[13px] w-[13px] rounded-full border border-hairline"
                  style={{ backgroundColor: CANONICAL_COLOR_HEX[color] }}
                />
              ))}
            </View>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={confirmDelete}>
          <TrashIcon size={18} color={colors.muted} />
        </Pressable>
        <ChevronRightIcon size={15} color={colors.muted} />
      </Pressable>
    </Link>
  );
}

function NewCollectionCard() {
  const { t } = useTranslation();
  const createCollection = useCreateCollection();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    await createCollection.mutateAsync(name.trim());
    setName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-4 rounded-2xl border border-dashed border-strong p-3.5 active:bg-card"
      >
        <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-circle">
          <PlusIcon size={20} color={colors.ink} />
        </View>
        <View className="flex-1">
          <Text className="font-sansbold text-[15px] text-ink">{t('collections.newCard')}</Text>
          <Text className="mt-0.5 font-sans text-[12.5px] leading-[17px] text-soft">
            {t('collections.newCardDesc')}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View className="rounded-2xl border border-dashed border-strong p-3.5">
      <View className="flex-row items-center gap-3">
        <TextInput
          autoFocus
          className="h-[44px] flex-1 rounded-xl border border-field bg-bright px-4 font-sans text-[14px] text-ink"
          placeholder={t('collections.newPlaceholder')}
          placeholderTextColor={colors.faint}
          value={name}
          onChangeText={setName}
          onSubmitEditing={create}
        />
        <Pressable
          accessibilityRole="button"
          onPress={create}
          disabled={!name.trim() || createCollection.isPending}
          className={`h-[44px] w-[44px] items-center justify-center rounded-xl bg-dark ${
            !name.trim() ? 'opacity-40' : ''
          }`}
        >
          <PlusIcon size={18} color={colors.bright} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

export default function CollectionsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: collections } = useCollectionSummaries();

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
      contentContainerClassName="px-6"
      keyboardShouldPersistTaps="handled"
    >
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
        <ChevronLeftIcon size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-serif text-[29px] text-ink">{t('collections.title')}</Text>
      <Text className="mt-2 font-sans text-[13.5px] leading-[20px] text-soft">
        {t('collections.subtitle')}
      </Text>

      <View className="mt-5 gap-3">
        {(collections ?? [])
          .filter((collection) => !collection.is_system)
          .map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        <NewCollectionCard />
      </View>
    </ScrollView>
  );
}
