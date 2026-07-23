import type { Item } from '@shared/types';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useSignedImageUrl } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';

import { CheckIcon, HangerIcon } from './icons';

/** Design 1e: image-only wardrobe tile, 14px radius on card surface. */
export function ItemCard({
  item,
  onLongPress,
  justWorn,
}: {
  item: Item;
  /** Quick wear-log: hold a tile to mark it worn today (no navigation). */
  onLongPress?: () => void;
  justWorn?: boolean;
}) {
  const { t } = useTranslation();
  const { data: imageUrl } = useSignedImageUrl(item.image_path);

  return (
    <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
      <Pressable className="flex-1 p-1.5" onLongPress={onLongPress}>
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
          {justWorn ? (
            <View className="absolute bottom-2 left-0 right-0 items-center">
              <View className="flex-row items-center gap-1.5 rounded-full bg-dark px-3 py-1.5">
                <CheckIcon size={12} color={colors.bright} strokeWidth={2} />
                <Text className="font-sansmed text-[11px] text-bright">
                  {t('wardrobe.wornToday')}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
