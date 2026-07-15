import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkIcon, ChevronRightIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { deleteAccount, signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/provider';
import { useProfile, useUpdateProfile } from '@/features/profile/hooks';
import { colors } from '@/lib/theme';

const LOCALES = ['en', 'ro'] as const;

/** Design board-head lang-seg: sliding thumb segmented control. */
function LanguageSegment() {
  const { t, i18n } = useTranslation();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const active = profile?.locale ?? (i18n.language === 'ro' ? 'ro' : 'en');

  const change = (locale: (typeof LOCALES)[number]) => {
    i18n.changeLanguage(locale);
    updateProfile.mutate({ locale });
  };

  return (
    <View className="h-[38px] w-[100px] flex-row rounded-[10px] bg-seg p-1">
      {LOCALES.map((locale) => (
        <Pressable
          key={locale}
          accessibilityRole="button"
          onPress={() => change(locale)}
          className={`flex-1 items-center justify-center rounded-[7px] ${
            active === locale ? 'bg-bright' : ''
          }`}
          style={
            active === locale
              ? {
                  shadowColor: '#000',
                  shadowOpacity: 0.14,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 2,
                }
              : undefined
          }
        >
          <Text className="font-sansbold text-[13px] tracking-[0.4px] text-ink">
            {locale === 'ro' ? t('settings.languageRo') : t('settings.languageEn')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => {
    Alert.alert(t('settings.deleteAccountTitle'), t('settings.deleteAccountBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteAccountConfirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteAccount();
          } catch {
            setDeleting(false);
            Alert.alert(t('common.error'));
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 120 }}
      contentContainerClassName="px-6"
    >
      <Text className="font-serif text-[30px] text-ink">{t('settings.title')}</Text>
      <View className="mt-1.5">
        {profile?.nickname ? (
          <Text className="font-sans text-[14px] text-soft">{profile.nickname}</Text>
        ) : null}
        <Text className="font-sans text-[13px] text-muted">{session?.user.email}</Text>
      </View>

      <View className="mt-7 flex-row items-center justify-between rounded-2xl border border-hairline bg-card px-5 py-4">
        <Text className="font-sansmed text-[15px] text-ink">{t('settings.language')}</Text>
        <LanguageSegment />
      </View>

      <Link href="/collections" asChild>
        <Pressable className="mt-3 flex-row items-center justify-between rounded-2xl border border-hairline bg-card px-5 py-4 active:bg-paper">
          <View className="flex-row items-center gap-3">
            <BookmarkIcon size={18} color={colors.body} />
            <Text className="font-sansmed text-[15px] text-ink">{t('settings.collections')}</Text>
          </View>
          <ChevronRightIcon size={16} color={colors.muted} />
        </Pressable>
      </Link>

      <View className="mt-8 gap-3">
        <Button variant="secondary" label={t('auth.signOut')} onPress={() => signOut()} />
        <Button
          variant="danger"
          label={t('settings.deleteAccount')}
          loading={deleting}
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}
