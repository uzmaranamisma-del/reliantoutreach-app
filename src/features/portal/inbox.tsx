"use client";
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  PageTitle,
  Refresh,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { api } from "@/lib/browser-api";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  MessageSquare,
  Send,
  ArrowDown,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useContext, useLive } from "./hooks";
import { draftKey, groupConversations } from "@/lib/conversations";

export function Inbox() {
  const { data: ctx } = useContext(),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(1),
    [cursor, setCursor] = useState(""),
    [historyCursor, setHistoryCursor] = useState(""),
    [selected, setSelected] = useState<any>(),
    [body, setBody] = useState(""),
    [replyKey, setReplyKey] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [showLatest, setShowLatest] = useState(false),
    threadRef = useRef<HTMLDivElement>(null),
    threadSize = useRef({ width: 0, height: 0 }),
    followLatest = useRef(true),
    [metaForm, setMetaForm] = useState({
      status: "OPEN",
      tags: "",
      notes: "",
      assigneeId: "",
    }),
    [metaBusy, setMetaBusy] = useState(false),
    [metaError, setMetaError] = useState("");
  const q = useLive(
    `/api/portal/inbox?page=${page}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}${filter ? `&status=${filter}` : ""}`,
    ctx?.poll.inbox || 15,
  );
  const draftStorageKey =
    ctx?.userId && ctx?.clientId && selected?.fromEmail
      ? draftKey(ctx.userId, ctx.clientId, selected.fromEmail)
      : undefined;
  function saveDraft(value: string) {
    setBody(value);
    if (!draftStorageKey) return;
    try {
      if (value)
        localStorage.setItem(
          draftStorageKey,
          JSON.stringify({ body: value, at: Date.now() }),
        );
      else localStorage.removeItem(draftStorageKey);
    } catch {
      setError(
        "Draft could not be saved on this device. Keep this chat open until sent.",
      );
    }
  }
  const history = useQuery({
    queryKey: ["thread", ctx?.clientId, selected?.fromEmail, historyCursor],
    queryFn: () =>
      api(
        `/api/portal/inbox/thread?email=${encodeURIComponent(selected.fromEmail)}&cursor=${encodeURIComponent(historyCursor)}`,
      ),
    enabled: !!selected,
    refetchInterval: historyCursor
      ? false
      : Math.max(10, ctx?.poll.inbox || 15) * 1000,
  });
  const meta = useQuery({
    queryKey: ["conversation-meta", ctx?.clientId, selected?.fromEmail],
    queryFn: () =>
      api(
        `/api/portal/inbox/meta?email=${encodeURIComponent(selected.fromEmail)}`,
      ),
    enabled: !!selected,
  });
  const threadMessages = (
    history.data?.items?.length
      ? history.data.items
      : selected
        ? [selected]
        : []
  )
    .slice()
    .sort(
      (a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  useEffect(() => {
    if (!historyCursor && followLatest.current && threadRef.current)
      threadRef.current.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: "instant",
      });
  }, [selected?.fromEmail, history.dataUpdatedAt, historyCursor]);
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const observer = new ResizeObserver(() => {
      threadSize.current = {
        width: thread.clientWidth,
        height: thread.clientHeight,
      };
      if (followLatest.current && !historyCursor) {
        thread.scrollTop = thread.scrollHeight;
      }
    });
    observer.observe(thread);
    return () => observer.disconnect();
  }, [selected?.fromEmail, historyCursor]);
  useEffect(() => {
    const record = meta.data?.meta;
    setMetaForm({
      status: record?.status || "OPEN",
      tags: Array.isArray(record?.tags) ? record.tags.join(", ") : "",
      notes: record?.notes || "",
      assigneeId: record?.assigneeId || "",
    });
    setMetaError("");
  }, [meta.data, selected?.fromEmail]);
  useEffect(() => {
    let value = "";
    try {
      const saved = draftStorageKey && localStorage.getItem(draftStorageKey);
      const draft = saved ? JSON.parse(saved) : undefined;
      if (draft && Date.now() - draft.at < 7 * 86400000)
        value = draft.body || "";
      else if (draftStorageKey) localStorage.removeItem(draftStorageKey);
    } catch {
      /* A missing or damaged draft must not block the inbox. */
    }
    setBody(value);
    setError("");
  }, [draftStorageKey]);
  async function saveMeta() {
    if (!selected) return;
    setMetaBusy(true);
    setMetaError("");
    try {
      await api("/api/portal/inbox/meta", {
        email: selected.fromEmail,
        status: metaForm.status,
        tags: metaForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: metaForm.notes,
        assigneeId: metaForm.assigneeId || null,
      });
      await meta.refetch();
    } catch (e) {
      setMetaError((e as Error).message);
    } finally {
      setMetaBusy(false);
    }
  }
  return (
    <>
      <div className="inbox-page-title">
        <PageTitle
          eyebrow="CONVERSATIONS"
          title="Inbox"
          description="Keep every conversation within reach."
        >
          <Refresh
            onClick={() => {
              q.refetch();
              if (selected) history.refetch();
            }}
            busy={q.isFetching}
          />
        </PageTitle>
      </div>
      <div className={`inbox-layout ${selected ? "inbox-thread-open" : ""}`}>
        <aside className="inbox-filters">
          <h3>Conversations</h3>
          {[
            ["", "All replies"],
            ["Interested", "Interested"],
            ["NotInterested", "Not interested"],
            ["MaybeLater", "Maybe later"],
            ["MeetingBooked", "Meeting booked"],
            ["AutoReply", "Auto reply"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={v === filter ? "selected" : ""}
              onClick={() => {
                setFilter(v);
                setPage(1);
                setCursor("");
                setSelected(undefined);
              }}
            >
              <MessageSquare size={16} />
              {l}
            </button>
          ))}
        </aside>
        <div className="conversation-list">
          <div className="conversation-list-header">
            <strong>Replies</strong>
            <small>
              {q.isFetching
                ? "Refreshing…"
                : q.dataUpdatedAt
                  ? `Updated ${new Date(q.dataUpdatedAt).toLocaleTimeString()}`
                  : "Loading…"}
            </small>
          </div>
          {q.error ? (
            <ErrorBox error={q.error} />
          ) : q.isLoading ? (
            <Loading />
          ) : q.data?.items.length ? (
            groupConversations(q.data.items).map((m: any) => (
              <button
                className={`conversation ${selected?.fromEmail === m.fromEmail ? "selected" : ""}`}
                key={m.id}
                onClick={() => {
                  setSelected(m);
                  setShowLatest(false);
                  followLatest.current = true;
                  setHistoryCursor("");
                  setReplyKey(crypto.randomUUID());
                }}
              >
                <span className="conversation-avatar">
                  {m.fromEmail?.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{m.fromEmail}</strong>
                  <b>{m.subject}</b>
                  <p>{m.preview}</p>
                  <small>{new Date(m.createdAt).toLocaleString()}</small>
                </div>
              </button>
            ))
          ) : (
            <Empty
              title="No replies yet"
              description="Incoming replies will appear here."
            />
          )}
          <div className="table-footer">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 1}
              onClick={() => {
                setPage(1);
                setCursor("");
              }}
            >
              First page
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!q.data?.pagination.nextCursor}
              onClick={() => {
                setCursor(q.data.pagination.nextCursor);
                setPage(page + 1);
              }}
            >
              Next
            </Button>
          </div>
        </div>
        <section className="conversation-detail">
          {!selected ? (
            <Empty
              title="Your next conversation"
              description="Select a reply to read the thread and respond."
            />
          ) : (
            <>
              <div className="conversation-head">
                <Button
                  className="mobile-inbox-back"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(undefined)}
                >
                  <ArrowLeft size={18} />
                  <span>Back to replies</span>
                </Button>
                <div className="chat-identity">
                  <span className="conversation-avatar">
                    {selected.fromEmail?.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h2>{selected.fromEmail}</h2>
                    <p>{selected.subject}</p>
                  </div>
                </div>
                <details className="conversation-options">
                  <summary>
                    <SlidersHorizontal size={17} />
                    <span>Conversation details</span>
                  </summary>
                  <fieldset
                    className="conversation-controls"
                    disabled={
                      !ctx?.permissions["inbox.manage"] ||
                      meta.isLoading ||
                      metaBusy
                    }
                    style={{ border: 0, padding: 0, margin: 0 }}
                  >
                    <Field
                      name="conversation-status"
                      label="Status"
                      value={metaForm.status}
                      onChange={(value) =>
                        setMetaForm({ ...metaForm, status: value })
                      }
                      options={[
                        { value: "OPEN", label: "Open" },
                        { value: "NEEDS_REPLY", label: "Needs reply" },
                        { value: "MEETING", label: "Meeting" },
                        { value: "NOT_INTERESTED", label: "Not interested" },
                        { value: "CLOSED", label: "Closed" },
                      ]}
                    />
                    <Field
                      name="conversation-assignee"
                      label="Assigned to"
                      value={metaForm.assigneeId}
                      onChange={(value) =>
                        setMetaForm({ ...metaForm, assigneeId: value })
                      }
                      options={[
                        { value: "", label: "Unassigned" },
                        ...(meta.data?.members || []).map((member: any) => ({
                          value: member.userId,
                          label: `${member.user.name} · ${member.user.email}`,
                        })),
                      ]}
                    />
                    <label>
                      Tags
                      <input
                        value={metaForm.tags}
                        onChange={(event) =>
                          setMetaForm({ ...metaForm, tags: event.target.value })
                        }
                        placeholder="Hot, Follow-up"
                      />
                    </label>
                    <label className="conversation-notes">
                      Internal notes
                      <textarea
                        value={metaForm.notes}
                        onChange={(event) =>
                          setMetaForm({
                            ...metaForm,
                            notes: event.target.value,
                          })
                        }
                        rows={2}
                        placeholder="Notes for your team"
                      />
                    </label>
                    {metaError && <ErrorBox error={metaError} />}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        metaBusy ||
                        meta.isLoading ||
                        !ctx?.permissions["inbox.manage"]
                      }
                      onClick={saveMeta}
                    >
                      <Check size={14} />
                      {metaBusy ? "Saving…" : "Save conversation"}
                    </Button>
                  </fieldset>
                </details>
              </div>
              <div
                className="thread-messages"
                ref={threadRef}
                onScroll={(event) => {
                  const thread = event.currentTarget;
                  // Resizing for the keyboard is not a request to stop following replies.
                  if (
                    thread.clientWidth !== threadSize.current.width ||
                    thread.clientHeight !== threadSize.current.height
                  )
                    return;
                  followLatest.current =
                    thread.scrollHeight -
                      thread.scrollTop -
                      thread.clientHeight <
                    80;
                  setShowLatest(!followLatest.current);
                }}
              >
                <div className="form-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!historyCursor}
                    onClick={() => {
                      followLatest.current = true;
                      setHistoryCursor("");
                    }}
                  >
                    Latest messages
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      !history.data?.pagination?.nextCursor ||
                      history.isFetching
                    }
                    onClick={() =>
                      setHistoryCursor(
                        String(history.data.pagination.nextCursor),
                      )
                    }
                  >
                    Older messages
                  </Button>
                </div>
                {history.error && <ErrorBox error={history.error} />}{" "}
                {threadMessages.map((m: any) => (
                  <article
                    className={`message ${m.fromEmail?.toLowerCase() === selected.fromEmail?.toLowerCase() ? "incoming" : "outgoing"}`}
                    key={m.id}
                  >
                    <div className="message-bubble">
                      <div className="message-meta">
                        <strong>
                          {m.fromEmail?.toLowerCase() ===
                          selected.fromEmail?.toLowerCase()
                            ? m.fromEmail
                            : "You"}
                        </strong>
                        <small>{new Date(m.createdAt).toLocaleString()}</small>
                      </div>
                      <div
                        className="email-content"
                        dangerouslySetInnerHTML={{ __html: m.body || "" }}
                      />
                    </div>
                  </article>
                ))}
              </div>
              {showLatest && (
                <button
                  className="jump-latest"
                  aria-label="Jump to latest message"
                  onClick={() => {
                    followLatest.current = true;
                    setHistoryCursor("");
                    threadRef.current?.scrollTo({
                      top: threadRef.current.scrollHeight,
                      behavior: "smooth",
                    });
                  }}
                >
                  <ArrowDown size={18} /> Latest
                </button>
              )}
              {ctx?.permissions["inbox.reply"] && (
                <div className="reply-composer">
                  <label htmlFor="reply">Reply to {selected.fromEmail}</label>
                  <div className="composer-input-row">
                    <textarea
                      id="reply"
                      value={body}
                      onChange={(e) => {
                        saveDraft(e.target.value);
                        setReplyKey(crypto.randomUUID());
                      }}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          if (body.trim() && !busy) setConfirm(true);
                        }
                      }}
                      rows={2}
                      placeholder="Write a reply…"
                    />
                    <Button
                      className="composer-send"
                      aria-label="Send reply"
                      title="Send reply (Ctrl+Enter)"
                      disabled={!body.trim() || busy}
                      onClick={() => setConfirm(true)}
                    >
                      <Send size={19} />
                      <span>Send</span>
                    </Button>
                  </div>
                  {error && <ErrorBox error={error} />}
                  <small className="muted composer-note">
                    Drafts stay on this device · Ctrl+Enter to send
                  </small>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Send this reply?"
        description={
          selected
            ? `Your reply will be sent to ${selected.fromEmail}.`
            : undefined
        }
      >
        <p className="preserve-whitespace">{body}</p>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const escaped = body
                  .replaceAll("&", "&amp;")
                  .replaceAll("<", "&lt;")
                  .replaceAll(">", "&gt;")
                  .replaceAll("\n", "<br>");
                await api("/api/portal/inbox/reply", {
                  id: selected.id,
                  body: `<p>${escaped}</p>`,
                  confirm: true,
                  key: replyKey,
                });
                saveDraft("");
                setReplyKey(crypto.randomUUID());
                setConfirm(false);
                history.refetch();
                q.refetch();
              } catch (e) {
                setError((e as Error).message);
                setConfirm(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Sending…" : "Confirm & send"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
