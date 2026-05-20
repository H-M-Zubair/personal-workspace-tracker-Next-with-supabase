"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/query/fetcher";
import { queryKeys } from "@/lib/query/keys";

type RangeKey = "weekly" | "monthly" | "yearly";

interface RangeMetrics {
  totalSeconds: number;
  totalTasks: number;
  tasksCompleted: number;
  tasksExcused: number;
  tasksMissed: number;
  successRatio: number;
}

export interface AttendanceAbsenceSummary {
  count: number;
  pendingCount: number;
  days: Array<{
    date: string;
    label: string;
    status: "excused" | "pending";
  }>;
}

export interface DashboardStats {
  userName: string;
  today: {
    totalSeconds: number;
    tasksCompleted: number;
    totalTasks: number;
    tasksExcused: number;
    tasksMissed: number;
    successRatio: number;
    streak: number;
  };
  ranges: Record<RangeKey, RangeMetrics>;
  attendanceAbsences: Record<RangeKey, AttendanceAbsenceSummary>;
  charts: {
    weeklyHours: Array<{ label: string; hours: number }>;
    completionTrend: Array<{
      label: string;
      ratio: number;
      assigned: number;
      completed: number;
      excused: number;
      missed: number;
    }>;
    monthlyHours: Array<{ label: string; hours: number }>;
  };
}

export function useStats() {
  const query = useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => apiFetch<DashboardStats>("/api/stats"),
  });

  return {
    stats: query.data ?? null,
    loading: query.isLoading,
    refresh: query.refetch,
  };
}

export function useInvalidateStats() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.stats });
}
