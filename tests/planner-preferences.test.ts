import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TRAINING_PREFERENCES,
  STORAGE_KEY,
  emptyState,
  loadState,
  makeCustomFood,
  makeExerciseLog,
  makeFoodLog,
  parseState,
  parseTrainingPreferences,
  shiftDate,
  summarize,
} from "../src/lib";
import type { Activity, Profile, TrainingPreferences } from "../src/types";

const profile: Profile = {
  height: 175,
  weight: 100,
  age: 30,
  sex: "male",
  bodyFat: null,
  activityLevel: 1.2,
  goal: "extremeLoss",
};
const activity: Activity = {
  id: "test-walking",
  name: "测试步行",
  category: "有氧运动",
  emoji: "🚶",
  met: 3.5,
  intensity: "中强度",
  description: "合成测试活动",
};

test("empty states use the user's defaults and independent preference/completion values", () => {
  assert.deepEqual(DEFAULT_TRAINING_PREFERENCES, {
    equipment: "gym",
    sessionMinutes: 45,
    experience: "beginner",
    avoidImpact: true,
    avoidKneeLoad: true,
    avoidWristLoad: false,
    avoidOverhead: false,
    preferredStartTime: "10:00",
    unavailableStart: "17:00",
    unavailableEnd: "18:00",
  });
  const first = emptyState();
  const second = emptyState();
  first.trainingPreferences.equipment = "none";
  first.completedWorkoutDates.push("2026-10-13");
  assert.deepEqual(second.trainingPreferences, DEFAULT_TRAINING_PREFERENCES);
  assert.deepEqual(second.completedWorkoutDates, []);
  assert.notEqual(second.trainingPreferences, DEFAULT_TRAINING_PREFERENCES);
  assert.notEqual(first.trainingPreferences, second.trainingPreferences);
  assert.notEqual(first.completedWorkoutDates, second.completedWorkoutDates);
});

test("legacy version 1 imports gain preferences without changing profiles, IDs or logged nutrition", () => {
  const customFood = makeCustomFood({
    name: "旧饮品",
    kcal: 69,
    protein: 1,
    carbs: 16,
    fat: 0,
    portionGrams: 200,
    unit: "ml",
    note: "原始标签说明",
  });
  const foodLog = makeFoodLog(customFood, 200, "加餐", "2026-10-12");
  const exerciseLog = makeExerciseLog(activity, 30, 100, "2026-10-12");
  for (const goal of [
    "lose",
    "maintain",
    "gain",
    "strictLoss",
    "extremeLoss",
  ] as const) {
    const legacy = {
      version: 1,
      profile: { ...profile, goal },
      foodLogs: [foodLog],
      exerciseLogs: [exerciseLog],
      customFoods: [customFood],
    };
    const original = JSON.stringify(legacy);
    const restored = parseState(legacy);
    assert.equal(STORAGE_KEY, "calorie-studio:v1");
    assert.equal(restored.version, 1);
    assert.deepEqual(restored.profile, legacy.profile);
    assert.deepEqual(restored.foodLogs, legacy.foodLogs);
    assert.deepEqual(restored.exerciseLogs, legacy.exerciseLogs);
    assert.deepEqual(restored.customFoods, legacy.customFoods);
    assert.deepEqual(
      restored.trainingPreferences,
      DEFAULT_TRAINING_PREFERENCES,
    );
    assert.deepEqual(restored.completedWorkoutDates, []);
    assert.equal(JSON.stringify(legacy), original);
  }
  const earliest = parseState({
    version: 1,
    profile: null,
    foodLogs: [],
    exerciseLogs: [],
  });
  assert.deepEqual(earliest, emptyState());
});

test("JSON backups retain chosen preferences and completion dates without adding exercise calories", () => {
  const trainingPreferences: TrainingPreferences = {
    equipment: "dumbbells",
    sessionMinutes: 30,
    experience: "regular",
    avoidImpact: false,
    avoidKneeLoad: false,
    avoidWristLoad: true,
    avoidOverhead: true,
    preferredStartTime: "08:30",
    unavailableStart: "",
    unavailableEnd: "",
  };
  const state = {
    ...emptyState(),
    profile,
    trainingPreferences,
    completedWorkoutDates: ["2026-10-13", "2026-10-12"],
  };
  const original = JSON.stringify(state);
  const restored = parseState(JSON.parse(original));
  assert.deepEqual(restored, state);
  assert.notEqual(restored.trainingPreferences, state.trainingPreferences);
  assert.notEqual(restored.completedWorkoutDates, state.completedWorkoutDates);
  restored.trainingPreferences.preferredStartTime = "09:00";
  restored.completedWorkoutDates.push("2026-10-14");
  assert.equal(JSON.stringify(state), original);
  assert.deepEqual(restored.exerciseLogs, []);
  assert.equal(summarize([], restored.exerciseLogs, "2026-10-13").exercise, 0);
});

