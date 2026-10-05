import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useSession, queryClient } from "../lib/session";
import { storage } from "../lib/storage";
import {
  connectNotifications,
  notificationPermission,
} from "../lib/notifications";
import { reminderDue, type MobileRelease } from "../lib/attention-policy";
import { checkAppRelease, openAppDownload } from "../lib/app-release";
import { Confirm } from "./confirm";
import { Txt, Notice } from "./components";

// Foreground reminders only: a denied OS permission cannot be bypassed by push.
export function AppAttention() {
  const { context } = useSession();
  const scope = context ? `${context.user.id}.${context.client.id}` : "";
  const [reminder, setReminder] = useState(false);
  const [release, setRelease] = useState<MobileRelease | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const current = useRef(scope);
  useEffect(() => {
    current.current = scope;
    return () => {
      current.current = "";
    };
  }, [scope]);
  useEffect(() => {
    if (!scope || Platform.OS === "web") return;
    let alive = true,
      running = false,
      lastConnection = 0,
      lastReleaseCheck = 0;
    const isCurrent = () => alive && current.current === scope;
    async function refresh(force = false) {
      if (running || !isCurrent() || AppState.currentState !== "active") return;
      running = true;
      try {
        const enabled = await storage.get("push.enabled." + scope);
        let permission = await notificationPermission();
        const prompted = await storage.get("push.permission.prompted");
        if (!isCurrent()) return;
        if (!permission.granted && !prompted && enabled !== "0") {
          // Persist before opening the OS dialog: resume cannot re-enter it.
          await storage.set("push.permission.prompted", "1");
          await storage.set("push.reminded", String(Date.now()));
          permission = await notificationPermission(true);
        }
        if (!isCurrent()) return;
        if (permission.granted && enabled !== "0") {
          setReminder(false);
          if (force || Date.now() - lastConnection > 15 * 60000) {
            lastConnection = Date.now();
            await connectNotifications(scope, false, isCurrent).catch(() => {});
            if (isCurrent())
              void queryClient.invalidateQueries({
                queryKey: ["push-status", scope],
              });
          }
        } else if (reminderDue(await storage.get("push.reminded"))) {
          await storage.set("push.reminded", String(Date.now()));
          if (isCurrent()) setReminder(true);
        }
        if (Date.now() - lastReleaseCheck > 6 * 3600000) {
          lastReleaseCheck = Date.now();
          const next = await checkAppRelease();
          if (
            next &&
            reminderDue(await storage.get(`release.dismissed.${next.build}`)) &&
            isCurrent()
          )
            setRelease(next);
        }
      } catch {
        // Offline startup must never interrupt the inbox. Account offers retry.
      } finally {
        running = false;
      }
    }
    void refresh();
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    const token = Notifications.addPushTokenListener(() => void refresh(true));
    return () => {
      alive = false;
      app.remove();
      token.remove();
    };
  }, [scope]);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      await storage.remove("push.enabled." + scope);
      const permission = await notificationPermission();
      if (!permission.granted && !permission.canAskAgain) {
        setReminder(false);
        await Linking.openSettings();
      } else {
        await connectNotifications(
          scope,
          true,
          () => current.current === scope,
        );
        setReminder(false);
        void queryClient.invalidateQueries({
          queryKey: ["push-status", scope],
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function dismissUpdate() {
    if (release)
      await storage.set(
        `release.dismissed.${release.build}`,
        String(Date.now()),
      );
    setRelease(null);
    setError("");
  }
  if (!scope || Platform.OS === "web") return null;
  return (
    <>
      <Confirm
        open={reminder}
        title="Don't miss a reply"
        action="Turn on notifications"
        cancelLabel="Later"
        busy={busy}
        onCancel={() => {
          setReminder(false);
          setError("");
        }}
        onConfirm={() => void enable()}
      >
        <Txt>
          Get new reply and order alerts even when the app is closed. You can
          change this anytime in Account. We&apos;ll remind you at most once a
          week.
        </Txt>
        <Notice message={error} />
      </Confirm>
      <Confirm
        open={!!release && !reminder}
        title="App update available"
        action="Get update"
        cancelLabel="Later"
        busy={busy}
        onCancel={() => void dismissUpdate()}
        onConfirm={() => {
          setBusy(true);
          void openAppDownload()
            .then(dismissUpdate)
            .catch(() =>
              setError(
                "Could not open the download page. Try again from Account.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <Txt>
          Version {release?.version} · Build {release?.build}
        </Txt>
        <Txt>{release?.notes}</Txt>
        <Txt>
          Download and install the update over this app. Your account stays the
          same.
        </Txt>
        <Notice message={error} />
      </Confirm>
    </>
  );
}
