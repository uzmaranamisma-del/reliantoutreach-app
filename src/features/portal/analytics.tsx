"use client";
import {
  DataTable,
  Empty,
  ErrorBox,
  Field,
  Loading,
  PageTitle,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/browser-api";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { useContext } from "./hooks";

export function Analytics({ campaign }: { campaign?: string }) {
  const { data: ctx } = useContext(),
    [selected, setSelected] = useState(campaign || ""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const campaigns = useQuery({
    queryKey: ["analytics-campaigns"],
    queryFn: () => api("/api/portal/campaigns?limit=100"),
    enabled: !campaign,
  });
  const q = useQuery({
    queryKey: ["analytics", selected, start, end],
    queryFn: () =>
      api(
        `/api/portal/campaigns/${selected}/analytics?${new URLSearchParams({ ...(start ? { start } : {}), ...(end ? { end } : {}) })}`,
      ),
    enabled: !!selected,
  });
  const data = q.data;
  const total = (key: string) =>
    (data?.[key] || []).reduce(
      (a: number, b: number) => a + (Number(b) || 0),
      0,
    );
  return (
    <>
      {!campaign && (
        <PageTitle
          eyebrow="PERFORMANCE"
          title="Analytics"
          description="Measure the conversations your campaigns create."
        />
      )}
      <div className="panel analytics-controls">
        {!campaign && (
          <Field
            label="Campaign"
            name="campaign"
            value={selected}
            onChange={setSelected}
            options={[
              { value: "", label: "Select a campaign" },
              ...(campaigns.data?.items || []).map((c: any) => ({
                value: c.id,
                label: c.name,
              })),
            ]}
          />
        )}
        <Field
          name="start"
          label="Start date"
          type="date"
          value={start}
          onChange={setStart}
        />
        <Field
          name="end"
          label="End date"
          type="date"
          value={end}
          onChange={setEnd}
        />
        <Button
          variant="outline"
          onClick={() => q.refetch()}
          disabled={!selected}
        >
          Apply range
        </Button>
        {ctx?.permissions["analytics.export"] && data && (
          <Button
            variant="outline"
            onClick={() => {
              const rows = [
                "date,sent,replies,opens,clicks",
                ...data.timeline.map(
                  (d: string, i: number) =>
                    `${d},${data.sent[i] || 0},${data.replies[i] || 0},${data.opens[i] || 0},${data.clicks[i] || 0}`,
                ),
              ];
              const url = URL.createObjectURL(
                new Blob([rows.join("\n")], { type: "text/csv" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "outreach-analytics.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={15} />
            Export
          </Button>
        )}
      </div>
      {q.error ? (
        <ErrorBox error={q.error} />
      ) : q.isLoading ? (
        <Loading />
      ) : !selected ? (
        <div className="panel">
          <Empty
            title="Choose a campaign"
            description="Select a campaign to view its actual sending and reply activity."
          />
        </div>
      ) : (
        <>
          <div className="metric-grid">
            {[
              ["Sent", "sent"],
              ["Replies", "replies"],
              ["Opens", "opens"],
              ["Clicks", "clicks"],
            ].map(([label, key]) => (
              <div className="metric-card" key={key}>
                <span>{label}</span>
                <strong>{total(key).toLocaleString()}</strong>
                <small>Selected date range</small>
              </div>
            ))}
          </div>
          <div className="panel content-panel">
            <div className="section-title">
              <h2>Outreach activity</h2>
              <div className="legend">
                <span>Sent</span>
                <span>Replies</span>
              </div>
            </div>
            {data?.timeline?.length ? (
              <div
                className="bar-chart"
                role="img"
                aria-label="Campaign sends and replies over time"
              >
                {data.timeline.map((date: string, i: number) => (
                  <div
                    className="bar-column"
                    key={date}
                    title={`${date}: ${data.sent[i] || 0} sent, ${data.replies[i] || 0} replies`}
                  >
                    <div className="bar-pair">
                      <div
                        style={{
                          height: `${Math.max(1, ((data.sent[i] || 0) / Math.max(1, ...data.sent)) * 180)}px`,
                        }}
                      />
                      <div
                        style={{
                          height: `${Math.max(1, ((data.replies[i] || 0) / Math.max(1, ...data.sent)) * 180)}px`,
                        }}
                      />
                    </div>
                    <small>
                      {new Date(date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No activity in this range" />
            )}
          </div>
          <DataTable
            rows={(data?.timeline || []).map((date: string, i: number) => ({
              id: date,
              date: date.slice(0, 10),
              sent: data.sent[i] || 0,
              replies: data.replies[i] || 0,
              opens: data.opens[i] || 0,
              clicks: data.clicks[i] || 0,
            }))}
            columns={["date", "sent", "replies", "opens", "clicks"].map(
              (k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1) }),
            )}
          />
        </>
      )}
    </>
  );
}