test("preferences reject missing fields, unsupported choices and coerced booleans", () => {
  const valid = { ...DEFAULT_TRAINING_PREFERENCES };
  const parsed = parseTrainingPreferences(valid);
  assert.deepEqual(parsed, valid);
  assert.notEqual(parsed, valid);
  for (const invalid of [undefined, null, [], "gym", 42]) {
    assert.throws(() => parseTrainingPreferences(invalid));
  }
  for (const key of Object.keys(valid)) {
    const incomplete = { ...valid } as Record<string, unknown>;
    delete incomplete[key];
    assert.throws(() => parseTrainingPreferences(incomplete), key);
  }
  for (const patch of [
    { equipment: "barbell" },
    { equipment: null },
    { equipment: "GYM" },
    { experience: "advanced" },
    { sessionMinutes: "45" },
    { sessionMinutes: 40 },
    { sessionMinutes: NaN },
    { sessionMinutes: Infinity },
    { unexpectedSetting: true },
  ]) {
    assert.throws(() => parseTrainingPreferences({ ...valid, ...patch }));
    assert.throws(() =>
      parseState({
        ...emptyState(),
        trainingPreferences: { ...valid, ...patch },
      }),
    );
  }
  for (const key of [
    "avoidImpact",
    "avoidKneeLoad",
    "avoidWristLoad",
    "avoidOverhead",
  ] as const) {
    for (const value of [null, undefined, 0, 1, "true", "false", [], {}]) {
      assert.throws(() => parseTrainingPreferences({ ...valid, [key]: value }));
    }
  }
  for (const equipment of ["none", "dumbbells", "gym"] as const) {
    for (const sessionMinutes of [20, 30, 45, 60] as const) {
      assert.equal(
        parseTrainingPreferences({ ...valid, equipment, sessionMinutes })
          .sessionMinutes,
        sessionMinutes,
      );
    }
  }
});

test("training time must be strict HH:mm, within the day and outside the entire unavailable interval", () => {
  const valid = { ...DEFAULT_TRAINING_PREFERENCES };
  for (const preferredStartTime of [
    "",
    "9:00",
    "09:0",
    "24:00",
    "12:60",
    "-1:00",
    "09:00:00",
    " 09:00",
    "09:00\n",
    900,
    null,
  ]) {
    assert.throws(() =>
      parseTrainingPreferences({ ...valid, preferredStartTime }),
    );
  }
  for (const preferredStartTime of ["16:16", "16:59", "17:00", "17:59"]) {
    assert.throws(
      () => parseTrainingPreferences({ ...valid, preferredStartTime }),
      /重叠/,
    );
  }
  for (const preferredStartTime of ["16:15", "18:00"]) {
    assert.equal(
      parseTrainingPreferences({ ...valid, preferredStartTime })
        .preferredStartTime,
      preferredStartTime,
    );
  }
  assert.throws(
    () =>
      parseTrainingPreferences({
        ...valid,
        preferredStartTime: "16:30",
        sessionMinutes: 60,
      }),
    /重叠/,
  );
  for (const patch of [
    { unavailableStart: "", unavailableEnd: "18:00" },
    { unavailableStart: "17:00", unavailableEnd: "" },
    { unavailableStart: "17:00", unavailableEnd: "17:00" },
    { unavailableStart: "18:00", unavailableEnd: "17:00" },
    { unavailableStart: "23:00", unavailableEnd: "01:00" },
    { unavailableStart: "17:60" },
    { unavailableEnd: "24:00" },
  ]) {
    assert.throws(() => parseTrainingPreferences({ ...valid, ...patch }));
  }
  assert.equal(
    parseTrainingPreferences({
      ...valid,
      preferredStartTime: "17:00",
      unavailableStart: "",
      unavailableEnd: "",
    }).preferredStartTime,
    "17:00",
  );
  assert.equal(
    parseTrainingPreferences({
      ...valid,
      preferredStartTime: "23:40",
      sessionMinutes: 20,
    }).preferredStartTime,
    "23:40",
  );
  assert.throws(
    () =>
      parseTrainingPreferences({
        ...valid,
        preferredStartTime: "23:41",
        sessionMinutes: 20,
      }),
    /当天/,
  );
});

test("completion imports accept only unique supported calendar dates, with a 10,000 date limit", () => {
  const state = emptyState();
  for (const completedWorkoutDates of [
    null,
    {},
    "2026-10-13",
    [null],
    [""],
    ["2026-2-01"],
    ["2026-02-29"],
    ["1900-02-29"],
    ["2026-04-31"],
    ["1899-12-31"],
    ["2200-01-01"],
    ["2026-10-13T00:00:00Z"],
    ["2026-10-13\n"],
    ["2026-10-13", "2026-10-13"],
    new Array(1),
  ]) {
    assert.throws(() => parseState({ ...state, completedWorkoutDates }));
  }
  const boundaries = ["1900-01-01", "2000-02-29", "2199-12-31"];
  assert.deepEqual(
    parseState({ ...state, completedWorkoutDates: boundaries })
      .completedWorkoutDates,
    boundaries,
  );
  const dates = Array.from({ length: 10_000 }, (_, index) =>
    shiftDate("1900-01-01", index),
  );
  assert.equal(
    parseState({ ...state, completedWorkoutDates: dates }).completedWorkoutDates
      .length,
    10_000,
  );
  assert.throws(
    () =>
      parseState({
        ...state,
        completedWorkoutDates: [...dates, shiftDate("1900-01-01", 10_000)],
      }),
    /10,000/,
  );
});

test("stored preferences and completion dates load without writing or hiding corrupt settings", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const state = {
    ...emptyState(),
    completedWorkoutDates: ["2026-10-13"],
    trainingPreferences: {
      ...DEFAULT_TRAINING_PREFERENCES,
      equipment: "none" as const,
      sessionMinutes: 20 as const,
    },
  };
  let raw = JSON.stringify(state);
  let writes = 0;
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => {
          assert.equal(key, STORAGE_KEY);
          return raw;
        },
        setItem: () => {
          writes += 1;
        },
      },
    });
    assert.deepEqual(loadState(), state);
    raw = JSON.stringify({
      ...state,
      trainingPreferences: {
        ...state.trainingPreferences,
        avoidImpact: "true",
      },
    });
    assert.throws(() => loadState(), /布尔值/);
    raw = JSON.stringify({
      ...state,
      completedWorkoutDates: ["2026-02-30"],
    });
    assert.throws(() => loadState(), /日期/);
    assert.equal(writes, 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
