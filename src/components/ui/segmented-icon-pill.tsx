import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';

import { colors } from '@/lib/theme';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

/** Design lang-seg track, icon-only segments (compact enough to share a row with chips). */
export function SegmentedIconPill<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; icon: ComponentType<IconProps>; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <View className="h-[38px] flex-row rounded-[10px] bg-seg p-1">
      {options.map(({ key, icon: Icon, label }) => {
        const selected = value === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => onChange(key)}
            className={`w-[44px] items-center justify-center rounded-[7px] ${selected ? 'bg-bright' : ''}`}
            style={
              selected
                ? {
                    shadowColor: '#000',
                    shadowOpacity: 0.14,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 2,
                  }
                : undefined
            }
          >
            <Icon size={17} color={selected ? colors.ink : colors.soft} strokeWidth={1.6} />
          </Pressable>
        );
      })}
    </View>
  );
}
