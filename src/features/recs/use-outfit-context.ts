import type { Occasion, Weather } from '@shared/types';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';

import type { OutfitContext } from '@/features/recs/hooks';
import {
  detectCurrentWeather,
  hasLocationPermission,
  requestLocationPermission,
} from '@/lib/weather';

export const OCCASIONS: Occasion[] = ['everyday', 'office', 'evening', 'sport', 'event', 'travel'];
export const WEATHERS: Weather[] = ['hot', 'mild', 'cool', 'cold'];

/**
 * Generation context for the wardrobe Outfits view: occasion, weather (auto via
 * GPS or manual cycle) and the "style this item" anchor. Held by the tab route
 * so the context — and with it the `useOutfits` cache key — survives switching
 * between the Clothes and Outfits views.
 */
export function useOutfitContext() {
  const { t } = useTranslation();
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherAuto, setWeatherAuto] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [anchorItemId, setAnchorItemId] = useState<string | null>(null);
  // Set once the user picks weather manually — a slow auto-detect finishing
  // afterwards must not override their choice.
  const userChoseWeather = useRef(false);
  const prefillRan = useRef(false);
  // Weather is part of the useOutfits cache key: a silent prefill landing
  // mid-generation would switch the key and orphan the (expensive) result.
  const generationActive = useRef(false);

  const setGenerationActive = (active: boolean) => {
    generationActive.current = active;
  };

  const runAutoWeather = async (silent: boolean) => {
    setDetecting(true);
    const detected = await detectCurrentWeather();
    setDetecting(false);
    if (!detected) return;
    if (silent && (userChoseWeather.current || generationActive.current)) return;
    setWeather(detected);
    setWeatherAuto(true);
  };

  /** Silent weather prefill when permission was already granted. Runs once,
   * and only when the Outfits view is actually shown — never on tab mount. */
  const ensureAutoWeather = () => {
    if (prefillRan.current) return;
    prefillRan.current = true;
    hasLocationPermission().then((granted) => {
      if (granted) runAutoWeather(true);
    });
  };

  /** Long-press on the weather chip: re-detect via GPS, asking politely first. */
  const redetectWeather = async () => {
    userChoseWeather.current = false;
    if (await hasLocationPermission()) {
      runAutoWeather(false);
      return;
    }
    // Alert.alert is a no-op on react-native-web — go straight to the
    // browser's own permission prompt there.
    if (Platform.OS === 'web') {
      if (await requestLocationPermission()) runAutoWeather(false);
      return;
    }
    // In-app explainer BEFORE the OS permission dialog: location is used only
    // for local weather, and it's optional.
    Alert.alert(t('discover.locationTitle'), t('discover.locationBody'), [
      { text: t('common.skip'), style: 'cancel' },
      {
        text: t('common.continue'),
        onPress: async () => {
          if (await requestLocationPermission()) runAutoWeather(false);
        },
      },
    ]);
  };

  /** Tap on the weather chip: manual cycle through the four options. */
  const cycleWeather = () => {
    userChoseWeather.current = true;
    setWeatherAuto(false);
    setWeather((current) =>
      current === null ? WEATHERS[0] : WEATHERS[(WEATHERS.indexOf(current) + 1) % WEATHERS.length],
    );
  };

  const context: OutfitContext = useMemo(
    () => ({ occasion, weather, anchorItemId }),
    [occasion, weather, anchorItemId],
  );

  return {
    occasion,
    setOccasion,
    weather,
    weatherAuto,
    detecting,
    cycleWeather,
    redetectWeather,
    ensureAutoWeather,
    setGenerationActive,
    anchorItemId,
    setAnchor: setAnchorItemId,
    clearAnchor: () => setAnchorItemId(null),
    context,
  };
}

export type OutfitContextState = ReturnType<typeof useOutfitContext>;
