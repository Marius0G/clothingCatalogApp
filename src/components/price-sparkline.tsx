import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { useSnapshots } from '@/features/alerts/hooks';
import { formatPrice } from '@/features/wishlist/hooks';
import { colors } from '@/lib/theme';

const WIDTH = 320;
const HEIGHT = 56;

/** Minimal price-history line for the item detail (design token colors). */
export function PriceSparkline({ trackedProductId }: { trackedProductId: string }) {
  const { t } = useTranslation();
  const { data: snapshots } = useSnapshots(trackedProductId);
  const points = (snapshots ?? []).filter((s) => s.price != null);
  if (points.length < 2) return null;

  const prices = points.map((p) => p.price!);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (WIDTH - 12) + 6;
    const y = HEIGHT - 8 - ((p.price! - min) / range) * (HEIGHT - 16);
    return { x, y };
  });
  const last = coords[coords.length - 1];

  return (
    <View className="gap-1.5 rounded-2xl border border-hairline bg-card p-4">
      <Text className="text-[13px] font-sansmed text-label">{t('item.priceHistory')}</Text>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
          fill="none"
          stroke={colors.ink}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={last.x} cy={last.y} r={3} fill={colors.accent} />
      </Svg>
      <View className="flex-row justify-between">
        <Text className="font-sans text-[11px] text-muted">
          {formatPrice(min, points[0].currency)} – {formatPrice(max, points[0].currency)}
        </Text>
        <Text className="font-sans text-[11px] text-muted">
          {new Date(points[0].captured_at).toLocaleDateString()} →{' '}
          {new Date(points[points.length - 1].captured_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
}
