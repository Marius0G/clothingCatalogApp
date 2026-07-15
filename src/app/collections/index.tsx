import Ionicons from '@expo/vector-icons/Ionicons';
import type { Collection } from '@shared/types';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
} from '@/features/collections/hooks';

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
      <Pressable className="flex-row items-center justify-between rounded-2xl bg-paper px-5 py-4 active:bg-paper-sunken">
        <View className="flex-row items-center gap-3">
          <Ionicons
            name={collection.is_system ? 'heart-outline' : 'albums-outline'}
            size={20}
            color="#4a4a4a"
          />
          <Text className="text-base font-medium text-ink">
            {collection.is_system ? t('tabs.wishlist') : collection.name}
          </Text>
        </View>
        {!collection.is_system ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={18} color="#9a9a9a" />
          </Pressable>
        ) : null}
      </Pressable>
    </Link>
  );
}

export default function CollectionsScreen() {
  const { t } = useTranslation();
  const { data: collections } = useCollections();
  const createCollection = useCreateCollection();
  const [name, setName] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    await createCollection.mutateAsync(name.trim());
    setName('');
  };

  return (
    <Screen>
      <View className="gap-6 py-4">
        <Text className="text-2xl font-bold text-ink">{t('collections.title')}</Text>

        <View className="gap-3">
          {(collections ?? []).map((collection) => (
            <CollectionRow key={collection.id} collection={collection} />
          ))}
        </View>

        <View className="gap-3">
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
      </View>
    </Screen>
  );
}
