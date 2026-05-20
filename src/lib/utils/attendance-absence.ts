import { differenceInCalendarDays, format, subDays } from "date-fns";

export type AttendanceAbsenceDay = {
  date: string;
  label: string;
  status: "excused" | "pending";
};

export function formatAbsenceDayLabel(dateStr: string, today = new Date()) {
  const date = new Date(`${dateStr}T12:00:00`);
  const diff = differenceInCalendarDays(today, date);

  if (diff === 1) return "Yesterday";
  if (diff === 2) return "2 days ago";
  return format(date, "EEE, MMM d");
}

export function buildAttendanceAbsenceDays(
  attendanceDates: Set<string>,
  excusedDates: Map<string, string>,
  from: Date,
  to: Date,
  todayDate: string,
): AttendanceAbsenceDay[] {
  const days: AttendanceAbsenceDay[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (dateStr < todayDate && !attendanceDates.has(dateStr)) {
      const reason = excusedDates.get(dateStr);
      days.push({
        date: dateStr,
        label: formatAbsenceDayLabel(dateStr),
        status: reason ? "excused" : "pending",
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function pendingAttendanceAbsences(days: AttendanceAbsenceDay[]) {
  return days.filter((day) => day.status === "pending");
}

export function lookbackStart(days: number) {
  return subDays(new Date(), days - 1);
}
