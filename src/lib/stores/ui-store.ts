import { create } from "zustand";
import { persist } from "zustand/middleware";

type RangeKey = "weekly" | "monthly" | "yearly";

type UiStore = {
  weeklyAbsencesOpen: boolean;
  absencesRange: RangeKey;
  setWeeklyAbsencesOpen: (open: boolean, range?: RangeKey) => void;
  dismissedAbsenceDates: string[];
  dismissAbsenceDate: (date: string) => void;
  clearDismissedAbsences: () => void;
};

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      weeklyAbsencesOpen: false,
      absencesRange: "weekly",
      setWeeklyAbsencesOpen: (open, range = "weekly") =>
        set({ weeklyAbsencesOpen: open, absencesRange: range }),
      dismissedAbsenceDates: [],
      dismissAbsenceDate: (date) =>
        set((state) => ({
          dismissedAbsenceDates: state.dismissedAbsenceDates.includes(date)
            ? state.dismissedAbsenceDates
            : [...state.dismissedAbsenceDates, date],
        })),
      clearDismissedAbsences: () => set({ dismissedAbsenceDates: [] }),
    }),
    {
      name: "workspace-tracker-ui",
      partialize: (state) => ({ dismissedAbsenceDates: state.dismissedAbsenceDates }),
    },
  ),
);
