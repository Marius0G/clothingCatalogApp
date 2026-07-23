import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatBubbleIcon, FolderIcon, SettingsIcon, SlidersIcon } from '@/components/icons';
import { NavCard } from '@/components/nav-card';
import { useAuth } from '@/features/auth/provider';
import { useProfile } from '@/features/profile/hooks';
import { colors } from '@/lib/theme';

/** First letters of the first two words of the nickname; email fallback. */
function initialsOf(nickname: string | null | undefined, email: string | undefined): string {
  const source = nickname?.trim();
  if (source) {
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('');
  }
  return email?.[0]?.toUpperCase() ?? '?';
}

export default function YouScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { data: profile } = useProfile();

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 120 }}
      contentContainerClassName="px-6"
    >
      <Text className="text-center font-serif text-[30px] text-ink">{t('you.title')}</Text>

      <View className="mt-6 items-center">
        <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-circle">
          <Text className="font-serif text-[30px] text-ink">
            {initialsOf(profile?.nickname, session?.user.email)}
          </Text>
        </View>
        {profile?.nickname ? (
          <Text className="mt-3.5 font-serif text-[26px] text-ink">{profile.nickname}</Text>
        ) : null}
      </View>

      <View className="mt-8 gap-3.5">
        <NavCard
          icon={<SlidersIcon size={20} color={colors.ink} />}
          title={t('you.preferences')}
          description={t('you.preferencesDesc')}
          onPress={() => router.push('/preferences')}
        />
        <NavCard
          icon={<FolderIcon size={20} color={colors.ink} />}
          title={t('you.collections')}
          description={t('you.collectionsDesc')}
          onPress={() => router.push('/collections')}
        />
        <NavCard
          icon={<ChatBubbleIcon size={20} color={colors.ink} />}
          title={t('you.support')}
          description={t('you.supportDesc')}
          onPress={() => router.push('/support')}
        />
        <NavCard
          icon={<SettingsIcon size={20} color={colors.ink} />}
          title={t('you.settings')}
          description={t('you.settingsDesc')}
          onPress={() => router.push('/settings')}
        />
      </View>
    </ScrollView>
  );
}
