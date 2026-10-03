"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  MessageSquare,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBox, Loading, PageTitle } from "@/components/data";
import { api } from "@/lib/browser-api";
import {
  aiCategories,
  knowledgeProgress,
  type AiProfile,
  type AiWorkspaceData,
} from "@/lib/ai-workspace";

export function AiConnectionNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`ai-connection ${compact ? "ai-connection--compact" : ""}`}>
      <span className="ai-state-dot" />
      <div>
        <strong>AI not connected</strong>
        <p>
          {compact
            ? "Prepare your workspace now. AI tools unlock after provider setup."
            : "Save your business knowledge and preferences now. Generation, automatic classification and priority alerts will become available after an AI provider is connected."}
        </p>
      </div>
    </div>
  );
}

const tabs = [
  ["knowledge", "Business knowledge", BookOpen],
  ["style", "Reply style", MessageSquare],
  ["inbox", "Smart inbox", SlidersHorizontal],
  ["alerts", "Priority alerts", Bell],
] as const;
type Tab = (typeof tabs)[number][0];
export function AiWorkspace({ previewId }: { previewId?: string }) {
  const [tab, setTab] = useState<Tab>("knowledge");
  const endpoint = previewId
    ? `/api/admin/clients/${previewId}/ai-workspace`
    : "/api/portal/ai-workspace";
  const q = useQuery<AiWorkspaceData>({
    queryKey: ["ai-workspace", endpoint],
    queryFn: () => api(endpoint),
    refetchOnWindowFocus: false,
  });
  const cache = useQueryClient();
  return (
    <div className="ai-workspace">
      <PageTitle
        eyebrow="YOUR OUTREACH ASSISTANT"
        title="AI Workspace"
        description="Your business context. Your voice. Ready for smarter conversations."
      />
      <section className="ai-hero">
        <div className="ai-hero-icon">
          <Sparkles size={27} />
        </div>
        <div>
          <span className="ai-kicker">BUILT AROUND YOUR BUSINESS</span>
          <h2>Give your assistant the right context.</h2>
          <p>Keep your offer, answers and writing preferences in one place.</p>
        </div>
        <span className="ai-phase">Setup mode</span>
      </section>
      <AiConnectionNotice />
      {q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : !q.data ? (
        <Loading />
      ) : (
        <>
          <div className="ai-workspace-tabs" aria-label="AI workspace sections">
            {tabs.map(([id, label, Icon]) => (
              <button
                type="button"
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
          <AiProfileForm
            key={q.data.revision}
            initial={q.data}
            tab={tab}
            preview={!!previewId}
            onSaved={(data) =>
              cache.setQueryData(["ai-workspace", endpoint], data)
            }
          />
        </>
      )}
    </div>
  );
}

function AiProfileForm({
  initial,
  tab,
  preview,
  onSaved,
}: {
  initial: AiWorkspaceData;
  tab: Tab;
  preview: boolean;
  onSaved: (value: AiWorkspaceData) => void;
}) {
  const [profile, setProfile] = useState(initial.profile),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dirty = JSON.stringify(profile) !== JSON.stringify(initial.profile);
  const editable = initial.canEdit && !preview;
  const completed = knowledgeProgress(profile);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function set<K extends keyof AiProfile>(key: K, value: AiProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setError("");
  }
  const textField = (
    key:
      | "business"
      | "offer"
      | "audience"
      | "pricing"
      | "faq"
      | "rules"
      | "signature",
    label: string,
    placeholder: string,
    maxLength: number,
    rows = 3,
  ) => (
    <label className="ai-field" key={key}>
      <span>{label}</span>
      <textarea
        name={key}
        value={profile[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
      />
      <small>
        {profile[key].length.toLocaleString()} / {maxLength.toLocaleString()}
      </small>
    </label>
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!editable || busy) return;
        setBusy(true);
        setError("");
        try {
          onSaved(
            await api("/api/portal/ai-workspace", {
              profile,
              revision: initial.revision,
            }),
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {!editable && (
        <p className="ai-readonly">
          {preview
            ? "Read-only client preview. Open the client workspace to edit setup."
            : "Your workspace owner or admin can update this setup."}
        </p>
      )}
      <div className="ai-profile-layout">
        <section className="ai-card">
          <fieldset disabled={!editable || busy} className="ai-fieldset">
            {tab === "knowledge" && (
              <>
                <div className="ai-card-heading">
                  <BookOpen size={20} />
                  <div>
                    <h2>Business knowledge</h2>
                    <p>
                      Add information your team has approved for prospect
                      conversations.
                    </p>
                  </div>
                </div>
                {textField(
                  "business",
                  "About your business",
                  "What does your company do, and what makes it different?",
                  4000,
                )}
                {textField(
                  "offer",
                  "Services & offer",
                  "Describe the service, deliverables and outcomes you can offer.",
                  4000,
                )}
                {textField(
                  "audience",
                  "Ideal customers",
                  "Who do you help? Include industries, company size and common problems.",
                  3000,
                )}
                {textField(
                  "pricing",
                  "Approved pricing",
                  "Packages, setup fees and any pricing you are comfortable sharing.",
                  3000,
                )}
                {textField(
                  "faq",
                  "Frequently asked questions",
                  "Q: How long does setup take?\nA: Add your approved answer here.",
                  6000,
                  5,
                )}
                <label className="ai-field">
                  <span>
                    Meeting booking link <small>Optional</small>
                  </span>
                  <input
                    name="bookingUrl"
                    type="url"
                    maxLength={500}
                    placeholder="https://your-booking-page.com"
                    value={profile.bookingUrl}
                    onChange={(e) => set("bookingUrl", e.target.value)}
                  />
                  <small>
                    Use an HTTPS link. It is saved as context; no meetings are
                    booked automatically.
                  </small>
                </label>
              </>
            )}
            {tab === "style" && (
              <>
                <div className="ai-card-heading">
                  <MessageSquare size={20} />
                  <div>
                    <h2>Make it sound like you</h2>
                    <p>Set the defaults for future AI-generated drafts.</p>
                  </div>
                </div>
                <label className="ai-field">
                  <span>Tone</span>
                  <select
                    value={profile.tone}
                    onChange={(e) =>
                      set("tone", e.target.value as AiProfile["tone"])
                    }
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly & warm</option>
                    <option value="direct">Direct & concise</option>
                  </select>
                </label>
                <label className="ai-field">
                  <span>Reply length</span>
                  <select
                    value={profile.length}
                    onChange={(e) =>
                      set("length", e.target.value as AiProfile["length"])
                    }
                  >
                    <option value="short">Short · get to the point</option>
                    <option value="balanced">
                      Balanced · a little more context
                    </option>
                    <option value="detailed">Detailed · explain fully</option>
                  </select>
                </label>
                <label className="ai-field">
                  <span>Reply language</span>
                  <select
                    value={profile.language}
                    onChange={(e) =>
                      set("language", e.target.value as AiProfile["language"])
                    }
                  >
                    {[
                      ["match", "Match the prospect’s language"],
                      ["english", "English"],
                      ["urdu", "Urdu"],
                      ["spanish", "Spanish"],
                      ["french", "French"],
                      ["german", "German"],
                      ["arabic", "Arabic"],
                    ].map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {textField(
                  "signature",
                  "Reply signature",
                  "Your name\nYour role · Company",
                  500,
                )}
                {textField(
                  "rules",
                  "Writing guidance",
                  "For example: avoid jargon, ask one question, never promise guaranteed results.",
                  3000,
                  5,
                )}
              </>
            )}
            {(tab === "inbox" || tab === "alerts") && (
              <>
                <div className="ai-card-heading">
                  {tab === "inbox" ? (
                    <SlidersHorizontal size={20} />
                  ) : (
                    <Bell size={20} />
                  )}
                  <div>
                    <h2>
                      {tab === "inbox"
                        ? "Define what matters"
                        : "Plan your priority alerts"}
                    </h2>
                    <p>
                      {tab === "inbox"
                        ? "Choose which reply categories should be highlighted when AI classification is available."
                        : "Save preferences for future AI alerts. These preferences are not active yet."}
                    </p>
                  </div>
                </div>
                <div className="ai-category-grid">
                  {aiCategories.map((category) => (
                    <label
                      className={`ai-category ${profile.priorityCategories.includes(category.id) ? "is-selected" : ""}`}
                      key={category.id}
                    >
                      <input
                        type="checkbox"
                        checked={profile.priorityCategories.includes(
                          category.id,
                        )}
                        onChange={(e) =>
                          set(
                            "priorityCategories",
                            e.target.checked
                              ? [...profile.priorityCategories, category.id]
                              : profile.priorityCategories.filter(
                                  (id) => id !== category.id,
                                ),
                          )
                        }
                      />
                      <span>
                        <strong>{category.label}</strong>
                        <small>{category.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
                {tab === "alerts" && (
                  <label className="ai-field">
                    <span>Future AI alert preference</span>
                    <select
                      value={profile.alertPreference}
                      onChange={(e) =>
                        set(
                          "alertPreference",
                          e.target.value as AiProfile["alertPreference"],
                        )
                      }
                    >
                      <option value="all">All new replies</option>
                      <option value="priority">Priority categories only</option>
                    </select>
                  </label>
                )}
                <div className="ai-help-note">
                  <ShieldCheck size={18} />
                  <p>
                    Classification, sorting and notification delivery stay
                    inactive in setup mode. Your existing inbox filters and
                    reply notifications continue to work.
                  </p>
                </div>
              </>
            )}
          </fieldset>
        </section>
        <aside className="ai-sidebar">
          <section className="ai-card">
            <span className="ai-kicker">KNOWLEDGE CHECKLIST</span>
            <h3>{completed} of 5 sections filled</h3>
            <div
              className="ai-progress"
              role="progressbar"
              aria-label="Knowledge sections filled"
              aria-valuenow={completed}
              aria-valuemin={0}
              aria-valuemax={5}
            >
              <span style={{ width: `${completed * 20}%` }} />
            </div>
            <p className="ai-caption">
              Completion tracks information added, not AI accuracy.
            </p>
            <ul className="ai-checklist">
              {[
                ["business", "Business overview"],
                ["offer", "Your offer"],
                ["audience", "Ideal customers"],
                ["pricing", "Approved pricing"],
                ["faq", "Common questions"],
              ].map(([key, label]) => (
                <li key={key}>
                  <span
                    className={profile[key as keyof AiProfile] ? "done" : ""}
                  >
                    {profile[key as keyof AiProfile] ? <Check size={13} /> : ""}
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </section>
          <section className="ai-card ai-guidance">
            <ShieldCheck size={21} />
            <h3>You stay in control</h3>
            <p>
              Future replies will be drafts for your review. Saving this setup
              does not send messages or launch campaigns.
            </p>
            <p>
              Keep passwords, API keys and private credentials out of business
              knowledge.
            </p>
          </section>
          {!preview && (
            <Link className="ai-back-link" href="/app/inbox">
              Go to inbox <ArrowUpRight size={16} />
            </Link>
          )}
        </aside>
      </div>
      <div className="ai-save-bar">
        <div role="status">
          {dirty
            ? "Unsaved changes"
            : initial.updatedAt
              ? `Setup saved · ${new Date(initial.updatedAt).toLocaleString()}`
              : "No setup saved yet"}
          <small>AI tools remain off until provider connection.</small>
        </div>
        {editable && (
          <Button type="submit" disabled={busy || !dirty}>
            <Save size={16} />
            {busy ? "Saving…" : "Save setup"}
          </Button>
        )}
      </div>
      {error && (
        <div className="ai-save-error">
          <ErrorBox error={error} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setProfile(initial.profile);
              setError("");
              window.location.reload();
            }}
          >
            Discard changes & reload saved setup
          </Button>
        </div>
      )}
    </form>
  );
}
