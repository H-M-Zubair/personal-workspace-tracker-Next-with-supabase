"use client";

import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import TimerPanel from "@/components/schedule/timer-panel";
import { useAttendance } from "@/lib/hooks/use-attendance";
import { useHistory } from "@/lib/hooks/use-history";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useTimerState } from "@/lib/context/timer-context";
import { formatClock } from "@/lib/utils/time";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MISSED_LOOKBACK_DAYS = 7;

type MissedTaskAlert = {
  taskId: string;
  taskTitle: string;
  date: string;
  dayLabel: string;
};

export default function TodayPage() {
  const { tasks, loading: tasksLoading } = useTasks();
  const { attendance, loading: attendanceLoading, checkIn } = useAttendance();
  const { history, refresh: refreshHistory } = useHistory();
  const { activeTimer } = useTimerState();
  const [absenceReasons, setAbsenceReasons] = useState<Record<string, string>>({});
  const [savingAbsenceKey, setSavingAbsenceKey] = useState<string | null>(null);

  const todayLabel = dayLabels[new Date().getDay()] ?? "Mon";
  const todayDate = format(new Date(), "yyyy-MM-dd");

  const todaysTasks = useMemo(
    () => tasks.filter((task) => {
      if (task.frequency === "once") {
        return task.single_date === todayDate;
      }
      return task.work_days?.includes(todayLabel);
    }),
    [tasks, todayDate, todayLabel],
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const runningTaskId = activeTimer?.status === "running" ? activeTimer.taskId : null;
  const todaySessions = useMemo(
    () => (history?.sessions ?? []).filter((session) => session.created_at.slice(0, 10) === todayDate),
    [history?.sessions, todayDate],
  );
  const taskStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    [...todaySessions]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .forEach((session) => {
        if (!map.has(session.task_id)) {
          map.set(session.task_id, session.status);
        }
      });
    return map;
  }, [todaySessions]);
  const completedTaskDateMap = useMemo(() => {
    const map = new Set<string>();
    (history?.sessions ?? []).forEach((session) => {
      if (session.status !== "completed") return;
      map.add(`${session.task_id}:${session.created_at.slice(0, 10)}`);
    });
    return map;
  }, [history?.sessions]);
  const absenceReasonMap = useMemo(() => {
    const map = new Map<string, string>();
    (history?.absences ?? []).forEach((absence) => {
      map.set(`${absence.task_id}:${absence.date}`, absence.reason);
    });
    return map;
  }, [history?.absences]);
  const missedTaskAlerts = useMemo<MissedTaskAlert[]>(() => {
    const alerts: MissedTaskAlert[] = [];
    const now = new Date();

    tasks
      .filter((task) => task.is_active && task.frequency === "repeat")
      .forEach((task) => {
        const taskCreatedDate = task.created_at?.slice(0, 10);
        for (let offset = 1; offset <= MISSED_LOOKBACK_DAYS; offset += 1) {
          const date = new Date(now);
          date.setDate(now.getDate() - offset);
          const dateString = format(date, "yyyy-MM-dd");
          if (taskCreatedDate && dateString < taskCreatedDate) {
            continue;
          }

          const dayLabel = dayLabels[date.getDay()] ?? "Mon";
          if (!task.work_days?.includes(dayLabel)) {
            continue;
          }

          const taskDateKey = `${task.id}:${dateString}`;
          const isCompleted = completedTaskDateMap.has(taskDateKey);
          const hasReason = absenceReasonMap.has(taskDateKey);
          if (isCompleted || hasReason) {
            continue;
          }

          alerts.push({
            taskId: task.id,
            taskTitle: task.title,
            date: dateString,
            dayLabel,
          });
        }
      });

    return alerts.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [absenceReasonMap, completedTaskDateMap, tasks]);
  const missedCountByTask = useMemo(() => {
    const map = new Map<string, number>();
    missedTaskAlerts.forEach((alert) => {
      map.set(alert.taskId, (map.get(alert.taskId) ?? 0) + 1);
    });
    return map;
  }, [missedTaskAlerts]);
  const saveAbsenceReason = useCallback(async (taskId: string, date: string) => {
    const key = `${taskId}:${date}`;
    const reason = (absenceReasons[key] ?? "").trim();
    if (reason.length < 5) {
      toast.error("Please provide a clear reason (at least 5 characters).");
      return;
    }

    try {
      setSavingAbsenceKey(key);
      const response = await fetch("/api/task-absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, date, reason }),
      });
      const payload = await response.json();
      if (!payload.success) {
        toast.error(payload.error ?? "Failed to save reason.");
        return;
      }

      setAbsenceReasons((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await refreshHistory();
      toast.success("Absence reason saved.");
    } catch (error) {
      console.error("[TodayPage] saveAbsenceReason", error);
      toast.error("Failed to save reason.");
    } finally {
      setSavingAbsenceKey(null);
    }
  }, [absenceReasons, refreshHistory]);

  const current = useMemo(() => {
    if (!todaysTasks.length) return null;

    if (runningTaskId) {
      const matched = todaysTasks.find((task) => task.id === runningTaskId);
      if (matched) return matched;
    }

    if (selectedTaskId) {
      const matched = todaysTasks.find((task) => task.id === selectedTaskId);
      if (matched && taskStatusMap.get(matched.id) !== "completed") return matched;
    }

    const firstIncomplete = todaysTasks.find((task) => taskStatusMap.get(task.id) !== "completed");
    return firstIncomplete ?? todaysTasks[0];
  }, [runningTaskId, selectedTaskId, taskStatusMap, todaysTasks]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Today&apos;s Schedule</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Attendance</h2>
        {attendanceLoading ? <p className="mt-2 text-sm text-slate-500">Loading attendance...</p> : null}
        {attendance ? (
          <p className="mt-2 text-sm text-emerald-700">Checked in at {formatClock(new Date(attendance.checked_in_at))}</p>
        ) : (
          <button onClick={checkIn} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white" type="button">Mark Attendance</button>
        )}
      </div>

      {tasksLoading ? <p className="text-sm text-slate-500">Loading tasks...</p> : null}
      {missedTaskAlerts.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-rose-800">Missed task alerts</h2>
          <p className="text-xs text-rose-700">
            You have pending missed task days. Add a reason for each day to keep your records professional and complete.
          </p>
          {missedTaskAlerts.map((alert) => {
            const key = `${alert.taskId}:${alert.date}`;
            const isSaving = savingAbsenceKey === key;
            return (
              <article key={key} className="rounded-lg border border-rose-200 bg-white p-3">
                <p className="text-sm font-medium text-slate-900">{alert.taskTitle}</p>
                <p className="text-xs text-slate-600">
                  Missed on {alert.dayLabel}, {alert.date}
                </p>
                <textarea
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Reason for absence on this task/day..."
                  value={absenceReasons[key] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAbsenceReasons((prev) => ({ ...prev, [key]: value }));
                  }}
                />
                <button
                  type="button"
                  className="mt-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
                  onClick={() => {
                    void saveAbsenceReason(alert.taskId, alert.date);
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Submit reason"}
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
      {current ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-xs font-medium text-slate-600">Task switcher</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={current.id}
              onChange={(event) => setSelectedTaskId(event.target.value)}
              disabled={Boolean(runningTaskId)}
            >
              {todaysTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            {runningTaskId ? (
              <p className="mt-2 text-xs text-amber-700">Pause or stop the running task to switch.</p>
            ) : null}
          </div>

          <TimerPanel
            key={`${current.id}-${current.planned_hours}-${current.planned_minutes}`}
            taskId={current.id}
            taskName={current.title}
            plannedSeconds={(current.planned_hours * 3600) + (current.planned_minutes * 60)}
            completedForToday={taskStatusMap.get(current.id) === "completed"}
            onStatusUpdated={refreshHistory}
          />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No tasks scheduled for {todayLabel} yet.</p>
      )}

      {todaysTasks.length > 0 ? (
        <div className="space-y-2">
          {todaysTasks.map((task) => {
            const isActive = activeTimer?.taskId === task.id;
            const status = taskStatusMap.get(task.id) ?? "not_started";

            return (
              <article key={task.id} className={`rounded-xl border bg-white p-4 shadow-sm ${isActive ? "border-blue-400" : status === "completed" ? "border-emerald-300" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{task.title}</h3>
                    <p className="text-sm text-slate-600">Planned {task.planned_hours}h {task.planned_minutes}m</p>
                  </div>
                  {status === "completed" ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" aria-label="Completed" />
                  ) : null}
                </div>
                {isActive ? <p className="mt-1 text-xs font-medium text-blue-700">Active timer task</p> : null}
                {!isActive && status === "completed" ? <p className="mt-1 text-xs font-medium text-emerald-700">Completed</p> : null}
                {!isActive && status === "paused" ? <p className="mt-1 text-xs font-medium text-amber-700">Paused</p> : null}
                {(missedCountByTask.get(task.id) ?? 0) > 0 ? (
                  <p className="mt-1 text-xs font-medium text-rose-700">
                    Missed on {missedCountByTask.get(task.id)} day(s) - reason pending
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
