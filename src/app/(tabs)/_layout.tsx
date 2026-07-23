import { Tabs } from 'expo-router';

import { EditorialTabBar } from '@/components/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <EditorialTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wishlist" />
      <Tabs.Screen name="wardrobe" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
