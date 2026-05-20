"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStats } from "@/lib/hooks/use-stats";
import { useSubmitAttendanceAbsence } from "@/lib/hooks/use-attendance-absence";
import { useUiStore } from "@/lib/stores/ui-store";
import { formatAbsenceDayLabel } from "@/lib/utils/attendance-absence";

export default function AttendanceAbsencePrompt() {
  const { stats } = useStats();
  const submitAbsence = useSubmitAttendanceAbsence();
  const dismissedDates = useUiStore((state) => state.dismissedAbsenceDates);
  const dismissDate = useUiStore((state) => state.dismissAbsenceDate);
  const [reason, setReason] = useState("");

  const pendingDay = useMemo(() => {
    const days = stats?.attendanceAbsences.weekly.days ?? [];
    return days.find((day) => day.status === "pending" && !dismissedDates.includes(day.date)) ?? null;
  }, [stats, dismissedDates]);

  const promptLabel = pendingDay
    ? formatAbsenceDayLabel(pendingDay.date).toLowerCase()
    : "";

  const handleSubmit = async () => {
    if (!pendingDay) return;
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      toast.error("Please provide a clear reason (at least 5 characters).");
      return;
    }

    try {
      await submitAbsence.mutateAsync({ date: pendingDay.date, reason: trimmed });
      setReason("");
      toast.success("Absence reason saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save reason.");
    }
  };

  if (!pendingDay || !stats) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && dismissDate(pendingDay.date)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attendance absence</DialogTitle>
          <DialogDescription>
            {stats.userName}, you were absent {promptLabel}. Please tell us why.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Date: <span className="font-medium">{pendingDay.date}</span>
          </p>
          <textarea
            rows={4}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Why were you absent on this day?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => dismissDate(pendingDay.date)}
              disabled={submitAbsence.isPending}
            >
              Ask me later
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitAbsence.isPending}>
              {submitAbsence.isPending ? "Saving…" : "Submit reason"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
