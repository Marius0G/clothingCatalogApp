import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { deleteAccount, signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/provider';
import { useProfile, useUpdateProfile } from '@/features/profile/hooks';

const LOCALES = ['ro', 'en'] as const;

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [deleting, setDeleting] = useState(false);

  const localeLabels = { ro: t('profile.languageRo'), en: t('profile.languageEn') } as const;
  const activeLocale = profile?.locale ?? (i18n.language === 'ro' ? 'ro' : 'en');

  const changeLocale = (locale: (typeof LOCALES)[number]) => {
    i18n.changeLanguage(locale);
    updateProfile.mutate({ locale });
  };

  const confirmDelete = () => {
    Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccountConfirm'),
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
    <Screen>
      <View className="gap-8 py-6">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-ink">
            {profile?.nickname || t('tabs.profile')}
          </Text>
          <Text className="text-base text-ink-faint">{session?.user.email}</Text>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium uppercase tracking-wide text-ink-faint">
            {t('profile.settings')}
          </Text>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-ink-soft">{t('profile.language')}</Text>
            <View className="flex-row gap-2">
              {LOCALES.map((locale) => (
                <Pressable
                  key={locale}
                  accessibilityRole="button"
                  onPress={() => changeLocale(locale)}
                  className={`h-11 flex-1 items-center justify-center rounded-full border ${
                    activeLocale === locale ? 'border-ink bg-ink' : 'border-ink/15 bg-paper'
                  }`}
                >
                  <Text
                    className={
                      activeLocale === locale ? 'font-medium text-paper' : 'text-ink-soft'
                    }
                  >
                    {localeLabels[locale]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View className="gap-3 pt-4">
          <Button variant="secondary" label={t('auth.signOut')} onPress={() => signOut()} />
          <Button
            variant="danger"
            label={t('profile.deleteAccount')}
            loading={deleting}
            onPress={confirmDelete}
          />
        </View>
      </View>
    </Screen>
  );
}
