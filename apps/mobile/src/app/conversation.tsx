import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Send, Star } from "lucide-react-native";
import { api, ApiError } from "../lib/api";
import { useSession, queryClient } from "../lib/session";
import type { ConversationState, MessagePage, Message } from "../lib/types";
import {
  displayName,
  newestMessages,
  plainText,
  replyHtml,
  timeLabel,
} from "../lib/messages";
import { drafts } from "../lib/drafts";
import { useTheme } from "../ui/theme";
import {
  Button,
  Header,
  Input,
  Loading,
  Notice,
  Screen,
  Txt,
} from "../ui/components";
import { Confirm } from "../ui/confirm";
export default function Conversation() {
  const params = useLocalSearchParams<{ email: string }>(),
    email = typeof params.email === "string" ? params.email.toLowerCase() : "";
  const { context } = useSession(),
    { colors } = useTheme(),
    insets = useSafeAreaInsets();
  const scope = [context?.user.id, context?.client.id, email].join(":"),
    draft = drafts.get(scope);
  const [text, setText] = useState(draft?.text || ""),
    [uncertain, setUncertain] = useState(!!draft?.uncertain),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [atBottom, setAtBottom] = useState(true);
  const requestKey = useRef<string | undefined>(draft?.key),
    listRef = useRef<FlatList<Message>>(null);
  const valid = !!context && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const q = useInfiniteQuery({
    queryKey: ["thread", scope],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      api<MessagePage>(
        "/api/mobile/inbox/thread?email=" +
          encodeURIComponent(email) +
          (pageParam ? "&cursor=" + encodeURIComponent(pageParam) : ""),
        undefined,
        signal,
      ),
    enabled: valid,
    getNextPageParam: (last, pages, cursor, cursors) =>
      last.items.length &&
      last.pagination?.nextCursor &&
      last.pagination.nextCursor !== cursor &&
      !cursors.includes(last.pagination.nextCursor) &&
      pages.length < 100
        ? last.pagination.nextCursor
        : undefined,
  });
  const messages = useMemo(() => newestMessages(q.data?.pages || []), [q.data]);
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = q;
  useEffect(() => {
    if (hasNextPage && !isFetching && !isFetchNextPageError)
      void fetchNextPage();
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);
  const state = useQuery({
    queryKey: ["thread-state", scope],
    queryFn: () =>
      api<{ items: ConversationState[] }>(
        "/api/mobile/conversation-state?email=" + encodeURIComponent(email),
      ),
    enabled: valid,
  });
  useEffect(() => {
    if (valid && q.data)
      void api("/api/mobile/conversation-state", { email, read: true })
        .then(() =>
          queryClient.invalidateQueries({ queryKey: ["conversation-state"] }),
        )
        .catch(() => {});
  }, [email, valid, q.data]);
  useEffect(() => {
    if (text) drafts.set(scope, { text, key: requestKey.current, uncertain });
    else drafts.delete(scope);
  }, [text, uncertain, scope]);
  const latestReply = messages.find(
    (m) => m.fromEmail?.toLowerCase() === email,
  );
  async function send() {
    if (!latestReply || !text.trim()) return;
    setBusy(true);
    setError("");
    requestKey.current ||= Crypto.randomUUID();
    drafts.set(scope, { text, key: requestKey.current, uncertain: true });
    try {
      await api("/api/mobile/reply", {
        id: latestReply.id,
        body: replyHtml(text),
        key: requestKey.current,
        confirm: true,
      });
      setText("");
      requestKey.current = undefined;
      setUncertain(false);
      setConfirm(false);
      drafts.delete(scope);
      await q.refetch();
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (e) {
      setError((e as Error).message);
      setConfirm(false);
      if (
        !(e instanceof ApiError) ||
        e.status === 0 ||
        e.status >= 500 ||
        e.status === 409
      )
        setUncertain(true);
      else requestKey.current = undefined;
    } finally {
      setBusy(false);
    }
  }
  async function toggleStar() {
    try {
      await api("/api/mobile/conversation-state", {
        email,
        starred: !state.data?.items[0]?.starred,
      });
      await state.refetch();
      void queryClient.invalidateQueries({ queryKey: ["conversation-state"] });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!context) return <Redirect href="/login" />;
  if (!valid)
    return (
      <Screen>
        <Header title="Conversation" back />
        <Notice message="This conversation link is invalid." />
      </Screen>
    );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen scroll={false}>
        <View
          style={{
            padding: 18,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            gap: 10,
          }}
        >
          <Header title={displayName(email)} subtitle={email} back />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Txt
              numberOfLines={1}
              style={{ flex: 1, color: colors.muted, fontSize: 11 }}
            >
              {latestReply?.subject || "Conversation"}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                state.data?.items[0]?.starred
                  ? "Unstar conversation"
                  : "Star conversation"
              }
              onPress={() => void toggleStar()}
              style={{
                minHeight: 44,
                minWidth: 44,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Star
                size={19}
                color={state.data?.items[0]?.starred ? "#f9af03" : colors.muted}
                fill={state.data?.items[0]?.starred ? "#f9af03" : "transparent"}
              />
            </Pressable>
          </View>
        </View>
        {q.isPending ? (
          <Loading />
        ) : (
          <FlatList
            ref={listRef}
            inverted
            data={messages}
            keyExtractor={(m) => m.key || m.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 18, gap: 14 }}
            onScroll={(e) => setAtBottom(e.nativeEvent.contentOffset.y < 80)}
            scrollEventThrottle={100}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const outgoing = item.fromEmail?.toLowerCase() !== email;
              return (
                <View
                  style={{
                    alignSelf: outgoing ? "flex-end" : "flex-start",
                    maxWidth: "91%",
                    minWidth: 110,
                    padding: 15,
                    borderRadius: 20,
                    borderBottomRightRadius: outgoing ? 5 : 20,
                    borderBottomLeftRadius: outgoing ? 20 : 5,
                    backgroundColor: outgoing ? colors.brand : colors.panel,
                    borderWidth: outgoing ? 0 : 1,
                    borderColor: colors.line,
                    gap: 9,
                  }}
                >
                  <Txt
                    selectable
                    style={{
                      color: outgoing ? "#fff" : colors.text,
                      fontSize: 14,
                      lineHeight: 23,
                    }}
                  >
                    {plainText(item.body || item.preview) ||
                      "This message has no text content."}
                  </Txt>
                  <Txt
                    style={{
                      color: outgoing ? "#c8d1ff" : colors.muted,
                      fontSize: 10,
                      textAlign: "right",
                    }}
                  >
                    {outgoing ? "Sent · " : ""}
                    {timeLabel(item.createdAt)}
                  </Txt>
                </View>
              );
            }}
            ListEmptyComponent={
              <Txt style={{ color: colors.muted, textAlign: "center" }}>
                No messages found.
              </Txt>
            }
            ListFooterComponent={
              q.hasNextPage ? (
                <Button
                  title="Load more history"
                  secondary
                  busy={q.isFetchingNextPage}
                  onPress={() => void q.fetchNextPage()}
                />
              ) : null
            }
          />
        )}
        {!atBottom && (
          <View style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
            <Button
              title="↓ Latest message"
              secondary
              onPress={() =>
                listRef.current?.scrollToOffset({ offset: 0, animated: true })
              }
            />
          </View>
        )}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            gap: 10,
            backgroundColor: colors.panel,
            borderTopColor: colors.line,
            borderTopWidth: 1,
          }}
        >
          <Notice
            message={error || q.error?.message}
            onRetry={q.error ? () => void q.refetch() : undefined}
          />
          {uncertain ? (
            <View style={{ gap: 8 }}>
              <Txt style={{ fontSize: 12, color: colors.muted }}>
                Delivery is unconfirmed. Refresh before sending again. Your
                draft is kept; it has not been automatically resent.
              </Txt>
              <Button
                title="Refresh conversation"
                secondary
                busy={q.isRefetching}
                onPress={() => void q.refetch()}
              />
              <Button
                title="I checked — start a new reply"
                secondary
                onPress={() => {
                  setUncertain(false);
                  setText("");
                  requestKey.current = undefined;
                }}
              />
            </View>
          ) : (
            <View
              style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}
            >
              <Input
                accessibilityLabel="Reply message"
                placeholder={
                  context.permissions["inbox.reply"]
                    ? "Write your reply…"
                    : "Reply access is not enabled"
                }
                editable={!!context.permissions["inbox.reply"] && !busy}
                multiline
                maxLength={10000}
                value={text}
                onChangeText={setText}
                style={{ flex: 1, maxHeight: 150, minHeight: 50 }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Review and send reply"
                disabled={
                  !text.trim() ||
                  !latestReply ||
                  busy ||
                  !context.permissions["inbox.reply"]
                }
                onPress={() => setConfirm(true)}
                style={{
                  width: 50,
                  height: 50,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 16,
                  backgroundColor: colors.brand,
                  opacity:
                    !text.trim() ||
                    !latestReply ||
                    busy ||
                    !context.permissions["inbox.reply"]
                      ? 0.4
                      : 1,
                }}
              >
                <Send size={20} color="#fff" />
              </Pressable>
            </View>
          )}
        </View>
        <Confirm
          open={confirm}
          title="Send this reply?"
          action="Send reply"
          busy={busy}
          onCancel={() => setConfirm(false)}
          onConfirm={() => void send()}
        >
          <Txt>To {email}</Txt>
          <Txt numberOfLines={5} style={{ color: colors.muted }}>
            {text}
          </Txt>
          <Txt style={{ color: colors.muted, fontSize: 12 }}>
            This sends a live email through your connected workspace.
          </Txt>
        </Confirm>
      </Screen>
    </KeyboardAvoidingView>
  );
}
