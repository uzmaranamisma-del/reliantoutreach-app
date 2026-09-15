"use client";
import { api } from "@/lib/browser-api";
import { useQuery } from "@tanstack/react-query";

export function useContext(enabled = true) {
  return useQuery({
    queryKey: ["context"],
    queryFn: () => api("/api/portal/context"),
    enabled,
  });
}

export function useLive(path: string, interval = 0, enabled = true) {
  return useQuery({
    queryKey: [path],
    queryFn: () => api(path),
    enabled,
    refetchInterval: interval ? Math.max(10, interval) * 1000 : false,
    refetchIntervalInBackground: false,
  });
}
