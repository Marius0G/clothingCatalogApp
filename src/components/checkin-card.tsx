import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, Text, View } from 'react-native';

import { ThumbsDownIcon } from '@/components/icons';
import { colors } from '@/lib/theme';

const TIMER_MS = 5000;

/**
 * "Did you wear this?" prompt for the home hero. Auto-dismisses after ~5s via
 * a shrinking bar (expiry only through the animation's `finished` callback);
 * any touch on the prompt cancels the timer so it can't vanish mid-decision.
 * Unmounting stops the animation WITHOUT expiring — leaving the screen is not
 * an answer.
 */
export function CheckinCard({
  onYes,
  onNo,
  onThumbsDown,
  onExpire,
}: {
  onYes: () => void;
  onNo: () => void;
  onThumbsDown: () => void;
  onExpire: () => void;
}) {
  const { t } = useTranslation();
  // Not useAnimatedValue — react-native-web doesn't export it.
  const [progress] = useState(() => new Animated.Value(1));
  const pausedRef = useRef(false);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: TIMER_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onExpire();
    });
    return () => progress.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one timer per mount
  }, []);

  const pause = () => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    progress.stopAnimation();
  };

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    // Responder-capture, not just onTouchStart: web mouse input never fires
    // touchstart, and the responder system covers both. Returning false
    // observes the press without claiming it.
    <View
      onTouchStart={pause}
      onStartShouldSetResponderCapture={() => {
        pause();
        return false;
      }}
      className="mt-3 border-t border-hairline pt-3"
    >
      <Text className="font-sansbold text-[13.5px] text-ink">{t('home.checkinTitle')}</Text>
      <View className="mt-2.5 flex-row items-center gap-2.5">
        <Pressable
          accessibilityRole="button"
          onPress={onYes}
          className="rounded-full bg-dark px-4 py-2 active:opacity-90"
        >
          <Text className="font-sansmed text-[13px] text-bright">{t('home.checkinYes')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onNo}
          className="rounded-full border border-strong px-4 py-2 active:bg-paper"
        >
          <Text className="font-sansmed text-[13px] text-ink">{t('home.checkinNo')}</Text>
        </Pressable>
        <View className="flex-1" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.checkinDislike')}
          onPress={onThumbsDown}
          className="h-[36px] w-[36px] items-center justify-center rounded-[11px] border border-strong active:bg-paper"
        >
          <ThumbsDownIcon size={16} color={colors.muted} />
        </Pressable>
      </View>
      <View className="mt-3.5 h-[3px] overflow-hidden rounded-full bg-seg">
        <Animated.View style={{ width, height: 3, backgroundColor: colors.ink, borderRadius: 999 }} />
      </View>
    </View>
  );
}
