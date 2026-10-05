import { Redirect, Tabs } from "expo-router";
import { Inbox, ChartNoAxesCombined, Layers } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../../lib/session";
import { useTheme } from "../../ui/theme";
import { Loading, Screen } from "../../ui/components";
export default function TabsLayout() {
  const { context, loading } = useSession(),
    { colors } = useTheme(),
    insets = useSafeAreaInsets();
  if (loading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (!context) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.link,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.line,
          height: 64 + Math.max(insets.bottom, 8),
          paddingTop: 9,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontFamily: "JakartaBold", fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color }) => <Inbox size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color }) => (
            <ChartNoAxesCombined size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: "Plans",
          tabBarIcon: ({ color }) => <Layers size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
