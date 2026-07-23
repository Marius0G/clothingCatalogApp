import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { ChevronRightIcon } from '@/components/icons';
import { colors } from '@/lib/theme';

/** Serif section title with an optional "View all" link or a custom right slot. */
export function SectionHeader({
  title,
  href,
  right,
  className = 'mt-8',
}: {
  title: string;
  href?: Href;
  right?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className={`flex-row items-center justify-between ${className}`}>
      <Text className="font-serif text-[22px] text-ink">{title}</Text>
      {right ??
        (href ? (
          <Link href={href} asChild>
            <Pressable className="flex-row items-center gap-1" hitSlop={8}>
              <Text className="font-sans text-[13px] text-soft">{t('common.viewAll')}</Text>
              <ChevronRightIcon size={15} color={colors.soft} />
            </Pressable>
          </Link>
        ) : null)}
    </View>
  );
}
