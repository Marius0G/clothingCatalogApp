import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HangerIcon,
  HeartIcon,
  HomeIcon,
  PersonIcon,
  PlusIcon,
  type IconProps,
} from '@/components/icons';
import { colors } from '@/lib/theme';

const TAB_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  index: HomeIcon,
  wishlist: HeartIcon,
  wardrobe: HangerIcon,
  you: PersonIcon,
};

const INACTIVE = 'rgba(251,249,245,0.55)';

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

/** Design 2c-B: floating dark pill, icon-only, raised bright + in the middle. */
export function EditorialTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  const renderTab = (routeName: string) => {
    const index = state.routes.findIndex((r) => r.name === routeName);
    if (index === -1) return null;
    const route = state.routes[index];
    const active = state.index === index;
    const Icon = TAB_ICONS[routeName];
    return (
      <Pressable
        key={routeName}
        accessibilityRole="button"
        accessibilityState={active ? { selected: true } : {}}
        hitSlop={10}
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
      >
        <Icon
          size={22}
          color={active ? colors.bright : INACTIVE}
          filled={active}
          strokeWidth={active ? 1.9 : 1.7}
        />
      </Pressable>
    );
  };

  return (
    <View
      className="absolute left-0 right-0 items-center"
      style={{ bottom: insets.bottom + 12 }}
      pointerEvents="box-none"
    >
      <View
        className="flex-row items-center gap-[26px] rounded-[40px] bg-dark py-3 pl-[22px] pr-[22px]"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 26,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
        }}
      >
        {renderTab('index')}
        {renderTab('wishlist')}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/add-chooser')}
          className="h-10 w-10 items-center justify-center rounded-full bg-bright active:opacity-90"
        >
          <PlusIcon size={20} color={colors.dark} strokeWidth={2} />
        </Pressable>
        {renderTab('wardrobe')}
        {renderTab('you')}
      </View>
    </View>
  );
}
