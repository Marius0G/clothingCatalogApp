import { ItemCategorySchema, type Item, type ItemCategory } from '@shared/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HangerIcon, SearchIcon, SparkleIcon } from '@/components/icons';
import { Chip } from '@/components/ui/chip';
import { SegmentedIconPill } from '@/components/ui/segmented-icon-pill';
import { TextField } from '@/components/ui/text-field';
import { ClothesView } from '@/components/wardrobe/clothes-view';
import { OutfitsView } from '@/components/wardrobe/outfits-view';
import { WeatherChip } from '@/components/weather-chip';
import { useRecordWear } from '@/features/outfits/hooks';
import { OCCASIONS, useOutfitContext } from '@/features/recs/use-outfit-context';
import { useItems } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';
import { useUiStore, type WardrobeView } from '@/lib/ui-store';

const CATEGORIES = ItemCategorySchema.options;

export default function WardrobeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: items, isPending } = useItems('wardrobe');

  const hydrated = useUiStore((state) => state.hydrated);
  const view = useUiStore((state) => state.wardrobeView);
  const setView = useUiStore((state) => state.setWardrobeView);

  const [filter, setFilter] = useState<ItemCategory | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Outfit generation context lives here, above both views, so occasion /
  // weather / anchor — and the useOutfits cache key — survive view switches.
  const outfitCtx = useOutfitContext();
  const {
    occasion,
    setOccasion,
    weather,
    weatherAuto,
    detecting,
    cycleWeather,
    redetectWeather,
    ensureAutoWeather,
    setAnchor,
  } = outfitCtx;

  // Deep-link params are one-shot commands (the tab bar re-navigates without
  // params but React Navigation keeps stale ones): consume, then clear.
  const params = useLocalSearchParams<{ view?: string; anchor?: string }>();
  useEffect(() => {
    if (!hydrated) return;
    if (!params.view && !params.anchor) return;
    if (params.view === 'outfits' || params.view === 'clothes') setView(params.view);
    if (params.anchor) {
      setAnchor(params.anchor);
      setView('outfits');
    }
    router.setParams({ view: undefined, anchor: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consume-once per param arrival
  }, [hydrated, params.view, params.anchor]);

  // Silent weather prefill only once the outfits view is actually shown.
  useEffect(() => {
    if (hydrated && view === 'outfits') ensureAutoWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ensureAutoWeather self-guards to run once
  }, [hydrated, view]);

  const presentCategories = useMemo(
    () => CATEGORIES.filter((c) => items?.some((i) => i.category === c)),
    [items],
  );

  const visible = useMemo(() => {
    let list = items ?? [];
    if (filter) list = list.filter((i) => i.category === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) =>
        [i.title, i.brand, i.subcategory, ...i.style_tags, ...i.colors]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [items, filter, search]);

  const empty = !isPending && items?.length === 0;

  // Quick wear-log: hold a tile → record wear for that single item.
  const recordWear = useRecordWear();
  const [justWornId, setJustWornId] = useState<string | null>(null);
  const justWornTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logWear = (item: Item) => {
    recordWear.mutate([item.id]);
    Vibration.vibrate(30);
    setJustWornId(item.id);
    if (justWornTimer.current) clearTimeout(justWornTimer.current);
    justWornTimer.current = setTimeout(() => setJustWornId(null), 1400);
  };
  useEffect(
    () => () => {
      if (justWornTimer.current) clearTimeout(justWornTimer.current);
    },
    [],
  );

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 18 }}>
      <View className="flex-row items-center justify-between px-6">
        <Text className="font-serif text-[30px] text-ink">{t('wardrobe.title')}</Text>
        {view === 'clothes' ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setSearchOpen((open) => !open)}
          >
            <SearchIcon size={22} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>

      {searchOpen && view === 'clothes' ? (
        <View className="mt-3 px-6">
          <TextField
            placeholder={t('wardrobe.searchPh')}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
      ) : null}

      {/* Single control row: view pill pinned left, contextual chips scroll beside it. */}
      <View className="mt-4 flex-row items-center gap-2.5 pl-6">
        <SegmentedIconPill<WardrobeView>
          options={[
            { key: 'clothes', icon: HangerIcon, label: t('wardrobe.viewClothes') },
            { key: 'outfits', icon: SparkleIcon, label: t('wardrobe.viewOutfits') },
          ]}
          value={view}
          onChange={setView}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-h-[38px] flex-1"
          contentContainerClassName="items-center gap-2 pr-6"
        >
          {!hydrated ? null : view === 'clothes' ? (
            <>
              <Chip
                tone="card"
                label={t('wardrobe.fAll')}
                selected={filter === null}
                onPress={() => setFilter(null)}
              />
              {presentCategories.map((category) => (
                <Chip
                  key={category}
                  tone="card"
                  label={t(`item.categories.${category}`)}
                  selected={filter === category}
                  onPress={() => setFilter(filter === category ? null : category)}
                />
              ))}
            </>
          ) : (
            <>
              {OCCASIONS.map((option) => (
                <Chip
                  key={option}
                  label={t(`discover.occasions.${option}`)}
                  selected={occasion === option}
                  onPress={() => setOccasion(occasion === option ? null : option)}
                />
              ))}
              <WeatherChip
                value={weather}
                auto={weatherAuto}
                detecting={detecting}
                onCycle={cycleWeather}
                onRedetect={redetectWeather}
              />
            </>
          )}
        </ScrollView>
      </View>

      {!hydrated ? (
        <View className="flex-1" />
      ) : view === 'outfits' ? (
        <OutfitsView outfitCtx={outfitCtx} />
      ) : (
        <ClothesView
          items={visible}
          empty={empty}
          onLongPressItem={logWear}
          justWornId={justWornId}
        />
      )}
    </View>
  );
}
