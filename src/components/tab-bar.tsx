import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HangerIcon,
  HeartIcon,
  HomeIcon,
  PlusIcon,
  SettingsIcon,
  type IconProps,
} from '@/components/icons';
import { colors } from '@/lib/theme';

const TAB_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  index: HomeIcon,
  wishlist: HeartIcon,
  wardrobe: HangerIcon,
  settings: SettingsIcon,
};

const TAB_LABELS: Record<string, string> = {
  index: 'tabs.home',
  wishlist: 'tabs.wishlist',
  wardrobe: 'tabs.wardrobe',
  settings: 'tabs.settings',
};

// Structural subset of BottomTabBarProps — expo-router vendors its own
// bottom-tabs types, which clash with the @react-navigation package's.
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target?: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

/** Design 2c-A: labelled tab bar with raised central + over a paper fade. */
export function EditorialTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const renderTab = (routeName: string) => {
    const index = state.routes.findIndex((r) => r.name === routeName);
    if (index === -1) return null;
    const route = state.routes[index];
    const active = state.index === index;
    const Icon = TAB_ICONS[routeName];
    const color = active ? colors.ink : colors.inactive;
    return (
      <Pressable
        key={routeName}
        accessibilityRole="button"
        accessibilityState={active ? { selected: true } : {}}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }}
        className="w-16 flex-col items-center gap-1"
      >
        <Icon size={23} color={color} filled={active} />
        <Text
          className={`text-[11px] ${active ? 'font-sansbold text-ink' : 'font-sans text-inactive'}`}
        >
          {t(TAB_LABELS[routeName])}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="absolute bottom-0 left-0 right-0" pointerEvents="box-none">
      <LinearGradient
        colors={['rgba(244,241,236,0)', colors.paper]}
        locations={[0, 0.26]}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
      />
      <View
        className="flex-row items-end justify-between px-5 pt-2.5"
        style={{ paddingBottom: insets.bottom + 10 }}
      >
        {renderTab('index')}
        {renderTab('wishlist')}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/add-item')}
          className="mb-1.5 h-14 w-14 items-center justify-center rounded-[18px] border bg-bright active:bg-paper"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }}
        >
          <PlusIcon size={26} color={colors.ink} />
        </Pressable>
        {renderTab('wardrobe')}
        {renderTab('settings')}
      </View>
    </View>
  );
}
