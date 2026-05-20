import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/server/auth";
import { subDays, subMonths, subYears } from "date-fns";
import {
  aggregateDayMetrics,
  buildAbsenceMap,
  computeDayMetrics,
  DAY_LABELS,
  iterateDatesInclusive,
} from "@/lib/utils/task-schedule";
import { buildAttendanceAbsenceDays } from "@/lib/utils/attendance-absence";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type RangeKey = "weekly" | "monthly" | "yearly";

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sumSeconds(items: Array<{ total_seconds?: number | null }>) {
  return items.reduce((sum, item) => sum + (item.total_seconds ?? 0), 0);
}

function buildWeeklyHours(sessions: Array<{ created_at: string; total_seconds: number | null }>) {
  const start = subDays(new Date(), 6);

  return Array.from({ length: 7 }, (_, index) => {
    const date = subDays(start, -index);
    const day = toIsoDate(date);
    const totalSeconds = sessions
      .filter((session) => session.created_at.slice(0, 10) === day)
      .reduce((sum, session) => sum + (session.total_seconds ?? 0), 0);

    return {
      label: DAY_LABELS[date.getDay()] ?? "Day",
      hours: Number((totalSeconds / 3600).toFixed(2)),
    };
  });
}

function buildCompletionTrend(
  tasks: Parameters<typeof computeDayMetrics>[2],
  sessions: Parameters<typeof computeDayMetrics>[3],
  absenceMap: Map<string, string>,
) {
  const end = new Date();
  const start = subDays(end, 6);

  const points: Array<{
    label: string;
    ratio: number;
    assigned: number;
    completed: number;
    excused: number;
    missed: number;
  }> = [];

  iterateDatesInclusive(start, end, (date, dateStr) => {
    const dayLabel = DAY_LABELS[date.getDay()] ?? "Mon";
    const metrics = computeDayMetrics(dateStr, dayLabel, tasks, sessions, absenceMap);
    points.push({
      label: dayLabel,
      ratio: metrics.successRatio,
      assigned: metrics.assigned,
      completed: metrics.completed,
      excused: metrics.excused,
      missed: metrics.missed,
    });
  });

  return points;
}

function buildMonthlyHours(sessions: Array<{ created_at: string; total_seconds: number | null }>) {
  const now = new Date();

  return Array.from({ length: 12 }, (_, index) => {
    const date = subMonths(now, 11 - index);
    const month = date.getMonth();
    const year = date.getFullYear();

    const totalSeconds = sessions
      .filter((session) => {
        const sessionDate = new Date(session.created_at);
        return sessionDate.getMonth() === month && sessionDate.getFullYear() === year;
      })
      .reduce((sum, session) => sum + (session.total_seconds ?? 0), 0);

    return {
      label: monthLabels[month] ?? "Mon",
      hours: Number((totalSeconds / 3600).toFixed(2)),
    };
  });
}

function metricsForDateRange(
  from: Date,
  to: Date,
  tasks: Parameters<typeof computeDayMetrics>[2],
  sessions: Parameters<typeof computeDayMetrics>[3],
  absenceMap: Map<string, string>,
) {
  const days: ReturnType<typeof computeDayMetrics>[] = [];

  iterateDatesInclusive(from, to, (date, dateStr) => {
    const dayLabel = DAY_LABELS[date.getDay()] ?? "Mon";
    days.push(computeDayMetrics(dateStr, dayLabel, tasks, sessions, absenceMap));
  });

  const totals = aggregateDayMetrics(days);

  return {
    totalSeconds: sumSeconds(
      sessions.filter((session) => {
        const day = session.created_at.slice(0, 10);
        return day >= toIsoDate(from) && day <= toIsoDate(to);
      }),
    ),
    totalTasks: totals.assigned,
    tasksCompleted: totals.completed,
    tasksExcused: totals.excused,
    tasksMissed: totals.missed,
    successRatio: totals.successRatio,
  };
}

function attendanceAbsencesForRange(
  attendanceDates: Set<string>,
  excusedDates: Map<string, string>,
  from: Date,
  to: Date,
  todayDate: string,
) {
  const days = buildAttendanceAbsenceDays(attendanceDates, excusedDates, from, to, todayDate);
  return {
    count: days.length,
    pendingCount: days.filter((day) => day.status === "pending").length,
    days: days.map(({ date, label, status }) => ({ date, label, status })),
  };
}

