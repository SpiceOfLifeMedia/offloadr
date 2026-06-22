import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/constants/colors";

function TabIcon({ char, focused }: { char: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 18,
        opacity: focused ? 1 : 0.4,
        color: focused ? colors.brandIndigo : colors.textTertiary,
        fontWeight: "600",
      }}
    >
      {char}
    </Text>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.brandIndigo,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ focused }) => <TabIcon char="⌂" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          tabBarLabel: "Programs",
          tabBarIcon: ({ focused }) => <TabIcon char="▶" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          tabBarLabel: "Projects",
          tabBarIcon: ({ focused }) => <TabIcon char="◫" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ focused }) => <TabIcon char="⚙" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
