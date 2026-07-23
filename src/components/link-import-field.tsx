import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { InfoIcon, LinkIcon, PlusIcon } from '@/components/icons';
import { ImportFailed } from '@/features/wishlist/api';
import { useImportFromLink } from '@/features/wishlist/hooks';
import { colors } from '@/lib/theme';

type Props = {
  inputRef?: RefObject<TextInput | null>;
  autoFocus?: boolean;
  onSuccess?: () => void;
};

/** Paste-a-product-link input + import status note (wishlist tab + import screen). */
export function LinkImportField({ inputRef, autoFocus, onSuccess }: Props) {
  const { t } = useTranslation();
  const importLink = useImportFromLink();
  const [link, setLink] = useState('');

  const submit = () => {
    if (!link.trim() || importLink.isPending) return;
    importLink.mutate(link.trim(), {
      onSuccess: () => {
        setLink('');
        onSuccess?.();
      },
    });
  };

  const noteText = (() => {
    if (importLink.isPending) return t('wishlist.importing');
    if (importLink.isError) {
      const reason = importLink.error instanceof ImportFailed ? importLink.error.reason : 'generic';
      return t(
        reason === 'invalid'
          ? 'wishlist.importInvalid'
          : reason === 'parse'
            ? 'wishlist.importParseError'
            : 'wishlist.importError',
      );
    }
    return t('wishlist.fetchNote');
  })();

  return (
    <View>
      <View className="flex-row items-center gap-3 rounded-[14px] border bg-card px-4 py-3">
        <LinkIcon size={18} color={colors.muted} />
        <TextInput
          ref={inputRef}
          className="flex-1 font-sans text-[14px] text-ink"
          placeholder={t('wishlist.pastePh')}
          placeholderTextColor={colors.faint}
          value={link}
          onChangeText={setLink}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={submit}
          editable={!importLink.isPending}
        />
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={importLink.isPending}
          className="h-8 w-8 items-center justify-center rounded-[9px] bg-dark"
        >
          {importLink.isPending ? (
            <ActivityIndicator size="small" color={colors.bright} />
          ) : (
            <PlusIcon size={16} color={colors.bright} strokeWidth={2} />
          )}
        </Pressable>
      </View>
      <View className="mt-2.5 flex-row items-center gap-2 px-0.5">
        <InfoIcon size={14} color={importLink.isError ? colors.sale : colors.muted} />
        <Text
          className={`flex-1 font-sans text-[12px] ${importLink.isError ? 'text-sale' : 'text-muted'}`}
        >
          {noteText}
        </Text>
      </View>
    </View>
  );
}
