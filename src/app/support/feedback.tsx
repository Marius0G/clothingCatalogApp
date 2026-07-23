import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, ChevronLeftIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useSubmitFeedback } from '@/features/support/hooks';
import { colors } from '@/lib/theme';

export default function FeedbackScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const submitFeedback = useSubmitFeedback();
  const [message, setMessage] = useState('');

  return (
    <View className="flex-1 bg-paper px-6" style={{ paddingTop: insets.top + 16 }}>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
        <ChevronLeftIcon size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-serif text-[29px] text-ink">{t('support.feedbackTitle')}</Text>
      <Text className="mt-2 font-sans text-[13.5px] leading-[20px] text-soft">
        {t('support.feedbackDesc')}
      </Text>

      {submitFeedback.isSuccess ? (
        <View className="mt-8 items-center rounded-2xl border border-hairline bg-card px-6 py-9">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-dark">
            <CheckIcon size={18} color={colors.bright} />
          </View>
          <Text className="mt-4 text-center font-sansbold text-[15px] text-ink">
            {t('support.feedbackThanks')}
          </Text>
        </View>
      ) : (
        <View className="mt-6 gap-4">
          <TextField
            multiline
            placeholder={t('support.feedbackPh')}
            value={message}
            onChangeText={setMessage}
            error={submitFeedback.isError ? t('common.error') : null}
          />
          <Button
            label={t('support.feedbackSend')}
            loading={submitFeedback.isPending}
            disabled={!message.trim()}
            onPress={() => submitFeedback.mutate(message.trim())}
          />
        </View>
      )}
    </View>
  );
}