export async function GET() {
  const { supabase, user } = await getServerUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayLabel = DAY_LABELS[today.getDay()] ?? "Mon";
  const todayDate = toIsoDate(today);
  const historyStart = toIsoDate(subYears(today, 1));
  const metadata = user.user_metadata as { full_name?: string };
  const userName =
    metadata.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "there";

  const [tasksRes, sessionsRes, attendanceRes, absencesRes, attendanceAbsencesRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, work_days, frequency, single_date, is_active, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("timer_sessions")
      .select("task_id, created_at, total_seconds, status")
      .eq("user_id", user.id)
      .gte("created_at", `${historyStart}T00:00:00.000Z`),
    supabase
      .from("attendance")
      .select("date")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(365),
    supabase
      .from("task_absences")
      .select("id, task_id, date, reason, created_at")
      .eq("user_id", user.id)
      .gte("date", historyStart)
      .order("date", { ascending: false })
      .limit(500),
    supabase
      .from("attendance_absences")
      .select("date, reason")
      .eq("user_id", user.id)
      .gte("date", historyStart)
      .order("date", { ascending: false })
      .limit(365),
  ]);

  if (
    tasksRes.error ||
    sessionsRes.error ||
    attendanceRes.error ||
    absencesRes.error ||
    attendanceAbsencesRes.error
  ) {
    return NextResponse.json({ success: false, error: "Failed to fetch stats" }, { status: 500 });
  }

  const tasks = tasksRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const absences = absencesRes.data ?? [];
  const absenceMap = buildAbsenceMap(absences);
  const attendanceDates = new Set((attendanceRes.data ?? []).map((row) => row.date));
  const excusedDates = new Map(
    (attendanceAbsencesRes.data ?? []).map((row) => [row.date, row.reason]),
  );

  const todayDayMetrics = computeDayMetrics(todayDate, todayLabel, tasks, sessions, absenceMap);

  const todayMetrics = {
    totalSeconds: sumSeconds(sessions.filter((session) => session.created_at.slice(0, 10) === todayDate)),
    tasksCompleted: todayDayMetrics.completed,
    totalTasks: todayDayMetrics.assigned,
    tasksExcused: todayDayMetrics.excused,
    tasksMissed: todayDayMetrics.missed,
    successRatio: todayDayMetrics.successRatio,
  };

  const ranges: Record<RangeKey, ReturnType<typeof metricsForDateRange>> = {
    weekly: metricsForDateRange(subDays(today, 6), today, tasks, sessions, absenceMap),
    monthly: metricsForDateRange(subMonths(today, 1), today, tasks, sessions, absenceMap),
    yearly: metricsForDateRange(subYears(today, 1), today, tasks, sessions, absenceMap),
  };

  const attendanceAbsences: Record<RangeKey, ReturnType<typeof attendanceAbsencesForRange>> = {
    weekly: attendanceAbsencesForRange(attendanceDates, excusedDates, subDays(today, 6), today, todayDate),
    monthly: attendanceAbsencesForRange(attendanceDates, excusedDates, subMonths(today, 1), today, todayDate),
    yearly: attendanceAbsencesForRange(attendanceDates, excusedDates, subYears(today, 1), today, todayDate),
  };

  const streak = (attendanceRes.data ?? []).reduce((count, row, index, rows) => {
    if (index === 0) return 1;
    const previous = new Date(rows[index - 1].date);
    const current = new Date(row.date);
    const diff = Math.round((previous.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1 && count === index) {
      return count + 1;
    }
    return count;
  }, 0);

  return NextResponse.json({
    success: true,
    data: {
      userName,
      today: {
        ...todayMetrics,
        streak,
      },
      ranges,
      attendanceAbsences,
      charts: {
        weeklyHours: buildWeeklyHours(sessions),
        completionTrend: buildCompletionTrend(tasks, sessions, absenceMap),
        monthlyHours: buildMonthlyHours(sessions),
      },
    },
  });
}
