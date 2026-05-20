"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUiStore } from "@/lib/stores/ui-store";
import type { AttendanceAbsenceSummary } from "@/lib/hooks/use-stats";

type RangeKey = "weekly" | "monthly" | "yearly";

const rangeTitles: Record<RangeKey, string> = {
  weekly: "Weekly absences",
  monthly: "Monthly absences",
  yearly: "Yearly absences",
};

export default function WeeklyAbsencesDialog({
  summary,
}: {
  summary: AttendanceAbsenceSummary | undefined;
}) {
  const open = useUiStore((state) => state.weeklyAbsencesOpen);
  const range = useUiStore((state) => state.absencesRange);
  const setOpen = useUiStore((state) => state.setWeeklyAbsencesOpen);

  return (
    <Dialog open={open} onOpenChange={(next) => setOpen(next, range)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rangeTitles[range]}</DialogTitle>
          <DialogDescription>
            Days you did not check in. Dates only — no task details.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {!summary || summary.count === 0 ? (
            <p className="text-sm text-slate-600">No absences recorded in this period.</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-800">
                {summary.count} absence{summary.count === 1 ? "" : "s"}
                {summary.pendingCount > 0 ? (
                  <span className="text-rose-700"> · {summary.pendingCount} reason pending</span>
                ) : null}
              </p>
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {summary.days.map((day) => (
                  <li
                    key={day.date}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{day.label}</p>
                      <p className="text-xs text-slate-500">{day.date}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        day.status === "pending"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {day.status === "pending" ? "No reason" : "Excused"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
