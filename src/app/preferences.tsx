import { STYLE_TAG_OPTIONS, type Profile } from '@shared/types';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, ChevronLeftIcon, PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import {
  CANONICAL_COLOR_HEX,
  FAVORITE_COLOR_OPTIONS,
  LIGHT_COLORS,
} from '@/lib/canonical-colors';
import { useProfile, useUpdateProfile } from '@/features/profile/hooks';
import { colors as themeColors } from '@/lib/theme';

const BRAND_PRESETS = ['Massimo Dutti', 'COS', 'Zara', 'Uniqlo'];

function SectionLabel({ children }: { children: string }) {
  return <Text className="mb-3 mt-6 text-[13px] font-sansbold text-label">{children}</Text>;
}

/** Rendered only once the profile is loaded, so state seeds from it directly. */
function PreferencesForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const updateProfile = useUpdateProfile();

  const [styles, setStyles] = useState<string[]>(profile.preferred_styles);
  const [favColors, setFavColors] = useState<string[]>(profile.favorite_colors);
  const [brands, setBrands] = useState<string[]>(profile.favorite_brands);
  const [brandInput, setBrandInput] = useState('');
  const [sizeTop, setSizeTop] = useState(profile.sizes.top ?? '');
  const [sizeBottom, setSizeBottom] = useState(profile.sizes.bottom ?? '');
  const [sizeShoe, setSizeShoe] = useState(profile.sizes.shoe ?? '');
  const [notes, setNotes] = useState(profile.style_preferences ?? '');
  const [error, setError] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const save = async () => {
    setError(false);
    const sizes: Record<string, string> = {};
    if (sizeTop.trim()) sizes.top = sizeTop.trim();
    if (sizeBottom.trim()) sizes.bottom = sizeBottom.trim();
    if (sizeShoe.trim()) sizes.shoe = sizeShoe.trim();
    try {
      await updateProfile.mutateAsync({
        preferred_styles: styles,
        favorite_colors: favColors,
        favorite_brands: brands,
        sizes,
        style_preferences: notes.trim() || null,
      });
      router.back();
    } catch {
      setError(true);
    }
  };

  return (
    <View className="flex-1 bg-paper">
      <View className="px-6 pb-1" style={{ paddingTop: insets.top + 14 }}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
          <ChevronLeftIcon size={22} color={themeColors.ink} />
        </Pressable>
        <Text className="font-serif text-[29px] text-ink">{t('prefs.title')}</Text>
        <Text className="mt-2 font-sans text-[13.5px] leading-[20px] text-soft">
          {t('prefs.subtitle')}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6"
        contentContainerStyle={{ paddingBottom: 130 }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionLabel>{t('prefs.stylesLabel')}</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {STYLE_TAG_OPTIONS.map((slug) => (
            <Chip
              key={slug}
              label={t(`styles.${slug}`)}
              selected={styles.includes(slug)}
              onPress={() => toggle(styles, setStyles, slug)}
            />
          ))}
        </View>

        <SectionLabel>{t('prefs.colorsLabel')}</SectionLabel>
        <View className="flex-row flex-wrap gap-3">
          {FAVORITE_COLOR_OPTIONS.map((color) => {
            const selected = favColors.includes(color);
            const hex = CANONICAL_COLOR_HEX[color];
            const light = LIGHT_COLORS.includes(color);
            return (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={color}
                onPress={() => toggle(favColors, setFavColors, color)}
                className={`items-center justify-center rounded-full ${
                  selected ? 'border-2 border-dark p-0.5' : ''
                }`}
              >
                <View
                  className={`h-[34px] w-[34px] items-center justify-center rounded-full ${
                    light ? 'border border-hairline' : ''
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {selected ? (
                    <CheckIcon size={13} color={light ? themeColors.ink : '#fff'} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <SectionLabel>{t('prefs.brandsLabel')}</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {[...BRAND_PRESETS, ...brands.filter((b) => !BRAND_PRESETS.includes(b))].map((brand) => (
            <Chip
              key={brand}
              label={brand}
              selected={brands.includes(brand)}
              onPress={() => toggle(brands, setBrands, brand)}
            />
          ))}
          <View className="flex-row items-center gap-1 rounded-full border border-dashed border-strong px-3">
            <PlusIcon size={14} color={themeColors.muted} strokeWidth={2} />
            <TextInput
              className="min-w-[70px] py-2 font-sans text-[13px] text-ink"
              placeholder="…"
              placeholderTextColor={themeColors.faint}
              value={brandInput}
              onChangeText={setBrandInput}
              onSubmitEditing={() => {
                const brand = brandInput.trim();
                if (brand && !brands.includes(brand)) {
                  setBrands([...brands, brand]);
                }
                setBrandInput('');
              }}
            />
          </View>
        </View>

        <SectionLabel>{t('prefs.sizesLabel')}</SectionLabel>
        <View className="flex-row gap-2.5">
          {(
            [
              ['szTops', sizeTop, setSizeTop, 'M'],
              ['szBottoms', sizeBottom, setSizeBottom, '32'],
              ['szShoes', sizeShoe, setSizeShoe, '42'],
            ] as const
          ).map(([key, value, set, ph]) => (
            <View key={key} className="flex-1 rounded-[11px] border border-strong bg-bright px-3 py-2">
              <Text className="text-[10.5px] font-sans text-faint">{t(`onboarding.${key}`)}</Text>
              <TextInput
                className="mt-0.5 p-0 font-sansmed text-[15px] text-ink"
                placeholder={ph}
                placeholderTextColor={themeColors.faint}
                value={value}
                onChangeText={set}
              />
            </View>
          ))}
        </View>

        <SectionLabel>{t('prefs.notesLabel')}</SectionLabel>
        <TextInput
          multiline
          textAlignVertical="top"
          placeholder={t('prefs.notesPh')}
          placeholderTextColor={themeColors.faint}
          value={notes}
          onChangeText={setNotes}
          className="min-h-[80px] rounded-xl border border-strong bg-bright p-3.5 font-sans text-[13.5px] leading-[20px] text-ink"
        />
        {error ? (
          <Text className="mt-3 font-sans text-[13px] text-sale">{t('common.error')}</Text>
        ) : null}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0" pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(244,241,236,0)', themeColors.paper]}
          locations={[0, 0.28]}
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        />
        <View className="px-6 pt-3" style={{ paddingBottom: insets.bottom + 18 }}>
          <Button label={t('prefs.save')} loading={updateProfile.isPending} onPress={save} />
        </View>
      </View>
    </View>
  );
}

export default function PreferencesScreen() {
  const { data: profile } = useProfile();
  if (!profile) return <View className="flex-1 bg-paper" />;
  return <PreferencesForm profile={profile} />;
}
