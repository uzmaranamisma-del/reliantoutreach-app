"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/browser-api";
import { Field, ErrorBox } from "./data";
import { Button } from "./ui/button";
export function ResourcePicker({
  kind,
  value,
  onChange,
  label,
}: {
  kind: "campaigns" | "lists";
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [page, setPage] = useState(1),
    [selectedLabel, setSelectedLabel] = useState("Selected resource");
  const q = useQuery({
    queryKey: ["picker", kind, page],
    queryFn: () => api(`/api/portal/${kind}?page=${page}`),
    staleTime: 60000,
  });
  const items = q.data?.items || [],
    options = items.map((r: any) => ({
      value: r.id,
      label: r.name || r.title,
    }));
  if (value && !items.some((r: any) => r.id === value))
    options.unshift({ value, label: selectedLabel });
  return (
    <div>
      {q.error && <ErrorBox error={q.error} />}
      <Field
        name={`${kind}-picker`}
        label={label}
        value={value}
        onChange={(v) => {
          setSelectedLabel(
            options.find((o: any) => o.value === v)?.label ||
              "Selected resource",
          );
          onChange(v);
        }}
        options={[
          { value: "", label: q.isLoading ? "Loading…" : "Choose…" },
          ...options,
        ]}
      />
      <div className="form-actions">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <small>Page {page}</small>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page * 25 >= (q.data?.pagination?.totalItems || 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
