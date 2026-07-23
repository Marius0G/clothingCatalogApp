import type { NotificationPrefs } from '@shared/types';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon } from '@/components/icons';
import { useProfile, useUpdateProfile } from '@/features/profile/hooks';
import { colors } from '@/lib/theme';

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      className={`h-[28px] w-[48px] justify-center rounded-full p-[3px] ${
        on ? 'bg-dark' : 'bg-seg'
      }`}
    >
      <View className={`h-[22px] w-[22px] rounded-full bg-bright ${on ? 'self-end' : ''}`} />
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const prefs = profile?.notification_prefs ?? {};

  // Absent key = enabled (opt-out model, mirrored by push-dispatch).
  const setPref = (kind: keyof NotificationPrefs, on: boolean) =>
    updateProfile.mutate({ notification_prefs: { ...prefs, [kind]: on } });

  return (
    <View className="flex-1 bg-paper px-6" style={{ paddingTop: insets.top + 16 }}>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
        <ChevronLeftIcon size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-serif text-[29px] text-ink">{t('settings.notifications')}</Text>

      <View className="mt-6 overflow-hidden rounded-2xl border border-hairline bg-card">
        <View className="flex-row items-center gap-3.5 px-4 py-4">
          <View className="flex-1">
            <Text className="font-sansmed text-[14.5px] text-ink">
              {t('notifications.priceDrop')}
            </Text>
            <Text className="mt-0.5 font-sans text-[12px] leading-[16px] text-soft">
              {t('notifications.priceDropDesc')}
            </Text>
          </View>
          <Toggle
            on={prefs.price_drop !== false}
            onPress={() => setPref('price_drop', prefs.price_drop === false)}
          />
        </View>
        <View className="flex-row items-center gap-3.5 border-t border-hairline px-4 py-4">
          <View className="flex-1">
            <Text className="font-sansmed text-[14.5px] text-ink">
              {t('notifications.restock')}
            </Text>
            <Text className="mt-0.5 font-sans text-[12px] leading-[16px] text-soft">
              {t('notifications.restockDesc')}
            </Text>
          </View>
          <Toggle
            on={prefs.restock !== false}
            onPress={() => setPref('restock', prefs.restock === false)}
          />
        </View>
      </View>
    </View>
  );
}
