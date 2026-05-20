"use client";

import { ReactNode } from "react";
import Sidebar from "@/components/layout/sidebar";
import { TimerProvider } from "@/lib/context/timer-context";
import QueryProvider from "@/components/providers/query-provider";
import AttendanceAbsencePrompt from "@/components/dashboard/attendance-absence-prompt";

export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <TimerProvider>
        <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
          <Sidebar />
          <main className="flex-1 p-6">{children}</main>
          <AttendanceAbsencePrompt />
        </div>
      </TimerProvider>
    </QueryProvider>
  );
}
