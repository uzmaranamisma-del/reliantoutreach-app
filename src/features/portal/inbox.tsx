"use client";
import {
  Empty,
  ErrorBox,
  Loading,
  PageTitle,
  Refresh,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { api } from "@/lib/browser-api";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useContext, useLive } from "./hooks";

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
    threadRef = useRef<HTMLDivElement>(null);
  const q = useLive(
    `/api/portal/inbox?page=${page}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}${filter ? `&status=${filter}` : ""}`,
    ctx?.poll.inbox || 15,
  );
  const history = useQuery({
    queryKey: ["thread", selected?.fromEmail, historyCursor],
    queryFn: () =>
      api(
        `/api/portal/inbox/thread?email=${encodeURIComponent(selected.fromEmail)}&cursor=${encodeURIComponent(historyCursor)}`,
      ),
    enabled: !!selected,
    refetchInterval: historyCursor
      ? false
      : Math.max(10, ctx?.poll.inbox || 15) * 1000,
  });
  const threadMessages = (history.data?.items?.length
    ? history.data.items
    : selected
      ? [selected]
      : []
  ).slice().sort(
    (a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  useEffect(() => {
    if (!historyCursor && threadRef.current)
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [selected?.fromEmail, history.dataUpdatedAt, historyCursor]);
  return (
    <>
      <PageTitle
        eyebrow="CONVERSATIONS"
        title="Inbox"
        description="Keep every conversation within reach."
      >
        <Refresh
          onClick={() => {
            q.refetch();
            history.refetch();
          }}
          busy={q.isFetching}
        />
      </PageTitle>
      <div className="inbox-layout">
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
            [...q.data.items]
              .sort(
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              )
              .map((m: any) => (
              <button
                className={`conversation ${selected?.fromEmail === m.fromEmail ? "selected" : ""}`}
                key={m.id}
                onClick={() => {
                  setSelected(m);
                  setHistoryCursor("");
                  setBody("");
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
                <h2>{selected.subject}</h2>
                <p>{selected.fromEmail}</p>
              </div>
              <div className="thread-messages" ref={threadRef}>
                <div className="form-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!historyCursor}
                    onClick={() => setHistoryCursor("")}
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
              {ctx?.permissions["inbox.reply"] && (
                <div className="reply-composer">
                  <label htmlFor="reply">Reply to {selected.fromEmail}</label>
                  <textarea
                    id="reply"
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      setReplyKey(crypto.randomUUID());
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (body.trim() && !busy) setConfirm(true);
                      }
                    }}
                    rows={5}
                    placeholder="Write a message… (Ctrl+Enter to send)"
                  />
                  {error && <ErrorBox error={error} />}
                  <div className="form-actions">
                    <Button
                      disabled={!body.trim() || busy}
                      onClick={() => setConfirm(true)}
                    >
                      <Send size={15} />
                      Send reply
                    </Button>
                  </div>
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
                setBody("");
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
