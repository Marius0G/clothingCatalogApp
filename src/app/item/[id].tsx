import { ItemCategorySchema, type Item } from '@shared/types';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import {
  useCollections,
  useItemCollectionIds,
  useToggleItemInCollection,
} from '@/features/collections/hooks';
import {
  useDeleteItem,
  useItem,
  useSignedImageUrl,
  useUpdateItem,
} from '@/features/wardrobe/hooks';

const CATEGORIES = ItemCategorySchema.options;

function splitTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function ItemEditor({ item }: { item: Item }) {
  const { t } = useTranslation();
  const { data: imageUrl } = useSignedImageUrl(item.image_path);
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const { data: collections } = useCollections();
  const { data: memberIds } = useItemCollectionIds(item.id);
  const toggleCollection = useToggleItemInCollection(item.id);

  const [title, setTitle] = useState(item.title ?? '');
  const [brand, setBrand] = useState(item.brand ?? '');
  const [category, setCategory] = useState(item.category);
  const [subcategory, setSubcategory] = useState(item.subcategory ?? '');
  const [colors, setColors] = useState(item.colors.join(', '));
  const [styleTags, setStyleTags] = useState(item.style_tags.join(', '));
  const [notes, setNotes] = useState(item.notes ?? '');

  const save = async () => {
    await updateItem.mutateAsync({
      id: item.id,
      update: {
        title: title.trim() || null,
        brand: brand.trim() || null,
        category,
        subcategory: subcategory.trim() || null,
        colors: splitTags(colors),
        style_tags: splitTags(styleTags),
        notes: notes.trim() || null,
      },
    });
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert(t('item.deleteTitle'), t('item.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('item.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          await deleteItem.mutateAsync(item);
          router.back();
        },
      },
    ]);
  };

  const userCollections = (collections ?? []).filter((c) => !c.is_system);

  return (
    <View className="gap-5 py-4">
      <View className="aspect-[3/4] overflow-hidden rounded-3xl bg-paper">
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={{ flex: 1 }} contentFit="contain" />
        ) : null}
      </View>

      {item.ai_tagged ? (
        <Text className="text-xs text-ink-faint">{t('item.aiTagged')}</Text>
      ) : null}

      <TextField label={t('addItem.itemTitle')} value={title} onChangeText={setTitle} />
      <TextField label={t('item.brand')} value={brand} onChangeText={setBrand} />

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-ink-soft">{t('item.category')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {CATEGORIES.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => setCategory(category === option ? null : option)}
              className={`h-10 items-center justify-center rounded-full border px-4 ${
                category === option ? 'border-ink bg-ink' : 'border-ink/15 bg-paper'
              }`}
            >
              <Text className={category === option ? 'font-medium text-paper' : 'text-ink-soft'}>
                {t(`item.categories.${option}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <TextField
        label={t('item.subcategory')}
        placeholder={t('item.subcategoryPlaceholder')}
        value={subcategory}
        onChangeText={setSubcategory}
      />
      <TextField
        label={t('item.colors')}
        placeholder={t('item.colorsPlaceholder')}
        value={colors}
        onChangeText={setColors}
      />
      <TextField
        label={t('item.styleTags')}
        placeholder={t('item.styleTagsPlaceholder')}
        value={styleTags}
        onChangeText={setStyleTags}
      />
      <TextField label={t('item.notes')} value={notes} onChangeText={setNotes} multiline />

      {userCollections.length > 0 ? (
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-ink-soft">{t('collections.title')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {userCollections.map((collection) => {
              const member = (memberIds ?? []).includes(collection.id);
              return (
                <Pressable
                  key={collection.id}
                  accessibilityRole="button"
                  onPress={() => toggleCollection.mutate({ collectionId: collection.id, member })}
                  className={`h-10 items-center justify-center rounded-full border px-4 ${
                    member ? 'border-ink bg-ink' : 'border-ink/15 bg-paper'
                  }`}
                >
                  <Text className={member ? 'font-medium text-paper' : 'text-ink-soft'}>
                    {collection.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View className="gap-3 pt-2">
        <Button label={t('common.save')} loading={updateItem.isPending} onPress={save} />
        <Button
          variant="danger"
          label={t('item.delete')}
          loading={deleteItem.isPending}
          onPress={confirmDelete}
        />
      </View>
    </View>
  );
}

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, isPending } = useItem(id);

  return (
    <Screen>
      {isPending || !item ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#1a1a1a" />
        </View>
      ) : (
        <ItemEditor item={item} />
      )}
    </Screen>
  );
}
