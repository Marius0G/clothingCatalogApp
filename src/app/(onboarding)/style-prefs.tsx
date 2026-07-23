import { STYLE_TAG_OPTIONS } from '@shared/types';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, ChevronLeftIcon, PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { useUpdateProfile } from '@/features/profile/hooks';
import {
  CANONICAL_COLOR_HEX,
  FAVORITE_COLOR_OPTIONS,
  LIGHT_COLORS,
} from '@/lib/canonical-colors';
import { colors as themeColors } from '@/lib/theme';

const BRAND_PRESETS = ['Massimo Dutti', 'COS', 'Zara', 'Uniqlo'];

function SectionLabel({ children, optional }: { children: string; optional?: boolean }) {
  const { t } = useTranslation();
  return (
    <Text className="mb-3 mt-6 text-[13px] font-sansbold text-label">
      {children}
      {optional ? <Text className="font-sans text-faint"> {t('common.optional')}</Text> : null}
    </Text>
  );
}

export default function StylePrefsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const updateProfile = useUpdateProfile();

  const [styles, setStyles] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [brandInput, setBrandInput] = useState('');
  const [sizeTop, setSizeTop] = useState('');
  const [sizeBottom, setSizeBottom] = useState('');
  const [sizeShoe, setSizeShoe] = useState('');
  const [noGo, setNoGo] = useState('');
  const [freeText, setFreeText] = useState('');
  const [error, setError] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const finish = async () => {
    setError(false);
    const sizes: Record<string, string> = {};
    if (sizeTop.trim()) sizes.top = sizeTop.trim();
    if (sizeBottom.trim()) sizes.bottom = sizeBottom.trim();
    if (sizeShoe.trim()) sizes.shoe = sizeShoe.trim();

    try {
      await updateProfile.mutateAsync({
        preferred_styles: styles,
        favorite_colors: colors,
        favorite_brands: brands,
        style_preferences: freeText.trim() || null,
        no_go: noGo.trim() || null,
        sizes,
        onboarded_at: new Date().toISOString(),
      });
    } catch {
      setError(true);
    }
  };

  return (
    <View className="flex-1 bg-paper">
      <View className="px-6 pb-3" style={{ paddingTop: insets.top + 14 }}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
          <ChevronLeftIcon size={22} color={themeColors.ink} />
        </Pressable>
        <Text className="font-serif text-[29px] tracking-tight text-ink">
          {t('onboarding.prefTitle')}
        </Text>
        <Text className="mt-2 font-sans text-[13.5px] leading-[20px] text-soft">
          {t('onboarding.prefSub')}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6"
        contentContainerStyle={{ paddingBottom: 130 }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionLabel>{t('onboarding.stylePrefs')}</SectionLabel>
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

        <SectionLabel>{t('onboarding.prefColors')}</SectionLabel>
        <View className="flex-row flex-wrap gap-3">
          {FAVORITE_COLOR_OPTIONS.map((color) => {
            const selected = colors.includes(color);
            const hex = CANONICAL_COLOR_HEX[color];
            const light = LIGHT_COLORS.includes(color);
            return (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={color}
                onPress={() => toggle(colors, setColors, color)}
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

        <SectionLabel optional>{t('onboarding.favBrands')}</SectionLabel>
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

        <SectionLabel>{t('onboarding.sizes')}</SectionLabel>
        <View className="flex-row gap-2.5">
          {(
            [
              ['szTops', sizeTop, setSizeTop, 'M'],
              ['szBottoms', sizeBottom, setSizeBottom, '32'],
              ['szShoes', sizeShoe, setSizeShoe, '42'],
            ] as const
          ).map(([key, value, set, ph]) => (
            <View
              key={key}
              className="flex-1 rounded-[11px] border border-strong bg-bright px-3 py-2"
            >
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

        <SectionLabel optional>{t('onboarding.noGo')}</SectionLabel>
        <TextInput
          placeholder={t('onboarding.noGoPh')}
          placeholderTextColor={themeColors.faint}
          value={noGo}
          onChangeText={setNoGo}
          className="rounded-xl border border-strong bg-bright p-3.5 font-sans text-[13.5px] text-ink"
        />

        <SectionLabel optional>{t('onboarding.anything')}</SectionLabel>
        <TextInput
          multiline
          textAlignVertical="top"
          placeholder={t('onboarding.anythingPh')}
          placeholderTextColor={themeColors.faint}
          value={freeText}
          onChangeText={setFreeText}
          className="min-h-[64px] rounded-xl border border-strong bg-bright p-3.5 font-sans text-[13.5px] leading-[20px] text-ink"
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
          <Button
            label={t('onboarding.savePrefs')}
            loading={updateProfile.isPending}
            onPress={finish}
          />
        </View>
      </View>
    </View>
  );
}
