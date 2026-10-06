import { useMemo, useState, useCallback } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Inbox, Search, Star, ChevronRight } from "lucide-react-native";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import {
  conversations,
  displayName,
  initials,
  newestMessages,
  chatText,
  timeLabel,
} from "../../lib/messages";
import type { ConversationState, MessagePage } from "../../lib/types";
import { useTheme } from "../../ui/theme";
import {
  Button,
  Card,
  Header,
  Input,
  Loading,
  Notice,
  Screen,
  Txt,
} from "../../ui/components";
export default function InboxScreen() {
  const { context } = useSession(),
    { colors } = useTheme(),
    [filter, setFilter] = useState("All"),
    [search, setSearch] = useState("");
  const scope = [context!.user.id, context!.client.id];
  const q = useInfiniteQuery({
    queryKey: ["inbox", ...scope],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      api<MessagePage>(
        "/api/mobile/inbox?limit=50" +
          (pageParam ? "&cursor=" + encodeURIComponent(pageParam) : ""),
        undefined,
        signal,
      ),
    getNextPageParam: (last, pages, cursor) =>
      last.items.length &&
      last.pagination?.nextCursor &&
      last.pagination.nextCursor !== cursor &&
      pages.length < 20
        ? last.pagination.nextCursor
        : undefined,
    enabled: !!context?.permissions["inbox.view"],
  });
  const rows = useMemo(
    () => conversations(newestMessages(q.data?.pages || [])).slice(0, 100),
    [q.data],
  );
  const emails = rows.map((r) => r.fromEmail.toLowerCase());
  const state = useQuery({
    queryKey: ["conversation-state", ...scope, emails],
    queryFn: ({ signal }) =>
      api<{ items: ConversationState[] }>(
        "/api/mobile/conversation-state?" +
          emails.map((e) => "email=" + encodeURIComponent(e)).join("&"),
        undefined,
        signal,
      ),
    enabled: emails.length > 0,
  });
  const refetchState = state.refetch;
  useFocusEffect(
    useCallback(() => {
      if (emails.length) void refetchState();
      return undefined;
    }, [refetchState, emails.length]),
  );
  const states = new Map(state.data?.items.map((s) => [s.email, s]));
  const isUnread = (email: string, at: string) => {
    const readAt = states.get(email.toLowerCase())?.readAt;
    return !readAt || Date.parse(at) > Date.parse(readAt);
  };
  const displayed = rows.filter(
    (r) =>
      (filter !== "Unread" || isUnread(r.fromEmail, r.createdAt)) &&
      (filter !== "Starred" ||
        states.get(r.fromEmail.toLowerCase())?.starred) &&
      [r.fromEmail, r.subject, r.preview]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <Screen scroll={false}>
      <View style={{ padding: 22, gap: 20 }}>
        <Header title="Inbox" subtitle={context?.client.company} />
        <View>
          <Input
            accessibilityLabel="Search loaded conversations"
            value={search}
            onChangeText={setSearch}
            placeholder="Search loaded conversations"
            style={{ paddingLeft: 44 }}
          />
          <Search
            size={18}
            color={colors.muted}
            style={{ position: "absolute", left: 15, top: 17 }}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["All", "Unread", "Starred"].map((f) => (
            <Pressable
              key={f}
              accessibilityRole="tab"
              accessibilityState={{ selected: f === filter }}
              onPress={() => setFilter(f)}
              style={{
                minHeight: 44,
                paddingHorizontal: 18,
                justifyContent: "center",
                borderRadius: 22,
                backgroundColor: filter === f ? colors.soft : colors.panel,
                borderWidth: 1,
                borderColor: filter === f ? colors.link : colors.line,
              }}
            >
              <Txt
                weight="bold"
                style={{
                  color: f === filter ? colors.link : colors.muted,
                  fontSize: 12,
                }}
              >
                {f}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>
      {!context?.permissions["inbox.view"] ? (
        <View style={{ padding: 22 }}>
          <Notice message="Your administrator has not enabled inbox access for this account." />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(r) => r.fromEmail.toLowerCase()}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 24,
            gap: 1,
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => {
                void q.refetch();
                void state.refetch();
              }}
              tintColor={colors.link}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 12 }}>
              <Txt
                style={{
                  color: colors.muted,
                  fontSize: 10,
                  letterSpacing: 1.5,
                }}
              >
                CONVERSATIONS · {rows.length} LOADED
              </Txt>
              <Notice
                message={q.error?.message || state.error?.message}
                onRetry={() => {
                  void q.refetch();
                  void state.refetch();
                }}
              />
            </View>
          }
          renderItem={({ item }) => {
            const unread = isUnread(item.fromEmail, item.createdAt);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  displayName(item.fromEmail) +
                  (unread ? ". Unread. " : ". ") +
                  (item.subject || "Conversation")
                }
                onPress={() =>
                  router.push({
                    pathname: "/conversation",
                    params: { email: item.fromEmail.toLowerCase() },
                  })
                }
                style={({ pressed }) => ({
                  padding: 16,
                  backgroundColor: pressed ? colors.inset : colors.panel,
                  borderRadius: 18,
                  marginBottom: 8,
                  flexDirection: "row",
                  gap: 13,
                })}
              >
                <View
                  style={{
                    height: 44,
                    width: 44,
                    borderRadius: 15,
                    backgroundColor: unread ? colors.soft : colors.inset,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt
                    weight="bold"
                    style={{ color: unread ? colors.link : colors.muted }}
                  >
                    {initials(item.fromEmail)}
                  </Txt>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 5,
                      alignItems: "center",
                    }}
                  >
                    <Txt numberOfLines={1} weight="bold" style={{ flex: 1 }}>
                      {displayName(item.fromEmail)}
                    </Txt>
                    <Txt
                      style={{
                        fontSize: 10,
                        color: unread ? colors.link : colors.muted,
                      }}
                    >
                      {timeLabel(item.createdAt)}
                    </Txt>
                  </View>
                  <Txt
                    numberOfLines={1}
                    weight={unread ? "medium" : "regular"}
                    style={{ fontSize: 12, color: colors.secondary }}
                  >
                    {item.subject || "No subject"}
                  </Txt>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Txt
                      numberOfLines={2}
                      style={{
                        flex: 1,
                        fontSize: 12,
                        lineHeight: 18,
                        color: colors.muted,
                      }}
                    >
                      {chatText(item.body || item.preview)}
                    </Txt>
                    {states.get(item.fromEmail.toLowerCase())?.starred && (
                      <Star size={12} color="#f9af03" fill="#f9af03" />
                    )}
                    {unread && (
                      <View
                        style={{
                          height: 7,
                          width: 7,
                          borderRadius: 4,
                          backgroundColor: colors.brand,
                        }}
                      />
                    )}
                  </View>
                </View>
                <ChevronRight
                  size={14}
                  color={colors.muted}
                  style={{ alignSelf: "center" }}
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            q.isPending ? (
              <Loading />
            ) : (
              <Card style={{ alignItems: "center", paddingVertical: 32 }}>
                <Inbox size={34} color={colors.muted} />
                <Txt weight="bold">
                  {search || filter !== "All"
                    ? "No matching conversations"
                    : "A fresh start"}
                </Txt>
                <Txt style={{ color: colors.muted, textAlign: "center" }}>
                  Replies from your connected workspace will appear here.
                </Txt>
              </Card>
            )
          }
          ListFooterComponent={
            <View style={{ gap: 12, paddingTop: 12 }}>
              {q.hasNextPage && rows.length < 100 && (
                <Button
                  title="Load more conversations"
                  secondary
                  busy={q.isFetchingNextPage}
                  onPress={() => void q.fetchNextPage()}
                />
              )}
              <Txt
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                Newest loaded replies first. Pull down to refresh.
                {rows.length === 100
                  ? "\nShowing 100 conversations; use the portal for older history."
                  : ""}
              </Txt>
            </View>
          }
        />
      )}
    </Screen>
  );
}
