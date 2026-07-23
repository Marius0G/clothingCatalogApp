import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChevronRightIcon } from '@/components/icons';
import { colors } from '@/lib/theme';

type NavCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  onPress: () => void;
};

/** Large hub card (You screen, Support): icon-in-circle, title, description, chevron. */
export function NavCard({ icon, title, description, onPress }: NavCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-2xl border border-hairline bg-card p-4 active:opacity-80"
    >
      <View className="h-12 w-12 items-center justify-center rounded-full bg-circle">{icon}</View>
      <View className="flex-1">
        <Text className="font-sansbold text-[15px] text-ink">{title}</Text>
        <Text className="mt-0.5 font-sans text-[12.5px] leading-[17px] text-soft" numberOfLines={2}>
          {description}
        </Text>
      </View>
      <ChevronRightIcon size={15} color={colors.muted} />
    </Pressable>
  );
}

type NavRowProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  onPress?: () => void;
  right?: ReactNode;
  disabled?: boolean;
};

/** Compact row inside a grouped settings card; `right` replaces the chevron. */
export function NavRow({ icon, title, description, onPress, right, disabled }: NavRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || !onPress}
      className={`flex-row items-center gap-3.5 px-4 py-3.5 ${disabled ? 'opacity-50' : 'active:opacity-70'}`}
    >
      <View className="w-6 items-center">{icon}</View>
      <View className="flex-1">
        <Text className="font-sansmed text-[14.5px] text-ink">{title}</Text>
        {description ? (
          <Text className="mt-0.5 font-sans text-[12px] leading-[16px] text-soft" numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <ChevronRightIcon size={14} color={colors.muted} /> : null)}
    </Pressable>
  );
}
