import type { Alert } from '@shared/types';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import { View } from 'react-native';

import { BellIcon } from '@/components/icons';
import { useAlerts, useToggleAlert } from '@/features/alerts/hooks';
import { colors } from '@/lib/theme';

/** The price/restock alert pill pair from design 1d, now stateful. */
export function AlertToggles({ trackedProductId }: { trackedProductId: string }) {
  const { t } = useTranslation();
  const { data: alerts } = useAlerts(trackedProductId);
  const toggle = useToggleAlert(trackedProductId);

  const renderButton = (kind: Alert['kind'], label: string) => {
    const existing = alerts?.find((a) => a.kind === kind);
    const active = !!existing;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        disabled={toggle.isPending}
        onPress={() => toggle.mutate({ kind, existing })}
        className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-[9px] py-2 ${
          active ? 'bg-dark' : 'border border-strong'
        }`}
      >
        <BellIcon size={13} color={active ? colors.bright : colors.ink} strokeWidth={1.7} />
        <Text className={`font-sansmed text-[12px] ${active ? 'text-bright' : 'text-ink'}`}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="flex-row gap-2">
      {renderButton('price_drop', t('wishlist.priceAlert'))}
      {renderButton('restock', t('wishlist.restockAlert'))}
    </View>
  );
}
