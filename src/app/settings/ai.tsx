import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, ChevronLeftIcon, DownloadIcon, TrashIcon } from '@/components/icons';
import {
  cancelDownload,
  deleteModel,
  isModelSupported,
  LOCAL_MODELS,
  pauseDownload,
  startModelDownload,
  useLocalAi,
  useModelDownload,
  type LocalModel,
} from '@/features/local-ai/hooks';
import { totalBytes } from '@/features/local-ai/registry';
import { useLocalAiStore } from '@/features/local-ai/store';
import { colors } from '@/lib/theme';

const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);

function ModeSegment({
  mode,
  localEnabled,
  onChange,
}: {
  mode: 'cloud' | 'local';
  localEnabled: boolean;
  onChange: (mode: 'cloud' | 'local') => void;
}) {
  const { t } = useTranslation();
  const options = [
    { value: 'cloud' as const, label: t('localAi.modeCloud'), enabled: true },
    { value: 'local' as const, label: t('localAi.modeLocal'), enabled: localEnabled },
  ];
  return (
    <View className="h-[44px] flex-row rounded-[12px] bg-seg p-1">
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === option.value, disabled: !option.enabled }}
          disabled={!option.enabled}
          onPress={() => onChange(option.value)}
          className={`flex-1 items-center justify-center rounded-[9px] ${
            mode === option.value ? 'bg-bright' : ''
          } ${option.enabled ? '' : 'opacity-40'}`}
        >
          <Text className="font-sansbold text-[13.5px] tracking-[0.3px] text-ink">
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ModelCard({
  model,
  isActive,
  onUse,
}: {
  model: LocalModel;
  isActive: boolean;
  onUse: () => void;
}) {
  const { t } = useTranslation();
  const download = useModelDownload(model.id);
  const supported = isModelSupported(model);
  const size = gb(totalBytes(model));

  const start = async (allowCellular = false) => {
    const result = await startModelDownload(model.id, { allowCellular });
    if (result.blocked === 'storage') {
      Alert.alert(t('localAi.noSpaceTitle'), t('localAi.noSpaceBody'));
    } else if (result.blocked === 'cellular') {
      Alert.alert(t('localAi.cellularTitle'), t('localAi.cellularBody', { size }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('localAi.cellularConfirm'), onPress: () => start(true) },
      ]);
    }
  };

  const confirmDelete = () =>
    Alert.alert(t('localAi.deleteTitle'), t('localAi.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('localAi.delete'), style: 'destructive', onPress: () => void deleteModel(model.id) },
    ]);

  const progress =
    download.status === 'downloading' || download.status === 'paused'
      ? download.receivedBytes / download.totalBytes
      : 0;

  return (
    <View className={`px-4 py-4 ${supported ? '' : 'opacity-45'}`}>
      <View className="flex-row items-center gap-2">
        <Text className="font-sansbold text-[15px] text-ink">
          {t(`localAi.models.${model.nameKey}`)}
        </Text>
        <View className={`rounded-full px-2 py-0.5 ${model.recommended ? 'bg-dark' : 'bg-sand'}`}>
          <Text
            className={`font-sansmed text-[10.5px] ${model.recommended ? 'text-bright' : 'text-label'}`}
          >
            {model.recommended ? t('localAi.badgeRecommended') : t('localAi.badgeQuality')}
          </Text>
        </View>
      </View>
      <Text className="mt-0.5 font-sans text-[12px] text-soft">
        {supported
          ? t('localAi.sizeNote', { size })
          : t('localAi.needsRam', { gb: Math.round(model.minRamBytes / 1024 ** 3) })}
      </Text>

      {supported && (download.status === 'idle' || download.status === 'error') && (
        <Pressable
          accessibilityRole="button"
          onPress={() => start()}
          className="mt-3 h-[40px] flex-row items-center justify-center gap-2 rounded-[12px] bg-dark"
        >
          <DownloadIcon size={16} color={colors.bright} />
          <Text className="font-sansbold text-[13px] text-bright">
            {t(download.status === 'error' ? 'localAi.retry' : 'localAi.download')}
          </Text>
        </Pressable>
      )}

      {(download.status === 'downloading' || download.status === 'paused') && (
        <View className="mt-3">
          <View className="h-[6px] overflow-hidden rounded-full bg-seg">
            <View
              className="h-full rounded-full bg-dark"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </View>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="font-sansmed text-[12px] text-soft">
              {gb(download.receivedBytes)} / {gb(download.totalBytes)} GB
            </Text>
            <View className="flex-row gap-4">
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  download.status === 'downloading'
                    ? void pauseDownload(model.id)
                    : void start(true)
                }
              >
                <Text className="font-sansbold text-[13px] text-ink">
                  {t(download.status === 'downloading' ? 'localAi.pause' : 'localAi.resume')}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void cancelDownload(model.id)}>
                <Text className="font-sansbold text-[13px] text-sale">
                  {t('localAi.cancelDownload')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {download.status === 'done' && (
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="font-sans text-[12.5px] text-soft">
            {t('localAi.downloaded')} · {size} GB
          </Text>
          <View className="flex-row items-center gap-4">
            {isActive ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-dark px-2.5 py-1">
                <CheckIcon size={10} />
                <Text className="font-sansmed text-[11px] text-bright">{t('localAi.active')}</Text>
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={onUse}>
                <Text className="font-sansbold text-[13px] text-ink">{t('localAi.use')}</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" hitSlop={6} onPress={confirmDelete}>
              <TrashIcon size={17} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default function LocalAiScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { mode, activeModelId, setMode, setActiveModel } = useLocalAi();
  const anyDownloaded = useLocalAiStore((state) =>
    LOCAL_MODELS.some((model) => state.downloads[model.id]?.status === 'done'),
  );

  const selectModel = (model: LocalModel) => {
    setActiveModel(model.id);
    setMode('local');
  };

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 60 }}
      contentContainerClassName="px-6"
    >
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
        <ChevronLeftIcon size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-serif text-[29px] text-ink">{t('localAi.title')}</Text>
      <Text className="mt-2 font-sans text-[13px] leading-[19px] text-soft">
        {t('localAi.intro')}
      </Text>

      <View className="mt-5">
        <ModeSegment
          mode={mode}
          localEnabled={anyDownloaded && activeModelId !== null}
          onChange={setMode}
        />
      </View>

      <Text className="mb-2.5 mt-7 text-[11.5px] font-sansbold uppercase tracking-[1px] text-muted">
        {t('localAi.modelsSection')}
      </Text>
      <View className="overflow-hidden rounded-2xl border border-hairline bg-card">
        {LOCAL_MODELS.map((model, index) => (
          <View key={model.id} className={index > 0 ? 'border-t border-hairline' : ''}>
            <ModelCard
              model={model}
              isActive={activeModelId === model.id}
              onUse={() => selectModel(model)}
            />
          </View>
        ))}
      </View>

      <Text className="mt-4 font-sans text-[12px] leading-[17px] text-muted">
        {t('localAi.qualityNote')}
      </Text>
    </ScrollView>
  );
}
