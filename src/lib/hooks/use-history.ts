"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/query/fetcher";
import { queryKeys } from "@/lib/query/keys";

export interface HistoryPayload {
  attendance: Array<{ date: string; checked_in_at: string }>;
  sessions: Array<{
    id: string;
    task_id: string;
    total_seconds: number;
    status: string;
    created_at: string;
    task?: { title?: string } | null;
  }>;
  absences?: Array<{
    id: string;
    task_id: string;
    date: string;
    reason: string;
    created_at: string;
  }>;
}

export function useHistory() {
  const client = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.history,
    queryFn: () => apiFetch<HistoryPayload>("/api/history"),
  });

  return {
    history: query.data ?? null,
    loading: query.isLoading,
    refresh: async () => {
      await query.refetch();
      await client.invalidateQueries({ queryKey: queryKeys.stats });
    },
  };
}
