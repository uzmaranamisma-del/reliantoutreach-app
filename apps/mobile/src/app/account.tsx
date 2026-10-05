import { useEffect, useState } from "react";
import { Linking, Platform, Switch, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, ShieldCheck } from "lucide-react-native";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import {
  installationId,
  registerPush,
  clearDisplayedNotifications,
  notificationPermission,
} from "../lib/notifications";
import {
  checkAppRelease,
  installedVersion,
  installedBuild,
  openAppDownload,
} from "../lib/app-release";
import type { MobileRelease } from "../lib/attention-policy";
import { storage } from "../lib/storage";
import type { PushStatus } from "../lib/types";
import { useTheme } from "../ui/theme";
import { Button, Card, Header, Notice, Screen, Txt } from "../ui/components";
import { Confirm } from "../ui/confirm";
export default function Account() {
  const { context, workspaces, logout, selectWorkspace } = useSession(),
    { colors, mode, setMode } = useTheme();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [signOut, setSignOut] = useState(false),
    [prefs, setPrefs] = useState({ replies: true, orders: true });
  const [update, setUpdate] = useState<MobileRelease | null>(null);
  const scope = [context?.user.id, context?.client.id].join(".");
  const permission = useQuery({
    queryKey: ["phone-permission", scope],
    queryFn: () => notificationPermission(),
    enabled: !!context && Platform.OS !== "web",
    refetchInterval: 30000,
  });
  const registration = useQuery({
    queryKey: ["push-registration", scope],
    queryFn: () => storage.get("push.error." + scope),
    enabled: !!context,
    refetchInterval: 30000,
  });
  const status = useQuery({
    queryKey: ["push-status", scope],
    queryFn: async () =>
      api<PushStatus>(
        "/api/mobile/push?installationId=" + (await installationId()),
      ),
    enabled: !!context,
  });
  useEffect(() => {
    void storage.get("push.prefs." + scope).then((v) => {
      if (v) {
        try {
          setPrefs(JSON.parse(v));
        } catch {}
      }
    });
  }, [scope]);
  async function enable(next = prefs) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await registerPush(
        next,
        true,
        undefined,
        context?.client.id,
      );
      setPrefs(next);
      await storage.set("push.prefs." + scope, JSON.stringify(next));
      await storage.set("push.enabled." + scope, "1");
      await storage.remove("push.error." + scope);
      await permission.refetch();
      await registration.refetch();
      await status.refetch();
      setNotice(
        result.configured
          ? "This phone is registered for notifications."
          : "Phone registered. Your administrator still needs to enable the notification worker.",
      );
    } catch (e) {
      setError((e as Error).message);
      await permission.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    setError("");
    try {
      await api("/api/mobile/push/remove", {
        installationId: await installationId(),
      });
      await storage.set("push.enabled." + scope, "0");
      await storage.set("push.reminded", String(Date.now()));
      await clearDisplayedNotifications();
      await status.refetch();
      setNotice("Notifications disabled for this phone.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!context) return <Redirect href="/login" />;
  const workerStale = status.data?.worker?.at
    ? status.dataUpdatedAt - Date.parse(status.data.worker.at) > 5 * 60000
    : true;
  return (
    <Screen>
      <Header title="Your account" back />
      <Card>
        <Txt weight="extra" style={{ fontSize: 23 }}>
          {context.user.name}
        </Txt>
        <Txt style={{ color: colors.muted }}>{context.user.email}</Txt>
        <Txt style={{ color: colors.link }}>{context.client.company}</Txt>
      </Card>
      <Notice message={error || status.error?.message} />
      <Notice message={notice} />
      <Card>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Bell size={21} color={colors.link} />
          <Txt weight="bold" style={{ fontSize: 18 }}>
            Notifications
          </Txt>
        </View>
        <Txt style={{ color: colors.muted, fontSize: 12 }}>
          Reply alerts and package updates, even when the app is closed. Message
          content stays private on your lock screen.
        </Txt>
        <Txt weight="bold">
          {permission.data?.granted
            ? "Phone permission: allowed"
            : "Phone permission: off"}
        </Txt>
        <Notice message={registration.data || undefined} />
        {[
          { key: "replies" as const, label: "New replies" },
          { key: "orders" as const, label: "Package updates" },
        ].map((item) => (
          <View
            key={item.key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 48,
            }}
          >
            <Txt>{item.label}</Txt>
            <Switch
              accessibilityLabel={item.label}
              value={prefs[item.key]}
              disabled={busy}
              onValueChange={(value) => {
                const next = { ...prefs, [item.key]: value };
                if (status.data?.device) void enable(next);
                else setPrefs(next);
              }}
              trackColor={{ true: colors.brand, false: colors.line }}
            />
          </View>
        ))}
        <Button
          title={
            status.data?.device
              ? "Check / reconnect this phone"
              : "Enable notifications"
          }
          busy={busy}
          onPress={() => {
            void enable();
          }}
        />
        {status.data?.device && (
          <Button
            title="Disable on this phone"
            secondary
            disabled={busy}
            onPress={() => void disable()}
          />
        )}
        {Platform.OS !== "web" && (
          <Button
            title="Open phone settings"
            secondary
            onPress={() => void Linking.openSettings()}
          />
        )}
        <Txt style={{ color: colors.muted, fontSize: 11 }}>
          {!status.data?.configured
            ? "Server push setup is pending."
            : workerStale
              ? "Notification worker has not checked in recently. Contact your administrator."
              : status.data.scanError
                ? "Reply collection needs attention. Your administrator can check the connection."
                : "Notification worker is active."}
        </Txt>
      </Card>
      <Card>
        <Txt weight="bold" style={{ fontSize: 18 }}>
          App updates
        </Txt>
        <Txt>
          Version {installedVersion || "preview"} · Build{" "}
          {installedBuild || "web"}
        </Txt>
        {update && (
          <Txt>
            Version {update.version} · Build {update.build} is available.{" "}
            {update.notes}
          </Txt>
        )}
        <Button
          title="Check for updates"
          secondary
          busy={busy}
          onPress={() =>
            void run(async () => {
              const next = await checkAppRelease();
              setUpdate(next);
              setNotice(
                next
                  ? "An update is ready to download."
                  : Platform.OS === "android"
                    ? "You're using the latest published Android build."
                    : "Updates are managed through your app distribution service.",
              );
            })
          }
        />
        {update && (
          <Button
            title="Get update"
            onPress={() => void run(openAppDownload)}
          />
        )}
        <Txt style={{ color: colors.muted, fontSize: 12 }}>
          We&apos;ll also check when you open the app. Installing an update
          requires your confirmation.
        </Txt>
      </Card>
      <Card>
        <Txt weight="bold" style={{ fontSize: 18 }}>
          Appearance
        </Txt>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Dark"
              secondary={mode !== "dark"}
              onPress={() => setMode("dark")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Light"
              secondary={mode !== "light"}
              onPress={() => setMode("light")}
            />
          </View>
        </View>
      </Card>
      {workspaces && workspaces.items.length > 1 && (
        <Card>
          <Txt weight="bold">Switch workspace</Txt>
          {workspaces.items.map((w) => (
            <Button
              key={w.client.id}
              title={w.client.company}
              secondary
              disabled={busy || w.client.id === context.client.id}
              onPress={() =>
                void run(async () => {
                  await selectWorkspace(w.client.id);
                  router.replace("/(tabs)");
                })
              }
            />
          ))}
        </Card>
      )}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <ShieldCheck size={17} color={colors.muted} />
        <Txt style={{ flex: 1, color: colors.muted, fontSize: 11 }}>
          Replies are never sent automatically. Signing out requires an internet
          connection to revoke this phone’s session.
        </Txt>
      </View>
      <Button title="Sign out" secondary onPress={() => setSignOut(true)} />
      <Confirm
        open={signOut}
        title="Sign out of this phone?"
        action="Sign out"
        busy={busy}
        onCancel={() => setSignOut(false)}
        onConfirm={() => void run(logout)}
      >
        <Txt>
          Notifications for this session will stop. Unsaved reply drafts will be
          cleared.
        </Txt>
      </Confirm>
    </Screen>
  );
}
