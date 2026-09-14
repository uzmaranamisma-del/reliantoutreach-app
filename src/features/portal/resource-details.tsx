"use client";
import { useState } from "react";
import { DataTable, ErrorBox, Loading } from "@/components/data";
import { useLive } from "./hooks";
import { columnsByKind } from "./config";

export function ResourceDetails({
  kind,
  id,
  canViewProspects,
}: {
  kind: string;
  id: string;
  canViewProspects: boolean;
}) {
  const q = useLive(`/api/portal/${kind}/${id}`);
  const [page, setPage] = useState(1),
    [cursors, setCursors] = useState<string[]>([""]);
  const prospects = useLive(
    `/api/portal/prospects?list=${encodeURIComponent(id)}&page=${cursors[page - 1] ? 1 : page}${cursors[page - 1] ? `&cursor=${encodeURIComponent(cursors[page - 1])}` : ""}`,
    0,
    kind === "lists" && canViewProspects,
  );
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  return (
    <>
      <dl className="resource-details">
        {Object.entries(q.data || {})
          .filter(([key]) => !["id", "version"].includes(key))
          .map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
              <dd>
                {value == null || value === ""
                  ? "—"
                  : typeof value === "boolean"
                    ? value
                      ? "Yes"
                      : "No"
                    : Array.isArray(value)
                      ? value.join(", ") || "—"
                      : String(value)}
              </dd>
            </div>
          ))}
      </dl>
      {kind === "lists" && canViewProspects && (
        <section className="section-space">
          <h2>List prospects</h2>
          <DataTable
            rows={prospects.data?.items || []}
            columns={columnsByKind.prospects}
            loading={prospects.isLoading}
            error={prospects.error}
            total={prospects.data?.pagination?.totalItems}
            page={page}
            onPage={(next) => {
              if (next > page && prospects.data?.pagination?.nextCursor)
                setCursors([
                  ...cursors.slice(0, page),
                  prospects.data.pagination.nextCursor,
                ]);
              setPage(next);
            }}
          />
        </section>
      )}
    </>
  );
}
