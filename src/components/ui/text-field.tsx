import { Text, TextInput, View, type TextInputProps } from 'react-native';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
};

export function TextField({ label, error, ...props }: Props) {
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-sm font-medium text-ink-soft">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#9a9a9a"
        className={`h-14 rounded-2xl border bg-paper px-4 text-base text-ink ${
          error ? 'border-danger' : 'border-ink/15 focus:border-ink'
        }`}
        {...props}
      />
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
