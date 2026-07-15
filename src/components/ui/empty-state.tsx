import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button } from './button';

type Props = {
  icon?: ReactNode;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaIcon?: ReactNode;
  onPressCta?: () => void;
};

export function EmptyState({ icon, title, body, ctaLabel, ctaIcon, onPressCta }: Props) {
  return (
    <View className="flex-1 items-center justify-center px-10">
      {icon ? (
        <View className="h-24 w-24 items-center justify-center rounded-full bg-circle">
          {icon}
        </View>
      ) : null}
      <Text className="mt-6 text-center font-serif text-[22px] text-ink">{title}</Text>
      <Text className="mt-2.5 max-w-[250px] text-center font-sans text-[13.5px] leading-[21px] text-soft">
        {body}
      </Text>
      {ctaLabel && onPressCta ? (
        <View className="mt-6">
          <Button label={ctaLabel} icon={ctaIcon} onPress={onPressCta} />
        </View>
      ) : null}
    </View>
  );
}
