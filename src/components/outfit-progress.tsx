import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SparkleIcon } from '@/components/icons';
import { colors } from '@/lib/theme';

/**
 * Slim progress bar pinned to the bottom, shown while outfits generate.
 * The recommend-outfits call streams no progress, so the fill eases toward 90%
 * over the expected duration and snaps to 100% the moment `visible` flips off —
 * honest about completion, smooth in between.
 */
export function OutfitProgress({
  visible,
  label,
  offset = 0,
}: {
  visible: boolean;
  label: string;
  /** Lift above overlaying chrome (e.g. 86 clears the floating tab bar). */
  offset?: number;
}) {
  const insets = useSafeAreaInsets();
  // Not useAnimatedValue — react-native-web doesn't export it.
  const [progress] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(0));
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible) {
      progress.stopAnimation();
      progress.setValue(0);
      opacity.setValue(1);
      Animated.timing(progress, {
        toValue: 0.9,
        duration: 20000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      wasVisible.current = true;
    } else if (wasVisible.current) {
      wasVisible.current = false;
      Animated.timing(progress, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [visible, progress, opacity]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['3%', '100%'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { opacity, bottom: offset, paddingBottom: (offset > 0 ? 0 : insets.bottom) + 18 },
      ]}
    >
      <LinearGradient
        colors={['rgba(244,241,236,0)', colors.paper]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.labelRow}>
        <SparkleIcon size={14} color={colors.ink} />
        <Text className="font-sans text-[12.5px] text-soft">{label}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 9,
  },
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.seg,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
});
