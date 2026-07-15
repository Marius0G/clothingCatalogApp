import { ItemCategorySchema, type ItemCategory } from '@shared/types';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIcon, HangerIcon, SearchIcon } from '@/components/icons';
import { ItemCard } from '@/components/item-card';
import { EmptyState } from '@/components/ui/empty-state';
import { TextField } from '@/components/ui/text-field';
import { useItems } from '@/features/wardrobe/hooks';
import { colors } from '@/lib/theme';

const CATEGORIES = ItemCategorySchema.options;

export default function WardrobeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: items, isPending } = useItems('wardrobe');

  const [filter, setFilter] = useState<ItemCategory | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

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

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 18 }}>
      <View className="flex-row items-center justify-between px-6">
        <Text className="font-serif text-[30px] text-ink">{t('wardrobe.title')}</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setSearchOpen((open) => !open)}
        >
          <SearchIcon size={22} color={colors.ink} />
        </Pressable>
      </View>

      {searchOpen ? (
        <View className="mt-3 px-6">
          <TextField
            placeholder={t('wardrobe.searchPh')}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
      ) : null}

      {empty ? (
        <EmptyState
          icon={<HangerIcon size={42} color={colors.iconmuted} strokeWidth={1.4} />}
          title={t('wardrobe.emptyTitle')}
          body={t('wardrobe.emptySub')}
          ctaLabel={t('wardrobe.emptyCta')}
          ctaIcon={<CameraIcon size={18} color={colors.bright} />}
          onPressCta={() => router.push('/add-item')}
        />
      ) : (
        <>
          <View className="mt-4 flex-row gap-2 px-6">
            <Pressable
              accessibilityRole="button"
              onPress={() => setFilter(null)}
              className={`rounded-full px-4 py-2 ${filter === null ? 'bg-dark' : 'border border-field bg-card'}`}
            >
              <Text
                className={
                  filter === null
                    ? 'font-sansmed text-[13px] text-bright'
                    : 'font-sans text-[13px] text-ink'
                }
              >
                {t('wardrobe.fAll')}
              </Text>
            </Pressable>
            {presentCategories.map((category) => (
              <Pressable
                key={category}
                accessibilityRole="button"
                onPress={() => setFilter(filter === category ? null : category)}
                className={`rounded-full px-4 py-2 ${filter === category ? 'bg-dark' : 'border border-field bg-card'}`}
              >
                <Text
                  className={
                    filter === category
                      ? 'font-sansmed text-[13px] text-bright'
                      : 'font-sans text-[13px] text-ink'
                  }
                >
                  {t(`item.categories.${category}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="mt-4 px-6 font-sans text-[12.5px] text-muted">
            {t('wardrobe.items', { count: visible.length })}
          </Text>

          <FlashList
            data={visible}
            numColumns={2}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ItemCard item={item} />}
            contentContainerStyle={{
              paddingHorizontal: 18,
              paddingTop: 8,
              paddingBottom: insets.bottom + 110,
            }}
          />
        </>
      )}
    </View>
  );
}
