"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/query/fetcher";
import { queryKeys } from "@/lib/query/keys";

export interface TaskDTO {
  id: string;
  title: string;
  description?: string;
  planned_hours: number;
  planned_minutes: number;
  frequency: "once" | "repeat";
  single_date?: string | null;
  work_days: string[];
  category: string;
  priority: string;
  is_active: boolean;
  created_at: string;
}

export function useTasks() {
  const client = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.tasks,
    queryFn: () => apiFetch<TaskDTO[]>("/api/tasks"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      return response.json();
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.tasks });
      void client.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });

  return {
    tasks: query.data ?? [],
    loading: query.isLoading,
    refresh: async () => {
      await query.refetch();
    },
    deleteTask: deleteMutation.mutateAsync,
  };
}
