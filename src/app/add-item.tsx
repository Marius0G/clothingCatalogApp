import { ItemCategorySchema, type ItemTags } from '@shared/types';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CameraIcon,
  CheckIcon,
  CloseIcon,
  PlusIcon,
  SparkleIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/features/auth/provider';
import { addItemToCollection } from '@/features/collections/api';
import { useCollections } from '@/features/collections/hooks';
import { suggestTags, uploadItemImage } from '@/features/wardrobe/api';
import {
  useCreatePhotoItem,
  useRequestAutoTags,
  useUpdateItem,
} from '@/features/wardrobe/hooks';
import { tryRemoveBackground } from '@/lib/background-removal';
import { pickFromCamera, pickFromGallery, prepareForUpload, type PickedImage } from '@/lib/images';
import { colors } from '@/lib/theme';

const CATEGORIES = ItemCategorySchema.options;

type Stage =
  | { kind: 'pick' }
  | { kind: 'processing'; originalUri: string }
  | { kind: 'preview'; originalUri: string; cutoutUri: string | null };

type AiState = 'pending' | 'done' | 'failed';

type AiAttrs = Pick<
  ItemTags,
  'pattern' | 'material' | 'fit' | 'formality' | 'warmth' | 'seasons' | 'occasions' | 'layer'
>;

function splitTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

