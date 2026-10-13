import assert from "node:assert/strict";
import test from "node:test";
import { summarizeTrainingWeek } from "../src/training-plan";
import type { Activity, ExerciseLog } from "../src/types";

function activity(
  id: string,
  category: Activity["category"],
  met = 4,
): Activity {
  return {
    id,
    category,
    met,
    name: id,
    emoji: "🏃",
    intensity: "中强度",
    description: id,
  };
}

function log(
  id: string,
  activityId: string,
  date: string,
  minutes: number,
  met = 4,
): ExerciseLog {
  return {
    id,
    activityId,
    date,
    minutes,
    met,
    name: activityId,
    emoji: "🏃",
    weight: 70,
    kcal: 100,
  };
}

const strength = activity("strength", "力量训练", 6);
const cardio = activity("cardio", "有氧运动", 8);

test("training weeks run Monday to Sunday across a year boundary", () => {
  for (const date of ["2025-12-29", "2026-01-01", "2026-01-04"]) {
    assert.deepEqual(summarizeTrainingWeek([], [], date), {
      start: "2025-12-29",
      end: "2026-01-04",
      strengthDays: 0,
      strengthMinutes: 0,
      aerobicEquivalentMinutes: 0,
    });
  }
  assert.equal(summarizeTrainingWeek([], [], "2026-01-05").start, "2026-01-05");
  assert.equal(summarizeTrainingWeek([], [], "2026-01-05").end, "2026-01-11");
});

test("calendar weeks remain correct around a daylight saving change and leap day", () => {
  const spring = summarizeTrainingWeek([], [], "2026-03-08");
  assert.equal(spring.start, "2026-03-02");
  assert.equal(spring.end, "2026-03-08");
  const leap = summarizeTrainingWeek([], [], "2024-02-29");
  assert.equal(leap.start, "2024-02-26");
  assert.equal(leap.end, "2024-03-03");
});

test("weeks at the supported date limits stay within the valid calendar range", () => {
  const first = summarizeTrainingWeek([], [], "1900-01-01");
  assert.equal(first.start, "1900-01-01");
  assert.equal(first.end, "1900-01-07");
  const last = summarizeTrainingWeek([], [], "2199-12-31");
  assert.equal(last.start, "2199-12-30");
  assert.equal(last.end, "2199-12-31");
  assert.equal(last.strengthDays, 0);
  assert.equal(last.strengthMinutes, 0);
  assert.equal(last.aerobicEquivalentMinutes, 0);
});

test("the week includes both endpoints and excludes records from adjacent weeks", () => {
  const result = summarizeTrainingWeek(
    [
      log("old-strength", "strength", "2025-12-28", 100),
      log("monday-strength", "strength", "2025-12-29", 20),
      log("sunday-cardio", "cardio", "2026-01-04", 25, 3),
      log("next-cardio", "cardio", "2026-01-05", 100, 8),
    ],
    [strength, cardio],
    "2026-01-01",
  );
  assert.equal(result.strengthDays, 1);
  assert.equal(result.strengthMinutes, 20);
  assert.equal(result.aerobicEquivalentMinutes, 25);
});

test("strength sessions accumulate per day with a twenty minute threshold and count each day once", () => {
  const result = summarizeTrainingWeek(
    [
      log("a1", "strength", "2025-12-29", 10),
      log("a2", "strength", "2025-12-29", 9),
      log("b1", "strength", "2025-12-30", 8),
      log("b2", "strength", "2025-12-30", 12),
      log("c1", "strength", "2025-12-31", 20),
      log("c2", "strength", "2025-12-31", 40),
      log("d1", "strength", "2026-01-01", 10),
    ],
    [strength],
    "2026-01-01",
  );
  assert.equal(result.strengthDays, 2);
  assert.equal(result.strengthMinutes, 109);
  assert.equal(result.aerobicEquivalentMinutes, 0);
});

test("aerobic equivalents use recorded MET rather than the current activity MET", () => {
  const result = summarizeTrainingWeek(
    [
      log("vigorous-record", "low-catalog-met", "2026-01-01", 40, 6),
      log("moderate-record", "high-catalog-met", "2026-01-01", 10, 3),
      log("light-record", "high-catalog-met", "2026-01-01", 50, 2.9),
    ],
    [
      activity("low-catalog-met", "有氧运动", 2),
      activity("high-catalog-met", "有氧运动", 10),
    ],
    "2026-01-01",
  );
  assert.equal(result.aerobicEquivalentMinutes, 90);
});

test("eligible categories count moderate minutes once and vigorous minutes twice without counting strength or mind-body training", () => {
  const sports = activity("sports", "球类运动");
  const outdoors = activity("outdoors", "户外运动");
  const daily = activity("daily", "日常活动");
  const yoga = activity("yoga", "身心训练");
  const result = summarizeTrainingWeek(
    [
      log("a", "cardio", "2026-01-01", 30, 3),
      log("b", "sports", "2026-01-01", 20, 5.9),
      log("c", "outdoors", "2026-01-01", 15, 6),
      log("d", "daily", "2026-01-01", 10, 3),
      log("e", "daily", "2026-01-01", 50, 2.9),
      log("f", "strength", "2026-01-01", 45, 8),
      log("g", "yoga", "2026-01-01", 60, 7),
    ],
    [cardio, sports, outdoors, daily, strength, yoga],
    "2026-01-01",
  );
  assert.equal(result.aerobicEquivalentMinutes, 90);
  assert.equal(result.strengthMinutes, 45);
  assert.equal(result.strengthDays, 1);
});

test("unknown and absent activity IDs are excluded even when their names match a known activity", () => {
  const records = [
    log("known", "strength", "2026-01-01", 15, 8),
    { ...log("unknown", "removed", "2026-01-01", 100, 8), name: strength.name },
    log("missing-id", "", "2026-01-01", 50, 8),
  ];
  const result = summarizeTrainingWeek(records, [strength], "2026-01-01");
  assert.equal(result.strengthMinutes, 15);
  assert.equal(result.strengthDays, 0);
  assert.equal(result.aerobicEquivalentMinutes, 0);
  const withoutCatalog = summarizeTrainingWeek(records, [], "2026-01-01");
  assert.equal(withoutCatalog.strengthMinutes, 0);
  assert.equal(withoutCatalog.strengthDays, 0);
  assert.equal(withoutCatalog.aerobicEquivalentMinutes, 0);
});
