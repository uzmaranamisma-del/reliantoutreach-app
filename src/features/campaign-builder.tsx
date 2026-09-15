"use client";
import { ErrorBox, Field, Loading } from "@/components/data";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/browser-api";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Mail, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ResourcePicker } from "@/components/resource-picker";
import { SendingSchedule } from "@/components/sending-schedule";
const steps = [
  "Details",
  "Senders",
  "Initial email",
  "Follow-ups",
  "Prospects",
  "Settings",
  "Review",
];
const html = (text: string) =>
  `<p>${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>")}</p>`;
export function CampaignBuilder({ onDone }: { onDone: (id: string) => void }) {
  const [requestKey] = useState(() => crypto.randomUUID());
  const [sourceList, setSourceList] = useState(""),
    [csv, setCsv] = useState(""),
    [mapping, setMapping] = useState({
      email: "email",
      firstName: "firstName",
      lastName: "lastName",
      company: "company",
    });
  const [enrollmentKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0),
    [data, setData] = useState({
      name: "",
      description: "",
      subject: "",
      body: "",
      dailyLimit: 50,
      scheduleTimeZone: "UTC",
      fromEmails: [] as string[],
      trackOpens: false,
      trackClicks: false,
      scheduleSending: false,
    }),
    [followups, setFollowups] = useState<
      { subject: string; body: string; days: number }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState("");
  const senders = useQuery({
    queryKey: ["builder-senders"],
    queryFn: () => api("/api/portal/senders?limit=100"),
  });
  async function save() {
    setBusy(true);
    setError("");
    let id = saved;
    try {
      if (!id) {
        const campaign = await api("/api/portal/campaigns", {
          key: requestKey,
          data: {
            ...data,
            fromEmails: data.fromEmails.join(","),
            body: html(data.body),
            dailyLimitPer: "Campaign",
            sendUnsubscribeListHeader: true,
          },
        });
        id = campaign.id;
        setSaved(id);
      }
      if (followups.length) {
        const seq = await api(`/api/portal/campaigns/${id}/sequences`, {
          action: "create",
          key: crypto.randomUUID(),
          data: { name: "Follow-ups", conditionReply: "NotReplied" },
        });
        for (const f of followups) {
          await api(`/api/portal/campaigns/${id}/sequences`, {
            action: "add",
            sequenceId: seq.id,
            key: crypto.randomUUID(),
            data: {
              subject: f.subject,
              body: html(f.body),
              waitMin: f.days,
              waitUnits: "Days",
              useOriginalSubject: !f.subject,
              sendInSameThread: true,
            },
          });
        }
      }
      if (sourceList)
        await api("/api/portal/enrollments", {
          sourceList,
          campaign: id,
          key: enrollmentKey,
        });
      else if (csv.trim())
        await api("/api/portal/imports", {
          csv,
          mapping,
          campaign: id,
          key: enrollmentKey,
        });
      onDone(id);
    } catch (e) {
      setError(
        `${(e as Error).message}${id ? " Your campaign draft is saved. Open it to finish any remaining steps." : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }
  const valid =
    step === 0
      ? !!data.name.trim()
      : step === 2
        ? !!data.subject.trim() && !!data.body.trim()
        : true;
  return (
    <div className="campaign-builder">
      <ol className="wizard-steps">
        {steps.map((label, index) => (
          <li
            className={index === step ? "current" : index < step ? "done" : ""}
            key={label}
          >
            <span>{index < step ? <Check size={13} /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="wizard-body">
        <div className="eyebrow">STEP {step + 1} OF 7</div>
        <h2>{steps[step]}</h2>
        {step === 0 && (
          <>
            <Field
              name="campaign-name"
              label="Campaign name"
              value={data.name}
              onChange={(v) => setData({ ...data, name: v })}
              required
            />
            <Field
              name="description"
              label="Description"
              type="textarea"
              value={data.description}
              onChange={(v) => setData({ ...data, description: v })}
            />
          </>
        )}
        {step === 1 && (
          <>
            <p className="muted">
              Select connected email accounts. You can also save a draft and
              choose senders later.
            </p>
            {senders.isLoading ? (
              <Loading />
            ) : senders.error ? (
              <ErrorBox error={senders.error} />
            ) : (
              <>
                {!!senders.data?.items.length && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={senders.data.items.every((s: any) =>
                        data.fromEmails.includes(s.email),
                      )}
                      onChange={(e) =>
                        setData({
                          ...data,
                          fromEmails: e.target.checked
                            ? senders.data.items.map((s: any) => s.email)
                            : [],
                        })
                      }
                    />
                    Select all senders
                  </label>
                )}
                {senders.data?.items.map((s: any) => (
                  <label className="sender-option" key={s.email}>
                    <input
                      type="checkbox"
                      checked={data.fromEmails.includes(s.email)}
                      onChange={(e) =>
                        setData({
                          ...data,
                          fromEmails: e.target.checked
                            ? [...data.fromEmails, s.email]
                            : data.fromEmails.filter((v) => v !== s.email),
                        })
                      }
                    />
                    <Mail size={18} />
                    <span>
                      {s.email}
                      <small>
                        {s.disconnected
                          ? "Connection needs attention"
                          : `${s.dailyLimit} emails per day`}
                      </small>
                    </span>
                  </label>
                ))}
              </>
            )}
            {senders.data?.pagination.totalItems > 100 && (
              <p className="notice">
                Showing the first 100 senders. Use the sender management page to
                locate other accounts.
              </p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <Field
              name="subject"
              label="Subject"
              value={data.subject}
              onChange={(v) => setData({ ...data, subject: v })}
              required
            />
            <Field
              name="body"
              label="Email body"
              type="textarea"
              value={data.body}
              onChange={(v) => setData({ ...data, body: v })}
              required
            />
            <p className="variable-help">
              Personalize with <code>{"{{FIRST_NAME}}"}</code>{" "}
              <code>{"{{LAST_NAME}}"}</code> <code>{"{{COMPANY}}"}</code>. Keep
              an unsubscribe option in your email.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <p className="muted">
              Follow up only when the prospect has not replied.
            </p>
            {followups.map((f, i) => (
              <div className="followup-form" key={i}>
                <div className="section-title">
                  <h3>Follow-up {i + 1}</h3>
                  <Button
                    variant="ghost"
                    aria-label="Remove follow-up"
                    onClick={() =>
                      setFollowups(followups.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
                <Field
                  name={`days-${i}`}
                  label="Wait days"
                  type="number"
                  min={1}
                  value={f.days}
                  onChange={(v) =>
                    setFollowups(
                      followups.map((x, j) =>
                        j === i ? { ...x, days: v } : x,
                      ),
                    )
                  }
                />
                <Field
                  name={`subject-${i}`}
                  label="Subject (leave empty to use original)"
                  value={f.subject}
                  onChange={(v) =>
                    setFollowups(
                      followups.map((x, j) =>
                        j === i ? { ...x, subject: v } : x,
                      ),
                    )
                  }
                />
                <Field
                  name={`body-${i}`}
                  label="Body"
                  type="textarea"
                  value={f.body}
                  onChange={(v) =>
                    setFollowups(
                      followups.map((x, j) =>
                        j === i ? { ...x, body: v } : x,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                setFollowups([...followups, { subject: "", body: "", days: 3 }])
              }
              disabled={followups.length >= 5}
            >
              <Plus size={15} />
              Add follow-up
            </Button>
          </>
        )}
        {step === 4 && (
          <div>
            <ResourcePicker
              kind="lists"
              label="Use an existing list (optional)"
              value={sourceList}
              onChange={(v) => {
                setSourceList(v);
                setCsv("");
              }}
            />
            {!sourceList && (
              <>
                <label className="upload-zone">
                  Choose a CSV file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 2500000) {
                        setError("Choose a CSV smaller than 2.5 MB.");
                        return;
                      }
                      setCsv(await f.text());
                    }}
                  />
                </label>
                {csv && (
                  <>
                    <p className="notice">
                      Map each field to its exact CSV column header. Leave
                      optional mappings blank when absent.
                    </p>
                    <div className="form-grid">
                      {Object.entries(mapping).map(([k, v]) => (
                        <Field
                          key={k}
                          name={k}
                          label={`${k} column`}
                          value={v}
                          onChange={(v) => setMapping({ ...mapping, [k]: v })}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            <p className="muted">
              Enrollment is queued when the draft is saved. The campaign remains
              a draft until you start it.
            </p>
          </div>
        )}
        {step === 5 && (
          <>
            <div className="form-grid">
              <Field
                name="limit"
                label="Daily sending limit"
                type="number"
                min={1}
                max={10000}
                value={data.dailyLimit}
                onChange={(v) => setData({ ...data, dailyLimit: v })}
              />
              <Field
                name="timezone"
                label="Timezone"
                value={data.scheduleTimeZone}
                onChange={(v) => setData({ ...data, scheduleTimeZone: v })}
              />
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={data.trackOpens}
                onChange={(e) =>
                  setData({ ...data, trackOpens: e.target.checked })
                }
              />
              Track opens
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={data.trackClicks}
                onChange={(e) =>
                  setData({ ...data, trackClicks: e.target.checked })
                }
              />
              Track clicks
            </label>
            <p className="muted">
              The daily limit applies across the entire campaign.
            </p>
            <SendingSchedule
              value={data}
              onChange={(patch) => setData({ ...data, ...patch })}
            />
          </>
        )}
        {step === 6 && (
          <div className="review-campaign">
            <h3>{data.name}</h3>
            <dl className="detail-grid">
              <div>
                <dt>Senders</dt>
                <dd>{data.fromEmails.length}</dd>
              </div>
              <div>
                <dt>Follow-ups</dt>
                <dd>{followups.length}</dd>
              </div>
              <div>
                <dt>Daily limit</dt>
                <dd>{data.dailyLimit}</dd>
              </div>
              <div>
                <dt>Prospects</dt>
                <dd>
                  {sourceList
                    ? "Existing list"
                    : csv
                      ? "CSV import"
                      : "Add later"}
                </dd>
              </div>
            </dl>
            <h3>{data.subject}</h3>
            <p className="preserve-whitespace">{data.body}</p>
            <p className="notice">
              Saving creates a draft. No emails will be sent.
            </p>
          </div>
        )}
        {error && <ErrorBox error={error} />}
      </div>
      <div className="wizard-footer">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 0 || busy}
        >
          <ArrowLeft size={15} />
          Back
        </Button>
        {saved ? (
          <Button onClick={() => onDone(saved)}>Open saved draft</Button>
        ) : step < 6 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!valid}>
            Continue
            <ArrowRight size={15} />
          </Button>
        ) : (
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving campaign…" : "Save draft"}
          </Button>
        )}
      </div>
    </div>
  );
}
