import type { Item } from '@shared/types';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { HangerIcon } from '@/components/icons';
import { useSignedImageUrl } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';

/** One item tile inside an outfit preview strip (Discover, saved outfits, Home). */
export function OutfitThumb({ item, height = 118 }: { item: Item | undefined; height?: number }) {
  const { data: imageUrl } = useSignedImageUrl(item?.image_path ?? null);
  return (
    <View className="flex-1 items-center justify-center overflow-hidden rounded-lg" style={{ height }}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
      ) : (
        <View className="items-center gap-1.5 px-1">
          <HangerIcon size={22} color={colors.iconmuted} strokeWidth={1.4} />
          {item?.title ? (
            <Text numberOfLines={2} className="text-center font-sans text-[10px] text-muted">
              {item.title}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
