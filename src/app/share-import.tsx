import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { LinkIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ImportFailed } from '@/features/wishlist/api';
import { useImportFromLink } from '@/features/wishlist/hooks';
import { colors } from '@/lib/theme';

/** Landing screen for URLs shared into the app (share sheet → wishlist). */
export default function ShareImportScreen() {
  const { t } = useTranslation();
  const { url } = useLocalSearchParams<{ url: string }>();
  const importLink = useImportFromLink();
  const started = useRef(false);

  useEffect(() => {
    if (!url || started.current) return;
    started.current = true;
    importLink.mutate(url, {
      onSuccess: () => {
        router.dismissTo('/(tabs)/wishlist');
      },
    });
  }, [url, importLink]);

  const errorKey = (() => {
    if (!importLink.isError) return null;
    const reason = importLink.error instanceof ImportFailed ? importLink.error.reason : 'generic';
    return reason === 'invalid'
      ? 'wishlist.importInvalid'
      : reason === 'parse'
        ? 'wishlist.importParseError'
        : 'wishlist.importError';
  })();

  return (
    <View className="flex-1 items-center justify-center gap-5 bg-paper px-10">
      <View className="h-24 w-24 items-center justify-center rounded-full bg-circle">
        <LinkIcon size={38} color={colors.iconmuted} strokeWidth={1.4} />
      </View>
      {errorKey ? (
        <>
          <Text className="text-center font-serif text-[22px] text-ink">{t(errorKey)}</Text>
          <Text className="max-w-[280px] text-center font-sans text-[13px] text-soft" numberOfLines={2}>
            {url}
          </Text>
          <Button label={t('common.back')} onPress={() => router.dismissTo('/(tabs)/wishlist')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.ink} />
          <Text className="text-center font-serif text-[22px] text-ink">
            {t('wishlist.importing')}
          </Text>
          <Text className="max-w-[280px] text-center font-sans text-[13px] text-soft" numberOfLines={2}>
            {url}
          </Text>
        </>
      )}
    </View>
  );
}
