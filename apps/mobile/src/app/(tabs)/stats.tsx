import { View, type DimensionValue } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowUpRight,
  Mail,
  MessageSquare,
  Users,
  Server,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { useTheme } from "../../ui/theme";
import {
  Button,
  Card,
  Header,
  Loading,
  Notice,
  Screen,
  Txt,
} from "../../ui/components";
type Stats = {
  snapshot: { values: Record<string, number>; capturedAt: string } | null;
  monthly: {
    values: { monthlyEmails?: number; basis?: string };
    capturedAt: string;
  } | null;
  month: string;
  capacity: number;
  connection: { lastSyncAt: string | null; lastError: string | null } | null;
};
const count = (value?: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString()
    : "—";
export default function StatsScreen() {
  const { context } = useSession(),
    { colors } = useTheme();
  const q = useQuery({
    queryKey: ["stats", context!.user.id, context!.client.id],
    queryFn: ({ signal }) => api<Stats>("/api/mobile/stats", undefined, signal),
    enabled: !!context?.permissions["analytics.view"],
  });
  const data = q.data,
    values = data?.snapshot?.values;
  const sent = data?.monthly?.values.monthlyEmails,
    percent =
      data && data.capacity > 0 && sent !== undefined
        ? Math.min(100, (sent / data.capacity) * 100)
        : 0;
  return (
    <Screen>
      <Header title="Your impact" subtitle="A clear view of your outreach" />
      {!context?.permissions["analytics.view"] ? (
        <Notice message="Statistics access is not enabled for this account." />
      ) : q.isPending ? (
        <Loading />
      ) : (
        <>
          <Notice message={q.error?.message} onRetry={() => void q.refetch()} />
          <LinearGradient
            colors={["#3358ff", "#1938a9"]}
            style={{ borderRadius: 26, padding: 24, gap: 18 }}
          >
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Txt weight="medium" style={{ color: "#dce3ff" }}>
                Emails sent this month
              </Txt>
              <ArrowUpRight color="#fff" size={23} />
            </View>
            <Txt
              weight="extra"
              style={{ color: "#fff", fontSize: 44, lineHeight: 56 }}
            >
              {count(sent)}
            </Txt>
            <Txt style={{ color: "#dce3ff", fontSize: 12 }}>
              {data?.month} ·{" "}
              {data?.capacity === -1
                ? "Unlimited allowance"
                : count(data?.capacity) + " managed allowance"}
            </Txt>
            <View
              style={{
                height: 6,
                borderRadius: 4,
                backgroundColor: "#ffffff35",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: (percent + "%") as DimensionValue,
                  height: 6,
                  backgroundColor: "#f9af03",
                }}
              />
            </View>
          </LinearGradient>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {[
              { label: "Emails sent", value: values?.sentCount, Icon: Mail },
              {
                label: "Replies",
                value: values?.replyCount,
                Icon: MessageSquare,
              },
              { label: "Prospects", value: values?.prospects, Icon: Users },
              {
                label: "Sending inboxes",
                value: values?.senders,
                Icon: Server,
              },
            ].map(({ label, value, Icon }) => (
              <Card
                key={label}
                style={{ width: "48%", flexGrow: 1, padding: 18 }}
              >
                <Icon size={20} color={colors.link} />
                <Txt weight="extra" style={{ fontSize: 26, lineHeight: 36 }}>
                  {count(value)}
                </Txt>
                <Txt style={{ fontSize: 12, color: colors.muted }}>{label}</Txt>
              </Card>
            ))}
          </View>
          <Card>
            <Txt weight="bold">Connected to your workspace</Txt>
            <Txt style={{ color: colors.muted, fontSize: 12 }}>
              The four totals above are all-time snapshots. Monthly usage is
              separate and may exclude manual replies.
            </Txt>
            <Txt style={{ color: colors.muted, fontSize: 12 }}>
              {data?.snapshot
                ? "Snapshot updated " +
                  new Date(data.snapshot.capturedAt).toLocaleString()
                : "Your first statistics sync is still pending."}
            </Txt>
            {data?.connection?.lastError && (
              <Txt style={{ color: colors.danger }}>
                The latest sync needs attention. Contact your administrator.
              </Txt>
            )}
            <Button
              title="Refresh stats"
              secondary
              busy={q.isRefetching}
              onPress={() => void q.refetch()}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}