export default function AddItemScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const createItem = useCreatePhotoItem();
  const updateItem = useUpdateItem();
  const requestAutoTags = useRequestAutoTags();
  const { data: collections } = useCollections();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const [useCutout, setUseCutout] = useState(true);
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [subcategory, setSubcategory] = useState('');
  const [itemColors, setItemColors] = useState('');
  const [styleTags, setStyleTags] = useState('');
  const [notes, setNotes] = useState('');
  const [aiState, setAiState] = useState<AiState>('pending');
  // v2 structured attributes: applied silently on save (no editing UI yet;
  // the item screen's re-tag refreshes them).
  const [aiAttrs, setAiAttrs] = useState<AiAttrs | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [showCollections, setShowCollections] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  // On web the modal can be the first page loaded (direct URL), so there may
  // be no history to go back to.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  // Guards against a slow AI response landing after the user retook the photo.
  const tagRunRef = useRef(0);

  const userCollections = (collections ?? []).filter((c) => !c.is_system);

  const startWith = async (picked: PickedImage | null) => {
    if (!picked) return;
    const prepared = await prepareForUpload(picked);
    setStage({ kind: 'processing', originalUri: prepared.uri });

    // New photo → the previous photo's AI suggestions no longer apply.
    setCategory(null);
    setSubcategory('');
    setItemColors('');
    setStyleTags('');
    setAiAttrs(null);
    setAiState('pending');
    const run = ++tagRunRef.current;
    suggestTags(prepared).then((tags) => {
      if (run !== tagRunRef.current) return;
      if (!tags) {
        setAiState('failed');
        return;
      }
      // Free-text fields the user may have typed in meanwhile: fill only if empty.
      setTitle((current) => current.trim() ? current : tags.title);
      setBrand((current) => current.trim() ? current : (tags.brand ?? ''));
      setNotes((current) => current.trim() ? current : tags.description);
      setCategory(tags.category);
      setSubcategory(tags.subcategory);
      setItemColors(tags.colors.join(', '));
      setStyleTags(tags.style_tags.join(', '));
      setAiAttrs({
        pattern: tags.pattern,
        material: tags.material,
        fit: tags.fit,
        formality: tags.formality,
        warmth: tags.warmth,
        seasons: tags.seasons,
        occasions: tags.occasions,
        layer: tags.layer,
      });
      setAiState('done');
    });

    const cutoutUri = await tryRemoveBackground(prepared.uri);
    setUseCutout(!!cutoutUri);
    setStage({ kind: 'preview', originalUri: prepared.uri, cutoutUri });
  };

  const save = async () => {
    if (stage.kind !== 'preview' || !session) return;
    setSaving(true);
    setError(false);
    try {
      const item = await createItem.mutateAsync({
        title: title.trim() || null,
        status: 'wardrobe',
        brand: brand.trim() || null,
        category,
        subcategory: subcategory.trim() || null,
        colors: splitTags(itemColors),
        style_tags: splitTags(styleTags),
        notes: notes.trim() || null,
        ai_tagged: aiState === 'done',
        ...(aiAttrs ?? {}),
      });
      const userId = session.user.id;
      const originalPath = await uploadItemImage(userId, item.id, stage.originalUri, 'original', false);
      const mainSource = useCutout && stage.cutoutUri ? stage.cutoutUri : stage.originalUri;
      const mainPath = await uploadItemImage(
        userId,
        item.id,
        mainSource,
        'main',
        useCutout && !!stage.cutoutUri,
      );
      await updateItem.mutateAsync({
        id: item.id,
        update: { image_path: mainPath, original_image_path: originalPath },
      });
      await Promise.all(
        selectedCollections.map((collectionId) => addItemToCollection(collectionId, item.id)),
      );
      if (selectedCollections.length) {
        queryClient.invalidateQueries({ queryKey: ['collection-items'] });
        queryClient.invalidateQueries({ queryKey: ['collection-summaries'] });
      }
      // AI didn't answer before save (or failed) — fall back to tagging in place.
      if (aiState !== 'done') requestAutoTags(item.id);
      close();
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-paper">
      <View
        className="flex-row items-center justify-between px-6 pb-2.5"
        style={{ paddingTop: insets.top + 14 }}
      >
        <Pressable accessibilityRole="button" hitSlop={8} onPress={close}>
          <CloseIcon size={22} color={colors.ink} />
        </Pressable>
        <Text className="font-serif text-[20px] text-ink">{t('addItem.title')}</Text>
        <View className="w-[22px]" />
      </View>

      {stage.kind === 'pick' ? (
        <View className="flex-1 justify-center gap-3 px-6 pb-24">
          <Button
            label={t('addItem.takePhoto')}
            icon={<CameraIcon size={18} color={colors.bright} />}
            onPress={() => pickFromCamera().then(startWith)}
          />
          <Button
            variant="secondary"
            label={t('addItem.fromGallery')}
            onPress={() => pickFromGallery().then(startWith)}
          />
        </View>
      ) : null}

      {stage.kind === 'processing' ? (
        <View className="flex-1 px-6 pt-2">
          <View className="h-[250px] items-center justify-center overflow-hidden rounded-[18px] bg-imagebg">
            <Image
              source={{ uri: stage.originalUri }}
              className="absolute inset-0 opacity-40"
              resizeMode="cover"
            />
            <ActivityIndicator color={colors.ink} />
            <Text className="mt-2 font-sans text-[13px] text-soft">
              {t('addItem.removingBackground')}
            </Text>
          </View>
        </View>
      ) : null}

      {stage.kind === 'preview' ? (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-6"
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 140 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="h-[250px] overflow-hidden rounded-[18px] bg-imagebg">
              <Image
                source={{ uri: useCutout && stage.cutoutUri ? stage.cutoutUri : stage.originalUri }}
                className="flex-1"
                resizeMode="contain"
              />
              {useCutout && stage.cutoutUri ? (
                <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full bg-[rgba(38,36,31,0.9)] px-3 py-1.5">
                  <CheckIcon size={13} color={colors.bright} strokeWidth={2.4} />
                  <Text className="font-sansmed text-[11.5px] text-bright">
                    {t('addItem.bgRemoved')}
                  </Text>
                </View>
              ) : null}
            </View>

            {stage.cutoutUri ? (
              <View className="mt-3 flex-row items-center justify-between">
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: useCutout }}
                  onPress={() => setUseCutout(!useCutout)}
                  className="flex-row items-center gap-2"
                >
                  <View
                    className={`h-5 w-[34px] rounded-full ${useCutout ? 'bg-dark' : 'bg-seg'}`}
                  >
                    <View
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-bright ${
                        useCutout ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </View>
                  <Text className="font-sans text-[13px] text-soft">{t('addItem.bgRemoved')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setUseCutout(false)}>
                  <Text className="font-sansbold text-[13px] text-accent underline">
                    {t('addItem.keepOrig')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View className="mt-5 flex-row items-center gap-2">
              {aiState === 'pending' ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <SparkleIcon size={14} color={colors.muted} />
              )}
              <Text className="font-sans text-[12px] text-muted">
                {aiState === 'pending' ? t('addItem.aiThinking') : t('addItem.aiTagged')}
              </Text>
            </View>

            <View className="mt-3 gap-2.5">
              <TextField
                label={t('addItem.itemTitle')}
                placeholder={t('addItem.itemTitlePlaceholder')}
                value={title}
                onChangeText={setTitle}
                error={error ? t('common.error') : null}
              />
              <TextField label={t('item.brand')} value={brand} onChangeText={setBrand} />

              <View className="gap-2">
                <Text className="text-[13px] font-sansmed text-label">{t('item.category')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {CATEGORIES.map((option) => (
                    <Chip
                      key={option}
                      label={t(`item.categories.${option}`)}
                      selected={category === option}
                      onPress={() => setCategory(category === option ? null : option)}
                    />
                  ))}
                </View>
              </View>

              <TextField
                label={t('item.subcategory')}
                placeholder={t('item.subcategoryPlaceholder')}
                value={subcategory}
                onChangeText={setSubcategory}
              />
              <TextField
                label={t('item.colors')}
                placeholder={t('item.colorsPlaceholder')}
                value={itemColors}
                onChangeText={setItemColors}
              />
              <TextField
                label={t('item.styleTags')}
                placeholder={t('item.styleTagsPlaceholder')}
                value={styleTags}
                onChangeText={setStyleTags}
              />
              <TextField label={t('item.notes')} value={notes} onChangeText={setNotes} multiline />

              {userCollections.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowCollections(!showCollections)}
                  className="flex-row items-center gap-2.5 rounded-xl border border-dashed border-[rgba(28,27,25,0.22)] bg-card px-3.5 py-3.5"
                >
                  <PlusIcon size={16} color={colors.soft} strokeWidth={1.8} />
                  <Text className="font-sans text-[14px] text-soft">
                    {selectedCollections.length > 0
                      ? (collections ?? [])
                          .filter((c) => selectedCollections.includes(c.id))
                          .map((c) => c.name)
                          .join(', ')
                      : t('addItem.addCollection')}
                  </Text>
                </Pressable>
              ) : null}

              {showCollections ? (
                <View className="flex-row flex-wrap gap-2">
                  {userCollections.map((collection) => {
                    const selected = selectedCollections.includes(collection.id);
                    return (
                      <Pressable
                        key={collection.id}
                        accessibilityRole="button"
                        onPress={() =>
                          setSelectedCollections(
                            selected
                              ? selectedCollections.filter((id) => id !== collection.id)
                              : [...selectedCollections, collection.id],
                          )
                        }
                        className={`rounded-full px-4 py-2 ${
                          selected ? 'bg-dark' : 'border border-field bg-bright'
                        }`}
                      >
                        <Text
                          className={
                            selected
                              ? 'font-sansmed text-[13px] text-bright'
                              : 'font-sans text-[13px] text-soft'
                          }
                        >
                          {collection.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View className="absolute bottom-0 left-0 right-0" pointerEvents="box-none">
            <LinearGradient
              colors={['rgba(244,241,236,0)', colors.paper]}
              locations={[0, 0.28]}
              pointerEvents="none"
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
            />
            <View
              className="flex-row gap-2.5 px-6 pt-3"
              style={{ paddingBottom: insets.bottom + 18 }}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => setStage({ kind: 'pick' })}
                className="h-[54px] w-[54px] items-center justify-center rounded-[14px] border border-strong bg-bright"
              >
                <CameraIcon size={20} color={colors.ink} strokeWidth={1.6} />
              </Pressable>
              <View className="flex-1">
                <Button label={t('addItem.saveItem')} loading={saving} onPress={save} />
              </View>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
