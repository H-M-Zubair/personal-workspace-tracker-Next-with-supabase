"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, ListTodo, Settings, Timer, Pause, Play, Check } from "lucide-react";
import LogoutButton from "@/components/layout/logout-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useTimerState } from "@/lib/context/timer-context";
import { formatDuration } from "@/lib/utils/time";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/today", label: "Today", icon: Timer },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { activeTimer, actionLoading, runTimerAction } = useTimerState();

  const remaining = activeTimer
    ? Math.max(0, activeTimer.plannedSeconds - activeTimer.elapsedSeconds)
    : 0;

  return (
    <aside className="w-full border-b border-slate-200 bg-white p-4 md:w-64 md:border-b-0 md:border-r">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Workspace Tracker</h2>
      <nav className="flex flex-wrap gap-2 md:flex-col">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-blue-50 hover:text-blue-700",
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {activeTimer ? (
        <div className={`mt-4 rounded-lg border p-3 ${activeTimer.status === "completed" ? "border-emerald-300 bg-emerald-50" : "border-blue-200 bg-blue-50"}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-xs font-semibold ${activeTimer.status === "completed" ? "text-emerald-700" : "text-blue-700"}`}>
                Active timer
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{activeTimer.taskTitle}</p>
              <p className="text-xs text-slate-600">
                {activeTimer.status === "completed"
                  ? "Completed"
                  : `${activeTimer.status} - ${formatDuration(remaining)}`}
              </p>
            </div>
            {activeTimer.status === "completed" ? (
              <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Completed" />
            ) : null}
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actionLoading || activeTimer.status !== "running"}
              onClick={() => void runTimerAction("pause")}
            >
              <Pause className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actionLoading || activeTimer.status !== "paused"}
              onClick={() => void runTimerAction("resume")}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actionLoading || activeTimer.status === "completed"}
              onClick={() => void runTimerAction("complete")}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <LogoutButton />
      </div>
    </aside>
  );
}
