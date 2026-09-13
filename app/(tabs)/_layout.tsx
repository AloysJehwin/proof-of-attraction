import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors, font } from '../../src/theme';
import { useApp } from '../../src/lib/store';

function TabIcon({ label, color }: { label: string; color: ColorValue }) {
  return <Text style={{ fontSize: 22, color }}>{label}</Text>;
}

export default function TabsLayout() {
  const { refreshProfile, refreshMatches, refreshAgentLog } = useApp();
  useEffect(() => { refreshProfile(); refreshMatches(); refreshAgentLog(); }, [refreshProfile, refreshMatches, refreshAgentLog]);
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: font.weight.bold },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 88,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: font.weight.medium },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: ({ color }) => <TabIcon label="◈" color={color} /> }}
      />
      <Tabs.Screen
        name="matches"
        options={{ title: 'Matches', tabBarIcon: ({ color }) => <TabIcon label="♡" color={color} /> }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: 'Events', tabBarIcon: ({ color }) => <TabIcon label="◉" color={color} /> }}
      />
      <Tabs.Screen
        name="agent"
        options={{ title: 'Agent', tabBarIcon: ({ color }) => <TabIcon label="⚙" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon label="○" color={color} /> }}
      />
    </Tabs>
  );
}
