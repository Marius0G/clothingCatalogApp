import type { Item } from '@shared/types';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useSignedImageUrl } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';

import { HangerIcon } from './icons';

/** Design 1e: image-only wardrobe tile, 14px radius on card surface. */
export function ItemCard({ item }: { item: Item }) {
  const { data: imageUrl } = useSignedImageUrl(item.image_path);

  return (
    <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
      <Pressable className="flex-1 p-1.5">
        <View className="h-[180px] overflow-hidden rounded-[14px] border border-hairline bg-card">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ flex: 1 }}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <View className="flex-1 items-center justify-center gap-2">
              <HangerIcon size={28} color={colors.iconmuted} strokeWidth={1.4} />
              {item.title ? (
                <Text numberOfLines={1} className="px-3 font-sans text-[12px] text-muted">
                  {item.title}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </Pressable>
    </Link>
  );
}
