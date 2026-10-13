import { shiftDate } from "./lib";
import type { Activity, ExerciseLog } from "./types";

export interface TrainingWeekSummary {
  start: string;
  end: string;
  strengthDays: number;
  strengthMinutes: number;
  aerobicEquivalentMinutes: number;
}

const aerobicCategories = new Set<Activity["category"]>([
  "有氧运动",
  "球类运动",
  "户外运动",
  "日常活动",
]);

/** Monday–Sunday totals, clipped to supported dates; recorded MET preserves training history. */
export function summarizeTrainingWeek(
  logs: ExerciseLog[],
  activities: Activity[],
  selectedDate: string,
): TrainingWeekSummary {
  const date = shiftDate(selectedDate, 0);
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const [year, month, day] = date.split("-").map(Number);
  const mondayOffset = -((weekday + 6) % 7);
  const calendarDate = (offset: number) =>
    new Date(Date.UTC(year, month - 1, day + offset))
      .toISOString()
      .slice(0, 10);
  const desiredStart = calendarDate(mondayOffset);
  const desiredEnd = calendarDate(mondayOffset + 6);
  const start = desiredStart < "1900-01-01" ? "1900-01-01" : desiredStart;
  const end = desiredEnd > "2199-12-31" ? "2199-12-31" : desiredEnd;
  const activityById = new Map(
    activities.map((activity) => [activity.id, activity]),
  );
  const strengthByDate = new Map<string, number>();
  let strengthMinutes = 0;
  let aerobicEquivalentMinutes = 0;

  for (const log of logs) {
    if (log.date < start || log.date > end) continue;
    const activity = activityById.get(log.activityId);
    // Imported records may refer to a removed or unavailable activity.
    if (!activity) continue;

    if (activity.category === "力量训练") {
      strengthMinutes += log.minutes;
      strengthByDate.set(
        log.date,
        (strengthByDate.get(log.date) ?? 0) + log.minutes,
      );
    } else if (aerobicCategories.has(activity.category) && log.met >= 3) {
      aerobicEquivalentMinutes += log.minutes * (log.met >= 6 ? 2 : 1);
    }
  }

  return {
    start,
    end,
    strengthDays: [...strengthByDate.values()].filter(
      (minutes) => minutes >= 20,
    ).length,
    strengthMinutes,
    aerobicEquivalentMinutes,
  };
}
