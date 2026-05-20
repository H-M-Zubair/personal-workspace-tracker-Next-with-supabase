"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiMutate } from "@/lib/query/fetcher";
import { queryKeys } from "@/lib/query/keys";

interface AttendanceRecord {
  date: string;
  checked_in_at: string;
}

export function useAttendance() {
  const client = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.attendance,
    queryFn: () => apiFetch<AttendanceRecord | null>("/api/attendance"),
  });

  const checkInMutation = useMutation({
    mutationFn: () =>
      apiMutate<AttendanceRecord>("/api/attendance", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      client.setQueryData(queryKeys.attendance, data);
      void client.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });

  return {
    attendance: query.data ?? null,
    loading: query.isLoading,
    checkIn: () => checkInMutation.mutateAsync(),
    refresh: query.refetch,
  };
}
