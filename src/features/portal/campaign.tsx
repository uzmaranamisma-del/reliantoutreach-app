"use client";
import {
  DataTable,
  Empty,
  ErrorBox,
  Field,
  Loading,
  PageTitle,
  Refresh,
  Status,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { api } from "@/lib/browser-api";
import {
  ArrowLeft,
  Copy,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Analytics } from "./analytics";
import { columnsByKind } from "./config";
import { useContext, useLive } from "./hooks";
import { ImportForm } from "./imports";
import { ResourceEditor } from "./resources";
import { EnrollmentForm } from "./enrollment";

export function CampaignDetail({ id }: { id: string }) {
  const { data: ctx } = useContext(),
    q = useLive(`/api/portal/campaigns/${id}`, 0),
    [tab, setTab] = useState("Overview"),
    [edit, setEdit] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [enrollOpen, setEnrollOpen] = useState(false),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const c = q.data;
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  async function action(name: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/portal/campaigns/${id}/${name}`, {
        confirm: true,
        key: crypto.randomUUID(),
        name: `${c.name} (copy)`,
      });
      setConfirm("");
      q.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/app/campaigns" className="back-link">
        <ArrowLeft size={16} />
        All campaigns
      </Link>
      <PageTitle title={c.name} description="Campaign workspace">
        <Status value={c.status} />
        <Refresh onClick={() => q.refetch()} />
        {ctx?.permissions["campaigns.edit"] && (
          <Button variant="outline" onClick={() => setEdit(true)}>
            <Pencil size={15} />
            Edit campaign
          </Button>
        )}
        {c.status === "Running"
          ? ctx?.permissions["campaigns.pause"] && (
              <Button
                variant="outline"
                onClick={() => action("pause")}
                disabled={busy}
              >
                <Pause size={15} />
                Pause
              </Button>
            )
          : ctx?.permissions["campaigns.start"] && (
              <Button onClick={() => setConfirm("start")}>
                <Play size={15} />
                Start campaign
              </Button>
            )}
      </PageTitle>
      {error && <ErrorBox error={error} />}
      <div className="tabs">
        {[
          "Overview",
          "Sequence",
          "Prospects",
          "Senders",
          "Analytics",
          "Settings",
          "Activity",
        ]
          .filter(
            (t) => t !== "Analytics" || ctx?.permissions["analytics.view"],
          )
          .map((t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
      </div>
      {tab === "Overview" && (
        <>
          <div className="metric-grid">
            {[
              ["Emails sent", c.sentCount],
              ["Replies", c.replyCount],
              [
                "Reply rate",
                c.sentCount
                  ? `${((c.replyCount / c.sentCount) * 100).toFixed(1)}%`
                  : "—",
              ],
              ["Bounces", c.bounceCount],
            ].map(([label, value]) => (
              <div className="metric-card" key={label}>
                <span>{label}</span>
                <strong>{value ?? "—"}</strong>
                <small>All time</small>
              </div>
            ))}
          </div>
          <div className="panel content-panel">
            <h2>Initial email</h2>
            <p className="muted">{c.subject || "No subject yet"}</p>
            <div
              className="email-content"
              dangerouslySetInnerHTML={{ __html: c.body || "" }}
            />
          </div>
        </>
      )}
      {tab === "Sequence" && (
        <SequenceEditor
          campaign={id}
          canEdit={ctx?.permissions["sequences.edit"]}
        />
      )}{" "}
      {tab === "Prospects" && (
        <>
          <div className="section-title">
            <h2>Campaign prospects</h2>
            {ctx?.permissions["prospects.import"] &&
              ctx?.permissions["lists.manage"] && (
                <Button variant="outline" onClick={() => setEnrollOpen(true)}>
                  Enroll existing list
                </Button>
              )}
            {ctx?.permissions["prospects.import"] && (
              <Button onClick={() => setImportOpen(true)}>
                <Upload size={16} />
                Import prospects
              </Button>
            )}
          </div>
          <CampaignProspects id={id} />
        </>
      )}
      {tab === "Senders" && (
        <div className="panel content-panel">
          <h2>Selected senders</h2>
          {String(c.fromEmails || "")
            .split(",")
            .filter(Boolean)
            .map((email: string) => (
              <div className="sender-line" key={email}>
                <Mail size={18} />
                {email}
              </div>
            ))}
        </div>
      )}
      {tab === "Analytics" && <Analytics campaign={id} />}{" "}
      {tab === "Settings" && (
        <div className="panel content-panel">
          <h2>Sending settings</h2>
          <dl className="detail-grid">
            {[
              ["Daily limit", c.dailyLimit],
              ["Limit applies to", c.dailyLimitPer],
              ["Timezone", c.scheduleTimeZone],
              ["Open tracking", c.trackOpens ? "On" : "Off"],
              ["Click tracking", c.trackClicks ? "On" : "Off"],
              ["Sending delay", `${c.delayMinSeconds ?? "—"} seconds`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {ctx?.permissions["campaigns.create"] && (
            <Button variant="outline" onClick={() => action("duplicate")}>
              <Copy size={15} />
              Duplicate as draft
            </Button>
          )}
        </div>
      )}
      {tab === "Activity" && <CampaignActivity />}
      <Modal open={edit} onOpenChange={setEdit} title="Edit campaign" wide>
        <ResourceEditor
          kind="campaigns"
          record={c}
          onClose={() => setEdit(false)}
          onDone={() => {
            setEdit(false);
            q.refetch();
          }}
        />
      </Modal>
      <Modal
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        title="Enroll list prospects"
      >
        <EnrollmentForm
          campaign={id}
          onDone={() => {
            setEnrollOpen(false);
            q.refetch();
          }}
        />
      </Modal>
      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Add campaign prospects"
        wide
      >
        <ImportForm campaign={id} onDone={() => setImportOpen(false)} />
      </Modal>
      <Modal
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm("")}
        title="Start campaign?"
        description="Outreach will begin according to the configured schedule."
      >
        <h3>{c.name}</h3>
        <p>
          {c.prospectCount || 0} prospects ·{" "}
          {
            String(c.fromEmails || "")
              .split(",")
              .filter(Boolean).length
          }{" "}
          senders
        </p>
        {ctx?.limits.monthlyEmails !== -1 && (
          <p className="notice">
            Sending is unavailable with this package’s monthly cap. Contact your
            administrator.
          </p>
        )}
        <div className="form-actions">
          <Button variant="outline" onClick={() => setConfirm("")}>
            Cancel
          </Button>
          <Button onClick={() => action("start")} disabled={busy}>
            Confirm & start campaign
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function CampaignActivity() {
  const q = useLive("/api/portal/overview");
  return (
    <div className="panel content-panel">
      <p className="muted">Recent workspace activity</p>
      {q.data?.activity?.map((a: any) => (
        <div className="activity-item" key={a.id}>
          {a.action} <small>{new Date(a.createdAt).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}

export function CampaignProspects({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const q = useLive(`/api/portal/prospects?campaign=${id}&page=${page}`);
  return (
    <DataTable
      rows={q.data?.items || []}
      columns={columnsByKind.prospects}
      loading={q.isLoading}
      error={q.error}
      page={page}
      total={q.data?.pagination.totalItems}
      onPage={setPage}
    />
  );
}

export function SequenceEditor({
  campaign,
  canEdit,
}: {
  campaign: string;
  canEdit: boolean;
}) {
  const q = useLive(`/api/portal/campaigns/${campaign}/sequences`),
    [sequenceForm, setSequenceForm] = useState<any>(),
    [deletion, setDeletion] = useState<any>(),
    [form, setForm] = useState<any>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const mutate = async (action: string, data: any) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/portal/campaigns/${campaign}/sequences`, {
        action,
        key: crypto.randomUUID(),
        ...data,
      });
      setForm(undefined);
      setSequenceForm(undefined);
      setDeletion(undefined);
      q.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="section-title">
        <div>
          <h2>Follow-up sequences</h2>
          <p className="muted">
            Follow-ups are sent after the initial campaign email.
          </p>
        </div>
        {canEdit && (
          <Button
            disabled={busy}
            onClick={() =>
              setSequenceForm({
                data: {
                  name: "Follow-up sequence",
                  conditionReply: "NotReplied",
                  conditionExtra: false,
                  conditionNegate: false,
                  conditionTimes: 1,
                  conditionAction: "Opened",
                  conditionOperator: "GreaterThanOrEqual",
                },
              })
            }
          >
            <Plus size={16} />
            Add sequence
          </Button>
        )}
      </div>
      {error && <ErrorBox error={error} />}{" "}
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : !q.data?.items.length ? (
        <div className="panel">
          <Empty
            title="One email, for now"
            description="Add a sequence to build follow-ups for this campaign."
          />
        </div>
      ) : (
        q.data.items.map((s: any) => (
          <section className="panel sequence-panel" key={s.id}>
            <div className="section-title">
              <h3>{s.name || "Sequence"}</h3>
              <Status value={s.conditionReply} />
              {canEdit && (
                <div className="row-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSequenceForm({
                        sequenceId: s.id,
                        version: s.version,
                        data: {
                          name: s.name,
                          conditionReply: s.conditionReply,
                          conditionExtra: s.conditionExtra || false,
                          conditionNegate: s.conditionNegate || false,
                          conditionTimes: s.conditionTimes ?? 1,
                          conditionAction: s.conditionAction || "Opened",
                          conditionOperator:
                            s.conditionOperator || "GreaterThanOrEqual",
                        },
                      })
                    }
                  >
                    Edit conditions
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDeletion({
                        action: "delete-sequence",
                        sequenceId: s.id,
                        version: s.version,
                      })
                    }
                  >
                    Delete sequence
                  </Button>
                </div>
              )}
            </div>
            {s.followups.map((f: any, i: number) => (
              <div className="sequence-step" key={f.id}>
                <span className="step-number">{i + 1}</span>
                <div>
                  <small>
                    Wait {f.waitMin} {f.waitUnits}
                  </small>
                  <h3>{f.subject || "Use original subject"}</h3>
                  <div
                    className="email-content"
                    dangerouslySetInnerHTML={{ __html: f.body || "" }}
                  />
                </div>
                {canEdit && (
                  <>
                    <Button
                      aria-label="Edit follow-up"
                      variant="ghost"
                      onClick={() =>
                        setForm({
                          sequenceId: s.id,
                          followupId: f.id,
                          version: f.version,
                          data: {
                            subject: f.subject || "",
                            body: f.body || "",
                            waitMin: f.waitMin,
                            waitUnits: f.waitUnits,
                          },
                        })
                      }
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDeletion({
                          action: "delete",
                          sequenceId: s.id,
                          followupId: f.id,
                          version: f.version,
                        })
                      }
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            ))}
            {canEdit && (
              <Button
                variant="outline"
                onClick={() =>
                  setForm({
                    sequenceId: s.id,
                    data: {
                      subject: "",
                      body: "",
                      waitMin: 3,
                      waitUnits: "Days",
                      useOriginalSubject: true,
                      sendInSameThread: true,
                    },
                  })
                }
              >
                <Plus size={16} />
                Add follow-up
              </Button>
            )}
          </section>
        ))
      )}
      <Modal
        open={!!deletion}
        onOpenChange={(v) => !v && setDeletion(undefined)}
        title="Delete this sequence step?"
      >
        <p>
          This removes the selected{" "}
          {deletion?.action === "delete-sequence"
            ? "sequence and its follow-ups"
            : "follow-up"}{" "}
          from the campaign.
        </p>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setDeletion(undefined)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() =>
              mutate(deletion.action, { ...deletion, confirm: true })
            }
          >
            Delete
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!sequenceForm}
        onOpenChange={(v) => !v && setSequenceForm(undefined)}
        title="Sequence conditions"
      >
        {sequenceForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate(
                sequenceForm.sequenceId ? "edit-sequence" : "create",
                sequenceForm,
              );
            }}
          >
            <Field
              name="sequenceName"
              label="Sequence name"
              value={sequenceForm.data.name}
              onChange={(name) =>
                setSequenceForm({
                  ...sequenceForm,
                  data: { ...sequenceForm.data, name },
                })
              }
            />
            <Field
              name="conditionReply"
              label="Enter sequence when"
              value={sequenceForm.data.conditionReply}
              onChange={(conditionReply) =>
                setSequenceForm({
                  ...sequenceForm,
                  data: { ...sequenceForm.data, conditionReply },
                })
              }
              options={[
                "All",
                "Opened",
                "NotOpened",
                "NotReplied",
                "Replied",
                "RepliedInterested",
                "RepliedNotInterested",
                "RepliedNeutral",
                "RepliedMaybeLater",
                "Converted",
                "NotConverted",
                "Won",
                "MeetingBooked",
                "MeetingCompleted",
              ].map((value) => ({
                value,
                label: value.replace(/([A-Z])/g, " $1").trim(),
              }))}
            />
            {["conditionExtra", "conditionNegate"].map((k) => (
              <label className="check" key={k}>
                <input
                  type="checkbox"
                  checked={sequenceForm.data[k]}
                  onChange={(e) =>
                    setSequenceForm({
                      ...sequenceForm,
                      data: { ...sequenceForm.data, [k]: e.target.checked },
                    })
                  }
                />
                {k === "conditionExtra"
                  ? "Use an additional action condition"
                  : "Invert condition"}
              </label>
            ))}
            {sequenceForm.data.conditionExtra && (
              <>
                <Field
                  name="conditionAction"
                  label="Action"
                  value={sequenceForm.data.conditionAction}
                  onChange={(conditionAction) =>
                    setSequenceForm({
                      ...sequenceForm,
                      data: { ...sequenceForm.data, conditionAction },
                    })
                  }
                  options={[
                    "Opened",
                    "Clicked",
                    "Bounced",
                    "Unsubscribed",
                    "Converted",
                    "Replied",
                  ].map((value) => ({ value, label: value }))}
                />
                <Field
                  name="conditionOperator"
                  label="Comparison"
                  value={sequenceForm.data.conditionOperator}
                  onChange={(conditionOperator) =>
                    setSequenceForm({
                      ...sequenceForm,
                      data: { ...sequenceForm.data, conditionOperator },
                    })
                  }
                  options={[
                    "GreaterThanOrEqual",
                    "LessThanOrEqual",
                    "Equal",
                    "NotEqual",
                    "GreaterThan",
                    "LessThan",
                  ].map((value) => ({
                    value,
                    label: value.replace(/([A-Z])/g, " $1").trim(),
                  }))}
                />
                <Field
                  name="conditionTimes"
                  label="Count"
                  type="number"
                  value={sequenceForm.data.conditionTimes}
                  onChange={(conditionTimes) =>
                    setSequenceForm({
                      ...sequenceForm,
                      data: { ...sequenceForm.data, conditionTimes },
                    })
                  }
                />
              </>
            )}
            <div className="form-actions">
              <Button disabled={busy}>Save sequence</Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={!!form}
        onOpenChange={(v) => !v && setForm(undefined)}
        title={form?.followupId ? "Edit follow-up" : "Add follow-up"}
      >
        {form && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate(form.followupId ? "edit" : "add", form);
            }}
          >
            {["subject", "body", "waitMin"].map((k) => (
              <Field
                key={k}
                label={
                  k === "waitMin" ? "Delay" : k[0].toUpperCase() + k.slice(1)
                }
                name={k}
                value={form.data[k]}
                type={
                  k === "body"
                    ? "textarea"
                    : k === "waitMin"
                      ? "number"
                      : "text"
                }
                onChange={(v) =>
                  setForm({ ...form, data: { ...form.data, [k]: v } })
                }
              />
            ))}
            <Field
              name="waitUnits"
              label="Delay unit"
              value={form.data.waitUnits}
              options={["Minutes", "Hours", "Days"].map((v) => ({
                value: v,
                label: v,
              }))}
              onChange={(v) =>
                setForm({ ...form, data: { ...form.data, waitUnits: v } })
              }
            />
            <div className="form-actions">
              <Button disabled={busy}>Save follow-up</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
