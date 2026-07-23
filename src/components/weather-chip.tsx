import type { Weather } from '@shared/types';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { LocationIcon } from '@/components/icons';
import { colors } from '@/lib/theme';

/**
 * Single smart weather chip: shows the current (auto-detected or manual)
 * weather; tap cycles hot→mild→cool→cold, long-press re-detects via GPS.
 */
export function WeatherChip({
  value,
  auto,
  detecting,
  onCycle,
  onRedetect,
}: {
  value: Weather | null;
  auto: boolean;
  detecting: boolean;
  onCycle: () => void;
  onRedetect: () => void;
}) {
  const { t } = useTranslation();
  const active = value !== null;
  const label = active ? t(`discover.weathers.${value}`) : t('discover.weatherUnknown');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('discover.weatherHint')}
      onPress={onCycle}
      onLongPress={onRedetect}
      delayLongPress={400}
      className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 ${
        active ? 'bg-dark' : 'border border-field bg-bright'
      }`}
    >
      {detecting ? (
        <ActivityIndicator size="small" color={active ? colors.bright : colors.soft} />
      ) : (
        <LocationIcon size={13} color={active ? (auto ? colors.bright : colors.faint) : colors.soft} />
      )}
      <Text
        className={active ? 'font-sansmed text-[13px] text-bright' : 'font-sans text-[13px] text-soft'}
      >
        {label}
      </Text>
    </Pressable>
  );
}
