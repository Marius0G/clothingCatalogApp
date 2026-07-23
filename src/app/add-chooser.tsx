import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon, HangerIcon, HeartIcon } from '@/components/icons';
import { colors } from '@/lib/theme';

// Product photos cropped from the reference mockup (design/references/you-tab);
// their backgrounds match the card tints exactly, so they blend seamlessly.
const WISHLIST_PHOTO = require('../../assets/images/add-chooser/wishlist.png');
const WARDROBE_PHOTO = require('../../assets/images/add-chooser/wardrobe.png');

/**
 * "Add to…" chooser opened by the tab-bar +. Cards use router.replace so the
 * target flow swaps this modal instead of stacking a modal on a modal (iOS).
 */
export default function AddChooserScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-paper px-6"
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
    >
      <Text className="mt-10 text-center font-serif text-[30px] text-ink">
        {t('addChooser.title')}
      </Text>

      <View className="mt-12 h-[420px] flex-row gap-4">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/wishlist-import')}
          className="flex-1 overflow-hidden rounded-[22px] border border-roseline bg-rosetint active:opacity-90"
        >
          <View className="flex-1 items-center px-4 pt-11">
            <HeartIcon size={44} color={colors.roseink} strokeWidth={1.3} />
            <Text className="mt-7 font-sansbold text-[20px] text-ink">
              {t('addChooser.wishlistTitle')}
            </Text>
            <Text className="mt-2.5 text-center font-sans text-[13.5px] leading-[20px] text-soft">
              {t('addChooser.wishlistDesc')}
            </Text>
          </View>
          <Image
            source={WISHLIST_PHOTO}
            style={{ width: '100%', aspectRatio: 315 / 285, maxHeight: 210 }}
            contentFit="cover"
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/add-item')}
          className="flex-1 overflow-hidden rounded-[22px] border border-oliveline bg-olivetint active:opacity-90"
        >
          <View className="flex-1 items-center px-4 pt-11">
            <HangerIcon size={44} color={colors.oliveink} strokeWidth={1.3} />
            <Text className="mt-7 font-sansbold text-[20px] text-ink">
              {t('addChooser.wardrobeTitle')}
            </Text>
            <Text className="mt-2.5 text-center font-sans text-[13.5px] leading-[20px] text-soft">
              {t('addChooser.wardrobeDesc')}
            </Text>
          </View>
          <Image
            source={WARDROBE_PHOTO}
            style={{ width: '100%', aspectRatio: 311 / 307, maxHeight: 210 }}
            contentFit="cover"
          />
        </Pressable>
      </View>

      <View className="flex-1" />
      <View className="items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('addChooser.close')}
          onPress={() => router.back()}
          className="h-14 w-14 items-center justify-center rounded-full bg-bright active:opacity-80"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 5 },
            elevation: 5,
          }}
        >
          <CloseIcon size={22} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}
