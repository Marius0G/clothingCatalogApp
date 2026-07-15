import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/lib/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  rightIcon?: ReactNode;
  onPressRightIcon?: () => void;
};

export function TextField({ label, error, rightIcon, onPressRightIcon, multiline, ...props }: Props) {
  return (
    <View className="gap-2">
      {label ? <Text className="text-[13px] font-sansmed text-label">{label}</Text> : null}
      <View
        className={`flex-row items-center rounded-xl border bg-bright ${
          multiline ? '' : 'h-[52px]'
        } ${error ? 'border-sale' : 'border-field'}`}
      >
        <TextInput
          placeholderTextColor={colors.faint}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          className={`flex-1 px-4 font-sans text-[15px] text-ink ${
            multiline ? 'min-h-[100px] py-3.5' : 'h-full'
          }`}
          {...props}
        />
        {rightIcon ? (
          <Pressable accessibilityRole="button" hitSlop={8} className="pr-4" onPress={onPressRightIcon}>
            {rightIcon}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-[13px] font-sans text-sale">{error}</Text> : null}
    </View>
  );
}
