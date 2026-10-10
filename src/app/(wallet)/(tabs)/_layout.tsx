import { Tabs } from 'expo-router';

import { BottomNav, type TabRoute } from '@/components/BottomNav';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <BottomNav
          current={state.routes[state.index]!.name as TabRoute}
          onNavigate={(route) => navigation.navigate(route)}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
