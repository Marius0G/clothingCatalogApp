import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookIcon, ChatBubbleIcon, ChevronLeftIcon, HeartIcon, MailIcon } from '@/components/icons';
import { NavCard } from '@/components/nav-card';
import { Button } from '@/components/ui/button';
import { SUPPORT_EMAIL } from '@/lib/support';
import { colors } from '@/lib/theme';

export default function SupportScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
      contentContainerClassName="px-6"
    >
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
        <ChevronLeftIcon size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-serif text-[29px] text-ink">{t('support.title')}</Text>
      <Text className="mt-2 font-sans text-[13.5px] leading-[20px] text-soft">
        {t('support.subtitle')}
      </Text>

      <View className="mt-6 gap-3.5">
        <NavCard
          icon={<BookIcon size={20} color={colors.ink} />}
          title={t('support.helpCenter')}
          description={t('support.helpCenterDesc')}
          onPress={() => router.push('/support/help')}
        />
        <NavCard
          icon={<MailIcon size={20} color={colors.ink} />}
          title={t('support.contact')}
          description={t('support.contactDesc')}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
        <NavCard
          icon={<ChatBubbleIcon size={20} color={colors.ink} />}
          title={t('support.feedback')}
          description={t('support.feedbackDesc')}
          onPress={() => router.push('/support/feedback')}
        />
      </View>

      <View className="mt-6 items-center rounded-2xl border border-hairline bg-card px-6 py-8">
        <HeartIcon size={26} color={colors.ink} strokeWidth={1.4} />
        <Text className="mt-4 text-center font-sansbold text-[17px] text-ink">
          {t('support.valueTitle')}
        </Text>
        <Text className="mt-2 max-w-[260px] text-center font-sans text-[13px] leading-[19px] text-soft">
          {t('support.valueBody')}
        </Text>
        <View className="mt-5 self-stretch">
          <Button label={t('support.feedback')} onPress={() => router.push('/support/feedback')} />
        </View>
      </View>
    </ScrollView>
  );
}
