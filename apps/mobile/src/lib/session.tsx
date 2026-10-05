import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { api, sessionToken, ApiError } from "./api";
import {
  clearDisplayedNotifications,
  setNotificationContext,
} from "./notifications";
import type { Context, Workspaces } from "./types";
import { drafts } from "./drafts";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
      retry: (count, e) =>
        count < 1 && (!(e instanceof ApiError) || e.status >= 500),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
type SessionState = {
  context: Context | null;
  workspaces: Workspaces | null;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  restore: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  logout: () => Promise<void>;
};
const Session = createContext<SessionState>(null!);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<Context | null>(null),
    [workspaces, setWorkspaces] = useState<Workspaces | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const clear = useCallback(async () => {
    setNotificationContext();
    await queryClient.cancelQueries();
    queryClient.clear();
    drafts.clear();
    setContext(null);
    setWorkspaces(null);
    await sessionToken.set(null);
    await clearDisplayedNotifications().catch(() => {});
  }, []);
  const loadContext = useCallback(async () => {
    const value = await api<Context>("/api/mobile/context");
    setContext(value);
    setNotificationContext(value.client.id);
  }, []);
  const selectWorkspace = useCallback(
    async (id: string) => {
      await api("/api/mobile/workspace", { clientId: id });
      await queryClient.cancelQueries();
      queryClient.clear();
      drafts.clear();
      setContext(null);
      await clearDisplayedNotifications().catch(() => {});
      await loadContext();
    },
    [loadContext],
  );
  const restore = useCallback(async () => {
    setError("");
    try {
      if (!sessionToken.exists()) return;
      await api("/api/auth/get-session");
      const ws = await api<Workspaces>("/api/mobile/workspaces");
      setWorkspaces(ws);
      if (ws.items.some((item) => item.client.id === ws.activeClientId))
        await loadContext();
      else if (ws.items.length === 1)
        await selectWorkspace(ws.items[0].client.id);
      else {
        await queryClient.cancelQueries();
        queryClient.clear();
        drafts.clear();
        setNotificationContext();
        setContext(null);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await clear();
      else if (e instanceof ApiError && e.status === 403) {
        await queryClient.cancelQueries();
        queryClient.clear();
        drafts.clear();
        setContext(null);
        setNotificationContext();
        setError(e.message);
      }
      else setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [clear, loadContext, selectWorkspace]);
  useEffect(() => {
    sessionToken.onExpired(() => {
      void clear();
    });
    void sessionToken
      .load()
      .then(restore)
      .finally(() => setLoading(false));
    const sub = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
      if (state === "active") void restore();
    });
    return () => {
      sub.remove();
      sessionToken.onExpired();
    };
  }, [clear, restore]);
  async function login(email: string, password: string) {
    await api("/api/auth/sign-in/email", { email: email.trim(), password });
    if (!sessionToken.exists())
      throw new Error(
        "The server needs the mobile login update. Contact your administrator.",
      );
    await restore();
  }
  async function logout() {
    // Confirm server revocation before clearing the token so an offline logout
    // cannot leave a still-authorized device receiving notifications.
    await api("/api/auth/sign-out", {});
    await clear();
  }
  return (
    <QueryClientProvider client={queryClient}>
      <Session.Provider
        value={{
          context,
          workspaces,
          loading,
          error,
          login,
          restore,
          selectWorkspace,
          logout,
        }}
      >
        {children}
      </Session.Provider>
    </QueryClientProvider>
  );
}
export const useSession = () => useContext(Session);
