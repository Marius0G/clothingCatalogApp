import type { Item } from '@shared/types';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useSignedImageUrl } from '@/features/wardrobe/hooks';

export function ItemCard({ item }: { item: Item }) {
  const { data: imageUrl } = useSignedImageUrl(item.image_path);

  return (
    <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
      <Pressable className="flex-1 gap-2 p-1.5">
        <View className="aspect-[3/4] overflow-hidden rounded-2xl bg-paper">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ flex: 1 }}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-3xl text-ink-faint">👕</Text>
            </View>
          )}
        </View>
        {item.title ? (
          <Text numberOfLines={1} className="px-1 text-sm font-medium text-ink">
            {item.title}
          </Text>
        ) : null}
        {item.brand || item.subcategory ? (
          <Text numberOfLines={1} className="px-1 text-xs text-ink-faint">
            {[item.brand, item.subcategory].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}
