import { z } from "zod";

export const taskSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
    category: z
      .enum(["Work", "Personal", "Learning", "Health", "Other"])
      .default("Work"),
    priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
    plannedHours: z.number().int().min(0),
    plannedMinutes: z.number().int().min(0).max(59),
    frequency: z.enum(["once", "repeat"]).default("repeat"),
    singleDate: z.string().date().optional(),
    workDays: z
      .array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]))
      .default([]),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    const plannedSeconds =
      value.plannedHours * 3600 + value.plannedMinutes * 60;
    if (plannedSeconds <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Planned time must be greater than 0.",
        path: ["plannedHours"],
      });
    }

    if (value.frequency === "repeat" && value.workDays.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one work day for repeat tasks.",
        path: ["workDays"],
      });
    }
  });

export const attendanceSchema = z.object({
  date: z.string().date().optional(),
});

export const timerSchema = z.object({
  taskId: z.string().uuid(),
  action: z.enum(["start", "pause", "resume", "complete"]),
  totalSeconds: z.number().int().nonnegative().optional(),
});

export const taskAbsenceSchema = z.object({
  taskId: z.string().uuid(),
  date: z.string().date(),
  reason: z.string().trim().min(5).max(500),
});

export const attendanceAbsenceSchema = z.object({
  date: z.string().date(),
  reason: z.string().trim().min(5).max(500),
});
