import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/features/auth/provider';
import { uploadItemImage } from '@/features/wardrobe/api';
import {
  useCreatePhotoItem,
  useRequestAutoTags,
  useUpdateItem,
} from '@/features/wardrobe/hooks';
import { tryRemoveBackground } from '@/lib/background-removal';
import { pickFromCamera, pickFromGallery, prepareForUpload, type PickedImage } from '@/lib/images';

type Stage =
  | { kind: 'pick' }
  | { kind: 'processing'; originalUri: string }
  | { kind: 'preview'; originalUri: string; cutoutUri: string | null };

export default function AddItemScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const createItem = useCreatePhotoItem();
  const updateItem = useUpdateItem();
  const requestAutoTags = useRequestAutoTags();

  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const [useCutout, setUseCutout] = useState(true);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const startWith = async (picked: PickedImage | null) => {
    if (!picked) return;
    const prepared = await prepareForUpload(picked);
    setStage({ kind: 'processing', originalUri: prepared });
    const cutoutUri = await tryRemoveBackground(prepared);
    setUseCutout(!!cutoutUri);
    setStage({ kind: 'preview', originalUri: prepared, cutoutUri });
  };

  const save = async () => {
    if (stage.kind !== 'preview' || !session) return;
    setSaving(true);
    setError(false);
    try {
      const item = await createItem.mutateAsync({
        title: title.trim() || null,
        status: 'wardrobe',
      });
      const userId = session.user.id;
      const originalPath = await uploadItemImage(
        userId,
        item.id,
        stage.originalUri,
        'original',
        false,
      );
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
      requestAutoTags(item.id);
      router.back();
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View className="gap-6 py-4">
        <Text className="text-2xl font-bold text-ink">{t('addItem.title')}</Text>

        {stage.kind === 'pick' ? (
          <View className="gap-3 pt-4">
            <Button label={t('addItem.takePhoto')} onPress={() => pickFromCamera().then(startWith)} />
            <Button
              variant="secondary"
              label={t('addItem.fromGallery')}
              onPress={() => pickFromGallery().then(startWith)}
            />
          </View>
        ) : null}

        {stage.kind === 'processing' ? (
          <View className="items-center gap-4 rounded-3xl bg-paper p-4">
            <Image
              source={{ uri: stage.originalUri }}
              className="aspect-[3/4] w-full rounded-2xl opacity-40"
              resizeMode="cover"
            />
            <View className="absolute inset-0 items-center justify-center gap-2">
              <ActivityIndicator color="#1a1a1a" />
              <Text className="text-ink-soft">{t('addItem.removingBackground')}</Text>
            </View>
          </View>
        ) : null}

        {stage.kind === 'preview' ? (
          <View className="gap-4">
            <View className="items-center rounded-3xl bg-paper p-4">
              <Image
                source={{ uri: useCutout && stage.cutoutUri ? stage.cutoutUri : stage.originalUri }}
                className="aspect-[3/4] w-full rounded-2xl"
                resizeMode="contain"
              />
            </View>

            {stage.cutoutUri ? (
              <View className="flex-row gap-2">
                {([true, false] as const).map((cut) => (
                  <Pressable
                    key={String(cut)}
                    accessibilityRole="button"
                    onPress={() => setUseCutout(cut)}
                    className={`h-11 flex-1 items-center justify-center rounded-full border ${
                      useCutout === cut ? 'border-ink bg-ink' : 'border-ink/15 bg-paper'
                    }`}
                  >
                    <Text className={useCutout === cut ? 'font-medium text-paper' : 'text-ink-soft'}>
                      {cut ? t('addItem.cutout') : t('addItem.original')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text className="text-sm text-ink-faint">{t('addItem.noCutout')}</Text>
            )}

            <TextField
              label={t('addItem.itemTitle')}
              placeholder={t('addItem.itemTitlePlaceholder')}
              value={title}
              onChangeText={setTitle}
              error={error ? t('common.error') : null}
            />

            <View className="gap-3">
              <Button label={t('common.save')} loading={saving} onPress={save} />
              <Button
                variant="ghost"
                label={t('addItem.retake')}
                onPress={() => setStage({ kind: 'pick' })}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
