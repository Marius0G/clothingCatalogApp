import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon } from '@/components/icons';
import { LinkImportField } from '@/components/link-import-field';
import { colors } from '@/lib/theme';

/** Add-to-wishlist via product link (the Add-chooser's Wishlist path). */
export default function WishlistImportScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-paper px-6"
      style={{ paddingTop: insets.top + 16 }}
    >
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/wishlist'))}
        className="mb-3.5"
      >
        <ChevronLeftIcon size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-serif text-[29px] text-ink">{t('wishlistImport.title')}</Text>
      <Text className="mt-2 font-sans text-[13.5px] leading-[20px] text-soft">
        {t('wishlistImport.subtitle')}
      </Text>
      <View className="mt-6">
        <LinkImportField autoFocus onSuccess={() => router.replace('/(tabs)/wishlist')} />
      </View>
    </View>
  );
}
