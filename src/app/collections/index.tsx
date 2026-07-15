import type { Collection } from '@shared/types';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkIcon, ChevronLeftIcon, HeartIcon, TrashIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
} from '@/features/collections/hooks';
import { colors } from '@/lib/theme';

function CollectionRow({ collection }: { collection: Collection }) {
  const { t } = useTranslation();
  const deleteCollection = useDeleteCollection();

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
      <Pressable className="flex-row items-center justify-between rounded-2xl border border-hairline bg-card px-5 py-4 active:bg-paper">
        <View className="flex-row items-center gap-3">
          {collection.is_system ? (
            <HeartIcon size={19} color={colors.body} strokeWidth={1.6} />
          ) : (
            <BookmarkIcon size={19} color={colors.body} />
          )}
          <Text className="font-sansmed text-[15px] text-ink">
            {collection.is_system ? t('tabs.wishlist') : collection.name}
          </Text>
        </View>
        {!collection.is_system ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={confirmDelete}>
            <TrashIcon size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </Pressable>
    </Link>
  );
}

export default function CollectionsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: collections } = useCollections();
  const createCollection = useCreateCollection();
  const [name, setName] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    await createCollection.mutateAsync(name.trim());
    setName('');
  };

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

      <View className="mt-5 gap-3">
        {(collections ?? []).map((collection) => (
          <CollectionRow key={collection.id} collection={collection} />
        ))}
      </View>

      <View className="mt-7 gap-3">
        <TextField
          label={t('collections.newLabel')}
          placeholder={t('collections.newPlaceholder')}
          value={name}
          onChangeText={setName}
        />
        <Button
          label={t('collections.create')}
          loading={createCollection.isPending}
          disabled={!name.trim()}
          onPress={create}
        />
      </View>
    </ScrollView>
  );
}
