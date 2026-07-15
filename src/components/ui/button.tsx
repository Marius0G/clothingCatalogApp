import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { colors } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const containerStyles: Record<Variant, string> = {
  primary: 'bg-dark active:opacity-90',
  secondary: 'bg-bright border border-strong active:bg-paper',
  ghost: 'bg-transparent active:bg-sand/40',
  danger: 'bg-transparent active:bg-sale/10',
};

const labelStyles: Record<Variant, string> = {
  primary: 'text-bright font-sansbold',
  secondary: 'text-ink font-sansbold',
  ghost: 'text-soft font-sansmed',
  danger: 'text-sale font-sansbold',
};

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ label, variant = 'primary', loading, disabled, icon, ...props }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`h-[54px] flex-row items-center justify-center gap-2.5 rounded-[14px] px-6 ${containerStyles[variant]} ${disabled ? 'opacity-40' : ''}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.bright : colors.ink} />
      ) : (
        <>
          {icon}
          <Text className={`text-[15px] ${labelStyles[variant]}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
