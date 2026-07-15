import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const containerStyles: Record<Variant, string> = {
  primary: 'bg-ink active:bg-ink-soft',
  secondary: 'bg-paper-sunken active:bg-paper-warm border border-ink/10',
  ghost: 'bg-transparent active:bg-paper-sunken',
  danger: 'bg-transparent active:bg-danger/10',
};

const labelStyles: Record<Variant, string> = {
  primary: 'text-paper font-semibold',
  secondary: 'text-ink font-semibold',
  ghost: 'text-ink-soft',
  danger: 'text-danger font-semibold',
};

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

export function Button({ label, variant = 'primary', loading, disabled, ...props }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`h-14 flex-row items-center justify-center rounded-2xl px-6 ${containerStyles[variant]} ${disabled ? 'opacity-40' : ''}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#ffffff' : '#1a1a1a'} />
      ) : (
        <Text className={`text-base ${labelStyles[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
