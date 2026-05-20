"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query/keys";

type ActiveTimerStatus = "running" | "paused" | "completed";

export type ActiveTimer = {
  id: string;
  taskId: string;
  taskTitle: string;
  plannedSeconds: number;
  elapsedSeconds: number;
  status: ActiveTimerStatus;
};

type TimerContextValue = {
  activeTimer: ActiveTimer | null;
  loading: boolean;
  actionLoading: boolean;
  refreshActiveTimer: () => Promise<void>;
  runTimerAction: (action: "pause" | "resume" | "complete", options?: { silent?: boolean }) => Promise<void>;
  extendPlannedSeconds: (seconds: number) => void;
};

const TimerContext = createContext<TimerContextValue | null>(null);

function pauseTimerKeepalive(taskId: string) {
  const body = JSON.stringify({ action: "pause", taskId });
  void fetch("/api/timers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const autoCompletedRef = useRef(false);
  const pausingRef = useRef(false);

  const refreshActiveTimer = useCallback(async () => {
    try {
      const response = await fetch("/api/timers", { cache: "no-store" });
      const payload = await response.json();

      if (!payload.success || !payload.data) {
        setActiveTimer(null);
        return;
      }

      setActiveTimer({
        id: payload.data.id,
        taskId: payload.data.task_id,
        taskTitle: payload.data.task?.title ?? "Untitled Task",
        plannedSeconds: ((payload.data.task?.planned_hours ?? 0) * 3600) + ((payload.data.task?.planned_minutes ?? 0) * 60),
        elapsedSeconds: payload.data.elapsedSeconds ?? 0,
        status: payload.data.status,
      });
    } catch (error) {
      console.error("[TimerContext] refresh", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refreshActiveTimer();
    }, 0);

    return () => window.clearTimeout(id);
  }, [refreshActiveTimer]);

  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "running") return;

    const interval = window.setInterval(() => {
      setActiveTimer((prev) => {
        if (!prev || prev.status !== "running") return prev;
        return { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeTimer]);

  useEffect(() => {
    autoCompletedRef.current = false;
  }, [activeTimer?.taskId, activeTimer?.id]);

  useEffect(() => {
    const onFocus = () => {
      void refreshActiveTimer();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshActiveTimer();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshActiveTimer]);

  const runTimerAction = useCallback(async (action: "pause" | "resume" | "complete", options?: { silent?: boolean }) => {
    if (!activeTimer) return;

    try {
      setActionLoading(true);
      const response = await fetch("/api/timers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          taskId: activeTimer.taskId,
        }),
      });
      const payload = await response.json();

      if (!payload.success) {
        return;
      }

      await refreshActiveTimer();
      if (action === "complete") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.history }),
          queryClient.invalidateQueries({ queryKey: queryKeys.stats }),
        ]);
        if (!options?.silent) {
          toast.success("Task marked as completed.");
        }
      }
    } catch (error) {
      console.error("[TimerContext] action", error);
    } finally {
      setActionLoading(false);
    }
  }, [activeTimer, queryClient, refreshActiveTimer]);

  const pauseActiveTimer = useCallback(async () => {
    if (!activeTimer || activeTimer.status !== "running" || pausingRef.current) return;

    pausingRef.current = true;
    setActiveTimer((prev) => (prev ? { ...prev, status: "paused" } : prev));

    try {
      await runTimerAction("pause");
    } finally {
      pausingRef.current = false;
    }
  }, [activeTimer, runTimerAction]);

  const extendPlannedSeconds = useCallback((seconds: number) => {
    autoCompletedRef.current = false;
    setActiveTimer((prev) =>
      prev ? { ...prev, plannedSeconds: prev.plannedSeconds + seconds } : prev,
    );
  }, []);

  useEffect(() => {
    if (activeTimer?.status !== "running") return;

    const taskId = activeTimer.taskId;

    const onPageHide = () => {
      pauseTimerKeepalive(taskId);
      setActiveTimer((prev) => (prev?.taskId === taskId ? { ...prev, status: "paused" } : prev));
    };

    const onVisibilityHidden = () => {
      if (document.visibilityState === "hidden") {
        void pauseActiveTimer();
      }
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityHidden);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityHidden);
    };
  }, [activeTimer?.status, activeTimer?.taskId, pauseActiveTimer]);

  useEffect(() => {
    if (
      !activeTimer ||
      activeTimer.status !== "running" ||
      activeTimer.plannedSeconds <= 0 ||
      activeTimer.elapsedSeconds < activeTimer.plannedSeconds ||
      autoCompletedRef.current
    ) {
      return;
    }

    autoCompletedRef.current = true;
    void runTimerAction("complete", { silent: true }).then(() => {
      toast.success("Timer finished — task marked as completed.");
    });
  }, [activeTimer, runTimerAction]);

  const value = useMemo(
    () => ({ activeTimer, loading, actionLoading, refreshActiveTimer, runTimerAction, extendPlannedSeconds }),
    [activeTimer, loading, actionLoading, refreshActiveTimer, runTimerAction, extendPlannedSeconds],
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimerState() {
  const context = useContext(TimerContext);

  if (!context) {
    throw new Error("useTimerState must be used within TimerProvider");
  }

  return context;
}
