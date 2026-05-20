"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTimerState } from "@/lib/context/timer-context";
import { formatDuration } from "@/lib/utils/time";

type TimerStatus = "idle" | "running" | "paused" | "completed";

type TimerSessionResponse = {
  id: string;
  status: "running" | "paused" | "completed";
  elapsedSeconds: number;
};

export default function TimerPanel({
  taskId,
  taskName,
  plannedSeconds,
  completedForToday = false,
  onStatusUpdated,
}: {
  taskId: string;
  taskName: string;
  plannedSeconds: number;
  completedForToday?: boolean;
  onStatusUpdated?: () => Promise<void> | void;
}) {
  const { activeTimer, refreshActiveTimer, extendPlannedSeconds } = useTimerState();
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [extraSeconds, setExtraSeconds] = useState(0);
  const [syncing, setSyncing] = useState(true);
  const [actionError, setActionError] = useState("");

  const syncFromServer = useCallback(async () => {
    try {
      setSyncing(true);
      const response = await fetch(`/api/timers?taskId=${taskId}`, { cache: "no-store" });
      const payload = await response.json();

      if (!payload.success || !payload.data) {
        setStatus("idle");
        setElapsedSeconds(0);
        return;
      }

      const session = payload.data as TimerSessionResponse;
      setStatus(session.status);
      setElapsedSeconds(session.elapsedSeconds ?? 0);
    } catch (error) {
      console.error("[TimerPanel] sync", error);
    } finally {
      setSyncing(false);
    }
  }, [taskId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void syncFromServer();
    }, 0);

    return () => window.clearTimeout(id);
  }, [syncFromServer]);

  useEffect(() => {
    if (status !== "running") return;

    const interval = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [status]);

  const effectiveStatus = completedForToday
    ? "completed"
    : (activeTimer?.taskId === taskId ? activeTimer.status : status);
  const effectiveElapsed = activeTimer?.taskId === taskId ? activeTimer.elapsedSeconds : elapsedSeconds;
  const hasOtherRunningTask = activeTimer?.status === "running" && activeTimer.taskId !== taskId;

  const totalPlanned =
    activeTimer?.taskId === taskId
      ? activeTimer.plannedSeconds
      : plannedSeconds + extraSeconds;
  const secondsLeft = totalPlanned - effectiveElapsed;
  const isOvertime = secondsLeft < 0;
  const displaySeconds = effectiveStatus === "completed" ? 0 : Math.max(secondsLeft, 0);
  const progress = totalPlanned <= 0 ? 0 : Math.min(100, Math.round((effectiveElapsed / totalPlanned) * 100));

  const label = useMemo(() => {
    if (syncing) return "Syncing...";
    if (effectiveStatus === "completed") return "Completed";
    if (effectiveStatus === "paused") return "Paused";
    return isOvertime ? "Overtime" : "Remaining";
  }, [effectiveStatus, isOvertime, syncing]);

  const postAction = useCallback(async (action: "start" | "pause" | "resume" | "complete", options?: { silent?: boolean }) => {
    setActionError("");
    const response = await fetch("/api/timers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, taskId }),
    });

    const payload = await response.json();
    if (!payload.success) {
      const message = payload.error ?? "Unable to update timer.";
      setActionError(message);
      if (!options?.silent) {
        toast.error(message);
      }
      return false;
    }

    await Promise.all([syncFromServer(), refreshActiveTimer(), onStatusUpdated?.()]);
    if (action === "complete" && !options?.silent) {
      toast.success("Task marked as completed.");
    }
    return true;
  }, [onStatusUpdated, refreshActiveTimer, syncFromServer, taskId]);

  const onStart = async () => {
    if (effectiveStatus !== "idle") return;
    setStatus("running");
    await postAction("start");
  };

  const onPause = async () => {
    if (effectiveStatus !== "running") return;
    setStatus("paused");
    await postAction("pause");
  };

  const onResume = async () => {
    if (effectiveStatus !== "paused") return;
    setStatus("running");
    await postAction("resume");
  };

  const onDone = useCallback(async () => {
    if (effectiveStatus === "completed" || effectiveStatus === "idle") return;
    setStatus("completed");
    await postAction("complete");
  }, [effectiveStatus, postAction]);

  const onAddFive = () => {
    setExtraSeconds((value) => value + 300);
    if (activeTimer?.taskId === taskId) {
      extendPlannedSeconds(300);
    }
  };

  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm ${effectiveStatus === "completed" ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Active Timer</p>
          <h3 className="mt-1 text-lg font-semibold">{taskName}</h3>
        </div>
        {effectiveStatus === "completed" ? (
          <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-600" aria-label="Completed" />
        ) : null}
      </div>

      <p className={`mt-3 font-mono text-3xl ${effectiveStatus === "completed" ? "text-emerald-700" : isOvertime ? "text-rose-600" : "text-blue-700"}`}>
        {effectiveStatus === "completed" ? formatDuration(0) : formatDuration(displaySeconds)}
      </p>
      <p className="text-xs text-slate-500">{label}</p>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full transition-all ${effectiveStatus === "completed" ? "bg-emerald-500" : "bg-blue-600"}`}
          style={{ width: `${effectiveStatus === "completed" ? 100 : progress}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onStart} disabled={effectiveStatus !== "idle" || syncing || hasOtherRunningTask}>Start</Button>
        <Button type="button" onClick={onPause} disabled={effectiveStatus !== "running" || syncing} variant="secondary">Pause</Button>
        <Button type="button" onClick={onResume} disabled={effectiveStatus !== "paused" || syncing}>Resume</Button>
        <Button type="button" onClick={onAddFive} disabled={effectiveStatus === "completed" || syncing} variant="outline">Add 5 min</Button>
        <Button type="button" onClick={() => void onDone()} disabled={(effectiveStatus !== "running" && effectiveStatus !== "paused") || syncing}>Done</Button>
      </div>
      {hasOtherRunningTask ? (
        <p className="mt-2 text-xs text-amber-700">Another task is running. Pause or stop it first to switch.</p>
      ) : null}
      {actionError ? <p className="mt-2 text-xs text-rose-700">{actionError}</p> : null}
    </article>
  );
}
