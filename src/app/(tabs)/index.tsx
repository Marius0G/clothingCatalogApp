import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronRightIcon, HangerIcon, HeartIcon, SparkleIcon } from '@/components/icons';
import { useProfile } from '@/features/profile/hooks';
import { useItems } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingDay';
  return 'home.greetingEvening';
}

function StatCard({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <View className="flex-1 flex-col items-center gap-2 rounded-[15px] border border-hairline bg-card px-1.5 py-3.5">
      {icon}
      <Text className="font-sansbold text-[20px] leading-none text-ink">{value}</Text>
      <Text className="font-sans text-[11px] text-soft">{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const { data: wardrobeItems } = useItems('wardrobe');
  const { data: wishlistItems } = useItems('wishlist');

  const name = profile?.nickname ? `, ${profile.nickname}` : '';

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 110 }}
      contentContainerClassName="px-6"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="font-serif text-[30px] leading-[36px] text-ink">
            {t(greetingKey(), { name })}
          </Text>
          <Text className="mt-1.5 font-sans text-[14px] text-soft">{t('home.greetingSub')}</Text>
        </View>
      </View>

      <View className="mt-6 flex-row gap-2.5">
        <StatCard
          icon={<HeartIcon size={19} color={colors.ink} strokeWidth={1.5} />}
          value={wishlistItems?.length ?? 0}
          label={t('home.statWishlist')}
        />
        <StatCard
          icon={<HangerIcon size={19} color={colors.ink} strokeWidth={1.5} />}
          value={wardrobeItems?.length ?? 0}
          label={t('home.statWardrobe')}
        />
        <StatCard
          icon={<SparkleIcon size={19} color={colors.ink} />}
          value={0}
          label={t('home.statOutfits')}
        />
        <StatCard
          icon={<SparkleIcon size={19} color={colors.ink} />}
          value={0}
          label={t('home.statAiLooks')}
        />
      </View>

      <View className="mt-8 flex-row items-center justify-between">
        <Text className="font-serif text-[22px] text-ink">{t('home.outfitInsp')}</Text>
        <Link href="/discover" asChild>
          <Pressable className="flex-row items-center gap-1" hitSlop={8}>
            <Text className="font-sans text-[13px] text-soft">{t('common.viewAll')}</Text>
            <ChevronRightIcon size={15} color={colors.soft} />
          </Pressable>
        </Link>
      </View>

      <Link href="/discover" asChild>
        <Pressable className="mt-3.5 items-center rounded-[18px] border border-hairline bg-card px-8 py-9 active:bg-paper">
          <SparkleIcon size={22} color={colors.iconmuted} />
          <Text className="mt-3 text-center font-serif text-[19px] text-ink">
            {t('home.emptyDiscTitle')}
          </Text>
          <Text className="mt-1.5 max-w-[250px] text-center font-sans text-[12.5px] leading-[19px] text-soft">
            {t('home.emptyDiscSub')}
          </Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}
