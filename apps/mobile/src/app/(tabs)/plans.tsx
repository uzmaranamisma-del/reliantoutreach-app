import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Check, Layers, Clock3 } from "lucide-react-native";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import type { Plan, Order } from "../../lib/types";
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
import { Confirm } from "../../ui/confirm";
const money = (value: string, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
const capacity = (n?: number | null) =>
  typeof n === "number" ? n.toLocaleString() : "—";
export default function PlansScreen() {
  const { context } = useSession(),
    { colors } = useTheme(),
    [tab, setTab] = useState("Packages"),
    [selected, setSelected] = useState<Plan | null>(null),
    [cancel, setCancel] = useState<Order | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef<string | undefined>(undefined),
    scope = [context!.user.id, context!.client.id];
  const plans = useQuery({
    queryKey: ["plans", ...scope],
    queryFn: ({ signal }) =>
      api<{ items: Plan[]; activePackageId: string; canRequest: boolean }>(
        "/api/mobile/plans",
        undefined,
        signal,
      ),
  });
  const orders = useQuery({
    queryKey: ["orders", ...scope],
    queryFn: ({ signal }) =>
      api<{ items: Order[] }>("/api/mobile/orders", undefined, signal),
  });
  const pending = orders.data?.items.some((o) =>
    ["pending_review", "approved"].includes(o.status),
  );
  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError("");
    key.current ||= Crypto.randomUUID();
    try {
      await api("/api/mobile/orders", {
        packageId: selected.id,
        key: key.current,
        confirm: true,
      });
      key.current = undefined;
      setSelected(null);
      setTab("Orders");
      await orders.refetch();
    } catch (e) {
      setError((e as Error).message);
      setSelected(null);
      void orders.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function cancelOrder() {
    if (!cancel) return;
    setBusy(true);
    try {
      await api("/api/mobile/orders/cancel", { id: cancel.id, confirm: true });
      setCancel(null);
      await orders.refetch();
    } catch (e) {
      setError((e as Error).message);
      setCancel(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header
        title="Your plans"
        subtitle="Built for your next stage of growth"
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        {["Packages", "Orders"].map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              minHeight: 46,
              borderRadius: 14,
              backgroundColor: tab === t ? colors.soft : colors.panel,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Txt
              weight="bold"
              style={{ color: tab === t ? colors.link : colors.muted }}
            >
              {t}
            </Txt>
          </Pressable>
        ))}
      </View>
      <Notice
        message={error || plans.error?.message || orders.error?.message}
        onRetry={() => {
          void plans.refetch();
          void orders.refetch();
        }}
      />
      {tab === "Packages" ? (
        plans.isPending ? (
          <Loading />
        ) : (
          <>
            {pending && (
              <Notice message="Your package change is being reviewed. Follow its progress in Orders." />
            )}
            {plans.data?.items.map((plan) => {
              const active = plan.id === plans.data.activePackageId,
                emails = plan.limits.find(
                  (l) => l.key === "monthlyEmails",
                )?.value;
              return (
                <Card
                  key={plan.id}
                  style={{
                    backgroundColor: active ? "#1637ae" : colors.panel,
                    borderColor: active ? "#4469ff" : colors.line,
                    padding: 24,
                    gap: 16,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Txt
                      weight="bold"
                      style={{
                        color: active ? "#fff" : colors.text,
                        fontSize: 20,
                      }}
                    >
                      {plan.name}
                    </Txt>
                    {active ? (
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 5,
                          alignItems: "center",
                        }}
                      >
                        <Check color="#f9af03" size={15} />
                        <Txt
                          weight="bold"
                          style={{ color: "#f9af03", fontSize: 11 }}
                        >
                          ACTIVE
                        </Txt>
                      </View>
                    ) : (
                      <Layers size={20} color={colors.muted} />
                    )}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: 5,
                    }}
                  >
                    <Txt
                      weight="extra"
                      style={{
                        color: active ? "#fff" : colors.text,
                        fontSize: 32,
                        lineHeight: 42,
                      }}
                    >
                      {money(plan.price, plan.currency)}
                    </Txt>
                    <Txt style={{ color: active ? "#ccd6ff" : colors.muted }}>
                      / month
                    </Txt>
                  </View>
                  <Txt
                    style={{
                      color: active ? "#ccd6ff" : colors.secondary,
                      fontSize: 12,
                    }}
                  >
                    {plan.serviceType === "EMAIL"
                      ? emails === -1
                        ? "Unlimited email allowance"
                        : capacity(emails) + " emails / month"
                      : capacity(plan.monthlyMessages) + " messages / month"}
                  </Txt>
                  <Txt
                    style={{
                      color: active ? "#ccd6ff" : colors.muted,
                      fontSize: 12,
                    }}
                  >
                    One-time setup {money(plan.setupPrice, plan.currency)}
                    {plan.minimumMonths > 0
                      ? " · " + plan.minimumMonths + "-month minimum"
                      : ""}
                  </Txt>
                  {!active && (
                    <Button
                      title={
                        plan.requiresLimitReview
                          ? "Available after review"
                          : "Request package change"
                      }
                      secondary
                      disabled={
                        !plans.data.canRequest ||
                        !!pending ||
                        !plan.active ||
                        plan.requiresLimitReview ||
                        orders.isPending ||
                        !!orders.error
                      }
                      onPress={() => {
                        key.current = Crypto.randomUUID();
                        setSelected(plan);
                      }}
                    />
                  )}
                </Card>
              );
            })}
            <Txt
              style={{ fontSize: 11, color: colors.muted, textAlign: "center" }}
            >
              Requests go to your administrator. No payment is collected in this
              app.
            </Txt>
          </>
        )
      ) : orders.isPending ? (
        <Loading />
      ) : !orders.data?.items.length ? (
        <Card style={{ alignItems: "center", paddingVertical: 32 }}>
          <Clock3 color={colors.muted} size={32} />
          <Txt weight="bold">No requests yet</Txt>
          <Txt style={{ color: colors.muted, textAlign: "center" }}>
            Your package requests and their status will appear here.
          </Txt>
        </Card>
      ) : (
        orders.data.items.map((order) => (
          <Card key={order.id}>
            <Txt weight="bold" style={{ fontSize: 19 }}>
              {order.packageName}
            </Txt>
            <Txt style={{ color: colors.link }}>
              {order.status.replaceAll("_", " ")}
            </Txt>
            <Txt style={{ color: colors.muted, fontSize: 11 }}>
              Requested {new Date(order.createdAt).toLocaleDateString()} ·{" "}
              {order.id.slice(-8).toUpperCase()}
            </Txt>
            {order.history.map((h, i) => (
              <View
                key={i}
                style={{
                  paddingLeft: 14,
                  borderLeftWidth: 2,
                  borderLeftColor:
                    i === order.history.length - 1 ? colors.brand : colors.line,
                  gap: 3,
                }}
              >
                <Txt weight="medium">{h.status.replaceAll("_", " ")}</Txt>
                <Txt style={{ color: colors.muted, fontSize: 11 }}>
                  {new Date(h.at).toLocaleString()}
                </Txt>
                {h.note && (
                  <Txt style={{ color: colors.secondary, fontSize: 12 }}>
                    {h.note}
                  </Txt>
                )}
              </View>
            ))}
            {plans.data?.canRequest &&
              ["pending_review", "approved"].includes(order.status) && (
                <Button
                  title="Cancel request"
                  secondary
                  onPress={() => setCancel(order)}
                />
              )}
          </Card>
        ))
      )}
      <Button
        title="Refresh status"
        secondary
        busy={orders.isRefetching || plans.isRefetching}
        onPress={() => {
          void orders.refetch();
          void plans.refetch();
        }}
      />
      <Confirm
        open={!!selected}
        title="Request a package change?"
        action="Submit request"
        busy={busy}
        onCancel={() => setSelected(null)}
        onConfirm={() => void submit()}
      >
        <Txt>
          {selected?.name} ·{" "}
          {selected && money(selected.price, selected.currency)} / month
        </Txt>
        <Txt style={{ color: colors.muted }}>
          Your current plan stays active until your administrator activates the
          new package. Setup charges and commercial arrangements will be
          confirmed separately.
        </Txt>
      </Confirm>
      <Confirm
        open={!!cancel}
        title="Cancel this request?"
        action="Cancel request"
        busy={busy}
        onCancel={() => setCancel(null)}
        onConfirm={() => void cancelOrder()}
      >
        <Txt>Your active package will stay unchanged.</Txt>
      </Confirm>
    </Screen>
  );
}
