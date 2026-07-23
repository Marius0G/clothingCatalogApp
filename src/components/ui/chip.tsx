import { Pressable, Text } from 'react-native';

export function Chip({
  label,
  selected,
  onPress,
  tone = 'bright',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Unselected surface: 'bright' (inputs-like, default) or 'card' (wardrobe filter look). */
  tone?: 'bright' | 'card';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`rounded-full px-4 py-2 ${
        selected ? 'bg-dark' : tone === 'card' ? 'border border-field bg-card' : 'border border-field bg-bright'
      }`}
    >
      <Text
        className={
          selected
            ? 'font-sansmed text-[13px] text-bright'
            : `font-sans text-[13px] ${tone === 'card' ? 'text-ink' : 'text-soft'}`
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
