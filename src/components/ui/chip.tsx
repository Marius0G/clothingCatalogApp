import { Pressable, Text } from 'react-native';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`rounded-full px-4 py-2 ${selected ? 'bg-dark' : 'border border-field bg-bright'}`}
    >
      <Text
        className={
          selected ? 'font-sansmed text-[13px] text-bright' : 'font-sans text-[13px] text-soft'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
