import { ItemCategorySchema, type Item } from '@shared/types';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import * as WebBrowser from 'expo-web-browser';

import { AlertToggles } from '@/components/alert-toggles';
import { HangerIcon, LinkIcon, SparkleIcon } from '@/components/icons';
import { PriceSparkline } from '@/components/price-sparkline';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import {
  useCollections,
  useItemCollectionIds,
  useToggleItemInCollection,
} from '@/features/collections/hooks';
import {
  formatPrice,
  useMoveToWardrobe,
  useTrackedProduct,
} from '@/features/wishlist/hooks';
import {
  useDeleteItem,
  useItem,
  useSignedImageUrl,
  useUpdateItem,
} from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';

const CATEGORIES = ItemCategorySchema.options;

function splitTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`rounded-full px-4 py-2 ${selected ? 'bg-dark' : 'border border-field bg-bright'}`}
    >
      <Text
        className={
          selected ? 'font-sansmed text-[13px] text-bright' : 'font-sans text-[13px] text-soft'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ItemEditor({ item }: { item: Item }) {
  const { t } = useTranslation();
  const { data: imageUrl } = useSignedImageUrl(item.image_path);
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const moveToWardrobe = useMoveToWardrobe();
  const { data: trackedProduct } = useTrackedProduct(item.id, item.source === 'link');
  const { data: collections } = useCollections();
  const { data: memberIds } = useItemCollectionIds(item.id);
  const toggleCollection = useToggleItemInCollection(item.id);

  const [title, setTitle] = useState(item.title ?? '');
  const [brand, setBrand] = useState(item.brand ?? '');
  const [category, setCategory] = useState(item.category);
  const [subcategory, setSubcategory] = useState(item.subcategory ?? '');
  const [itemColors, setItemColors] = useState(item.colors.join(', '));
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
        colors: splitTags(itemColors),
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
      <View className="h-[380px] overflow-hidden rounded-[18px] bg-imagebg">
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={{ flex: 1 }} contentFit="contain" />
        ) : null}
      </View>

      {trackedProduct?.current_price != null ? (
        <Text className="font-sansbold text-[20px] text-ink">
          {formatPrice(trackedProduct.current_price, trackedProduct.currency)}
        </Text>
      ) : null}

      {item.ai_tagged ? (
        <View className="flex-row items-center gap-2">
          <SparkleIcon size={14} color={colors.muted} />
          <Text className="font-sans text-[12px] text-muted">{t('item.aiTagged')}</Text>
        </View>
      ) : null}

      {trackedProduct ? <AlertToggles trackedProductId={trackedProduct.id} /> : null}
      {trackedProduct ? <PriceSparkline trackedProductId={trackedProduct.id} /> : null}

      {item.status === 'wishlist' || trackedProduct ? (
        <View className="gap-2.5">
          {item.status === 'wishlist' ? (
            <Button
              variant="secondary"
              label={t('item.moveToWardrobe')}
              icon={<HangerIcon size={18} color={colors.ink} />}
              loading={moveToWardrobe.isPending}
              onPress={() => moveToWardrobe.mutate(item.id)}
            />
          ) : null}
          {trackedProduct ? (
            <Button
              variant="ghost"
              label={t('item.openLink')}
              icon={<LinkIcon size={16} color={colors.soft} />}
              onPress={() => WebBrowser.openBrowserAsync(trackedProduct.url)}
            />
          ) : null}
        </View>
      ) : null}

      <TextField label={t('addItem.itemTitle')} value={title} onChangeText={setTitle} />
      <TextField label={t('item.brand')} value={brand} onChangeText={setBrand} />

      <View className="gap-2">
        <Text className="text-[13px] font-sansmed text-label">{t('item.category')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {CATEGORIES.map((option) => (
            <Chip
              key={option}
              label={t(`item.categories.${option}`)}
              selected={category === option}
              onPress={() => setCategory(category === option ? null : option)}
            />
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
        value={itemColors}
        onChangeText={setItemColors}
      />
      <TextField
        label={t('item.styleTags')}
        placeholder={t('item.styleTagsPlaceholder')}
        value={styleTags}
        onChangeText={setStyleTags}
      />
      <TextField label={t('item.notes')} value={notes} onChangeText={setNotes} multiline />

      {userCollections.length > 0 ? (
        <View className="gap-2">
          <Text className="text-[13px] font-sansmed text-label">{t('collections.title')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {userCollections.map((collection) => {
              const member = (memberIds ?? []).includes(collection.id);
              return (
                <Chip
                  key={collection.id}
                  label={collection.name}
                  selected={member}
                  onPress={() => toggleCollection.mutate({ collectionId: collection.id, member })}
                />
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
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : (
        <ItemEditor item={item} />
      )}
    </Screen>
  );
}
