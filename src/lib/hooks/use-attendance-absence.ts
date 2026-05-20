"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "@/lib/query/fetcher";
import { queryKeys } from "@/lib/query/keys";

export function useSubmitAttendanceAbsence() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ date, reason }: { date: string; reason: string }) =>
      apiMutate<{ id: string; date: string; reason: string }>("/api/attendance-absences", {
        method: "POST",
        body: JSON.stringify({ date, reason }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.stats });
      void client.invalidateQueries({ queryKey: queryKeys.attendanceAbsences });
      void client.invalidateQueries({ queryKey: queryKeys.history });
    },
  });
}
