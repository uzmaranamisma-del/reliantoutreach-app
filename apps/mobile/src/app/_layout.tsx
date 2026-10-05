import { useEffect } from "react";
import { Platform, AppState } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { SessionProvider, useSession, queryClient } from "../lib/session";
import { ThemeProvider, useTheme } from "../ui/theme";
import {
  initializeNotifications,
  notificationEvent,
  registerPush,
} from "../lib/notifications";
import { storage } from "../lib/storage";
import { api } from "../lib/api";
void SplashScreen.preventAutoHideAsync();
void initializeNotifications();
function Navigation() {
  const { context } = useSession(),
    { colors, mode } = useTheme();
  useEffect(() => {
    if (!context || Platform.OS === "web") return;
    const scope = context.user.id + "." + context.client.id;
    const reconnect = async () => {
      if ((await storage.get("push.enabled." + scope)) !== "1") return;
      try {
        const prefs = JSON.parse(
          (await storage.get("push.prefs." + scope)) ||
            '{"replies":true,"orders":true}',
        );
        await registerPush(prefs);
      } catch {
        /* Settings displays delivery health; do not repeatedly prompt. */
      }
    };
    void reconnect();
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void reconnect();
    });
    const token = Notifications.addPushTokenListener(() => {
      void reconnect();
    });
    return () => {
      app.remove();
      token.remove();
    };
  }, [context]);
  useEffect(() => {
    if (Platform.OS === "web" || !context) return;
    let alive = true;
    const open = async (response: Notifications.NotificationResponse) => {
      const event = notificationEvent(
        response.notification.request.content.data,
      );
      if (!event || event.clientId !== context.client.id) return;
      await Notifications.clearLastNotificationResponseAsync();
      if (event.kind === "order") {
        if (alive) router.push("/(tabs)/plans");
        return;
      }
      try {
        const data = await api<{ email: string | null }>(
          `/api/mobile/event/${encodeURIComponent(event.eventId)}`,
        );
        if (alive) {
          if (data.email)
            router.push({
              pathname: "/conversation",
              params: { email: data.email },
            });
          else router.push("/(tabs)");
        }
      } catch {
        if (alive) router.push("/(tabs)");
      }
    };
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) void open(r);
    });
    const tapped = Notifications.addNotificationResponseReceivedListener(
      (r) => {
        void open(r);
      },
    );
    const received = Notifications.addNotificationReceivedListener((n) => {
      const event = notificationEvent(n.request.content.data);
      if (event?.clientId === context.client.id)
        void queryClient.invalidateQueries();
    });
    return () => {
      alive = false;
      tapped.remove();
      received.remove();
    };
  }, [context]);
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="conversation" />
        <Stack.Screen name="account" />
      </Stack>
    </>
  );
}
export default function RootLayout() {
  const [fonts, error] = useFonts({
    Jakarta: require("../../assets/fonts/PlusJakartaSans-400.ttf"),
    JakartaMedium: require("../../assets/fonts/PlusJakartaSans-500.ttf"),
    JakartaBold: require("../../assets/fonts/PlusJakartaSans-700.ttf"),
    JakartaExtra: require("../../assets/fonts/PlusJakartaSans-800.ttf"),
  });
  useEffect(() => {
    if (fonts || error) void SplashScreen.hideAsync();
  }, [fonts, error]);
  if (!fonts && !error) return null;
  return (
    <ThemeProvider>
      <SessionProvider>
        <Navigation />
      </SessionProvider>
    </ThemeProvider>
  );
}
