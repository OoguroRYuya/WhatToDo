import { Tabs } from 'expo-router/js-tabs';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { fonts } from '@/theme/tokens';

export default function TabsLayout() {
  const { p } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.muted,
        tabBarStyle: { backgroundColor: p.paper, borderTopColor: p.rule },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
        sceneStyle: { backgroundColor: p.paper },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Feather name="check-square" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Account', tabBarIcon: ({ color, size }) => <Feather name="user" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
