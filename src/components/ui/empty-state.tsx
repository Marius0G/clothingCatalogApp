import { Text, View } from 'react-native';

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-10">
      <Text className="text-center text-xl font-semibold text-ink">{title}</Text>
      <Text className="text-center text-base leading-6 text-ink-faint">{body}</Text>
    </View>
  );
}
