import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BellIcon,
  ChevronLeftIcon,
  CrownIcon,
  DocIcon,
  GlobeIcon,
  InfoIcon,
  LockIcon,
  PersonIcon,
  SparkleIcon,
} from '@/components/icons';
import { NavRow } from '@/components/nav-card';
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

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2.5 mt-7 text-[11.5px] font-sansbold uppercase tracking-[1px] text-muted">
      {children}
    </Text>
  );
}

function SectionCard({ children }: { children: ReactNode[] }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-hairline bg-card">
      {children.filter(Boolean).map((child, index) => (
        <View key={index} className={index > 0 ? 'border-t border-hairline' : ''}>
          {child}
        </View>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const providers = (session?.user.app_metadata?.providers ?? []) as string[];
  const hasPasswordAuth = providers.includes('email');

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
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 60 }}
      contentContainerClassName="px-6"
    >
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} className="mb-3.5">
        <ChevronLeftIcon size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-serif text-[29px] text-ink">{t('settings.title')}</Text>

      <SectionLabel>{t('settings.accountSection')}</SectionLabel>
      <SectionCard>
        {[
          <NavRow
            key="account"
            icon={<PersonIcon size={19} color={colors.ink} />}
            title={t('settings.accountInfo')}
            description={t('settings.accountInfoDesc')}
            onPress={() => router.push('/settings/account')}
          />,
          hasPasswordAuth ? (
            <NavRow
              key="security"
              icon={<LockIcon size={19} color={colors.ink} />}
              title={t('settings.security')}
              description={t('settings.securityDesc')}
              onPress={() => router.push('/settings/security')}
            />
          ) : null,
          <NavRow
            key="premium"
            icon={<CrownIcon size={19} color={colors.ink} />}
            title={t('settings.premium')}
            disabled
            right={
              <View className="rounded-full bg-sand px-2.5 py-1">
                <Text className="font-sansmed text-[11px] text-label">
                  {t('settings.premiumSoon')}
                </Text>
              </View>
            }
          />,
        ]}
      </SectionCard>

      <SectionLabel>{t('settings.prefsSection')}</SectionLabel>
      <SectionCard>
        {[
          <NavRow
            key="notifications"
            icon={<BellIcon size={19} color={colors.ink} strokeWidth={1.6} />}
            title={t('settings.notifications')}
            description={t('settings.notificationsDesc')}
            onPress={() => router.push('/settings/notifications')}
          />,
          <NavRow
            key="language"
            icon={<GlobeIcon size={19} color={colors.ink} />}
            title={t('settings.language')}
            right={<LanguageSegment />}
          />,
          Platform.OS === 'android' ? (
            <NavRow
              key="ai"
              icon={<SparkleIcon size={19} color={colors.ink} />}
              title={t('settings.ai')}
              description={t('settings.aiDesc')}
              onPress={() => router.push('/settings/ai')}
            />
          ) : null,
        ]}
      </SectionCard>

      <SectionLabel>{t('settings.aboutSection')}</SectionLabel>
      <SectionCard>
        {[
          <NavRow
            key="about"
            icon={<InfoIcon size={19} color={colors.ink} strokeWidth={1.6} />}
            title={t('settings.about')}
            onPress={() => router.push('/settings/about')}
          />,
          <NavRow
            key="terms"
            icon={<DocIcon size={19} color={colors.ink} />}
            title={t('settings.terms')}
            onPress={() => router.push('/settings/terms')}
          />,
        ]}
      </SectionCard>

      <Text className="mt-6 text-center font-sans text-[12px] text-muted">
        {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
      </Text>

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
