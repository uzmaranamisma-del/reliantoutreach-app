"use client";
import { api } from "@/lib/browser-api";
import { useQuery } from "@tanstack/react-query";

export function useContext() {
  return useQuery({
    queryKey: ["context"],
    queryFn: () => api("/api/portal/context"),
  });
}

export function useLive(path: string, interval = 0) {
  return useQuery({
    queryKey: [path],
    queryFn: () => api(path),
    refetchInterval: interval ? Math.max(10, interval) * 1000 : false,
    refetchIntervalInBackground: false,
  });
}
