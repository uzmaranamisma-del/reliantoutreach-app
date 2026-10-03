"use client";
import { useState } from "react";
import {
  ArrowUpDown,
  RefreshCw,
  Search,
  Inbox as InboxIcon,
  AlertCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { readable, statusTone } from "@/lib/presentation";
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title ro-pagehead">
      <div>
        {eyebrow && <div className="eyebrow ro-overline">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="title-actions ro-pagehead__actions">{children}</div>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  description = "Records will appear here when available.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <InboxIcon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-message" role="alert">
      <AlertCircle size={18} />
      <span>{error instanceof Error ? error.message : String(error)}</span>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeleton-stack" aria-label="Loading">
      <div />
      <div />
      <div />
    </div>
  );
}
export function Status({ value }: { value: unknown }) {
  const text = String(value || "Unknown");
  return (
    <span className={`status ro-badge ro-badge--${statusTone(text)}`}>
      {readable(text)}
    </span>
  );
}
export function Refresh({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <Button variant="outline" onClick={onClick} disabled={busy}>
      <RefreshCw size={16} className={busy ? "spin" : ""} />
      Refresh
    </Button>
  );
}
export function DataTable({
  rows,
  columns,
  onSearch,
  search = "",
  page = 1,
  total,
  onPage,
  loading,
  error,
  actions,
  searchLabel = "Search",
  nextCursor,
  onNext,
  canNext,
}: {
  rows: any[];
  columns: {
    key: string;
    label: string;
    render?: (r: any) => React.ReactNode;
  }[];
  onSearch?: (v: string) => void;
  search?: string;
  page?: number;
  total?: number;
  onPage?: (v: number) => void;
  loading?: boolean;
  error?: unknown;
  actions?: (r: any) => React.ReactNode;
  searchLabel?: string;
  nextCursor?: string | null;
  onNext?: () => void;
  canNext?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: number }>({
    key: "",
    dir: 1,
  });
  const sorted = sort.key
    ? [...rows].sort(
        (a, b) =>
          String(a[sort.key] ?? "").localeCompare(
            String(b[sort.key] ?? ""),
            undefined,
            { numeric: true },
          ) * sort.dir,
      )
    : rows;
  return (
    <section className="panel table-panel ro-table-wrap">
      {rows.length > 0 && !loading && !error && (
        <label className="mobile-table-sort">
          Sort current page
          <select
            aria-label="Sort current page"
            value={sort.key}
            onChange={(event) => setSort({ key: event.target.value, dir: 1 })}
          >
            <option value="">Original order</option>
            {columns
              .filter((column) => column.label)
              .map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            aria-label={sort.dir === 1 ? "Sort descending" : "Sort ascending"}
            disabled={!sort.key}
            onClick={() => setSort({ ...sort, dir: -sort.dir })}
          >
            <ArrowUpDown size={16} />
          </Button>
        </label>
      )}
      {onSearch && (
        <div className="table-toolbar ro-toolbar">
          <div className="search-field ro-search">
            <Search size={17} />
            <input
              aria-label={searchLabel}
              placeholder={searchLabel}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <span className="muted small">
            {total !== undefined
              ? `${total.toLocaleString()} records`
              : "Sorted within current page"}
          </span>
        </div>
      )}
      {error ? (
        <ErrorBox error={error} />
      ) : loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="table-scroll">
          <table className="ro-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>
                    <button
                      onClick={() =>
                        setSort({
                          key: c.key,
                          dir: sort.key === c.key ? -sort.dir : 1,
                        })
                      }
                    >
                      {c.label}
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                ))}
                {actions && <th className="align-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, index) => (
                <tr key={row.id || index}>
                  {columns.map((c) => (
                    <td key={c.key} data-label={c.label}>
                      {c.render ? (
                        c.render(row)
                      ) : c.key === "role" ? (
                        <Status value={row[c.key]} />
                      ) : (
                        readable(row[c.key])
                      )}
                    </td>
                  ))}
                  {actions && (
                    <td data-label="Actions">
                      <div className="row-actions">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {onPage && (
        <div className="table-footer ro-pager">
          <span>
            Page {page}
            {total !== undefined ? ` · ${total.toLocaleString()} total` : ""}
          </span>
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => onPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={
                canNext !== undefined
                  ? !canNext
                  : total !== undefined
                    ? page * 25 >= total
                    : rows.length < 25
              }
              onClick={() =>
                nextCursor && onNext ? onNext() : onPage(page + 1)
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = false,
  min,
  max,
  options,
  help,
}: {
  label: string;
  name: string;
  type?: string;
  value?: any;
  onChange?: (v: any) => void;
  required?: boolean;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  help?: string;
}) {
  const props = {
    className: "ro-input",
    name,
    id: name,
    required,
    value: value ?? "",
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      onChange?.(type === "number" ? Number(e.target.value) : e.target.value),
  };
  return (
    <label htmlFor={name} className="ro-field">
      {label}
      {options ? (
        <select {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea {...props} rows={5} />
      ) : (
        <input {...props} type={type} min={min} max={max} />
      )}{" "}
      {help && <small className="muted">{help}</small>}
    </label>
  );
}
