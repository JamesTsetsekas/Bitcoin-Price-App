import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {
            // Ensure proper height and padding on web/Android
            height: 60,
            paddingBottom: 4,
            paddingTop: 4,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bitcoin',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bitcoinsign.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="strategy"
        options={{
          title: 'Strategy',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} />,
        }}
      />
    </Tabs>
  );
}
