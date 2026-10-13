import assert from "node:assert/strict";
import test from "node:test";
import {
  STORAGE_KEY,
  calculateBmr,
  calculateBudget,
  emptyState,
  exerciseCalories,
  loadState,
  localDate,
  makeCustomFood,
  makeExerciseLog,
  makeFoodLog,
  parseState,
  shiftDate,
  summarize,
  validateProfile,
} from "../src/lib";
import type { Activity, Food, Profile } from "../src/types";
import {
  activities,
  activityCategories,
  foods,
  foodCategories,
} from "../src/data";

const profile: Profile = {
  height: 175,
  weight: 70,
  age: 30,
  sex: "male",
  bodyFat: null,
  activityLevel: 1.2,
  goal: "maintain",
};
const rice: Food = {
  id: "rice",
  name: "米饭",
  category: "主食谷物",
  emoji: "🍚",
  kcal: 116,
  protein: 2.6,
  carbs: 25.9,
  fat: 0.3,
  portion: "一碗",
  portionGrams: 150,
};
const running: Activity = {
  id: "run",
  name: "跑步",
  category: "有氧运动",
  emoji: "🏃",
  met: 8,
  intensity: "高强度",
  description: "慢跑",
};
const closeTo = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test("BMR uses sex-adjusted Mifflin and lean mass when body fat is available", () => {
  closeTo(calculateBmr(profile).value, 1648.75);
  closeTo(calculateBmr({ ...profile, sex: "female" }).value, 1482.75);
  const result = calculateBmr({ ...profile, bodyFat: 20 });
  closeTo(result.value, 1579.6);
  assert.equal(result.method, "Katch–McArdle");
  assert.equal(calculateBmr(profile).method, "Mifflin–St Jeor");
});

test("budget applies daily activity and goal with a BMR lower bound", () => {
  const maintenance = 1648.75 * 1.2;
  closeTo(calculateBudget(profile).target, maintenance);
  closeTo(
    calculateBudget({ ...profile, goal: "lose" }).target,
    maintenance - 300,
  );
  closeTo(
    calculateBudget({ ...profile, goal: "gain" }).target,
    maintenance + 250,
  );
  const small: Profile = {
    height: 150,
    weight: 40,
    age: 60,
    sex: "female",
    bodyFat: null,
    activityLevel: 1.2,
    goal: "lose",
  };
  const budget = calculateBudget(small);
  assert.equal(budget.target, budget.bmr);
});

test("all accepted boundary profiles produce finite positive BMR and calorie budgets", () => {
  const lowestMifflin = {
    ...profile,
    height: 100,
    weight: 25,
    age: 100,
    sex: "female" as const,
  };
  assert.equal(calculateBmr(lowestMifflin).value, 214);
  for (const height of [100, 250])
    for (const weight of [25, 350])
      for (const age of [18, 100]) {
        for (const sex of ["male", "female"] as const)
          for (const bodyFat of [null, 3, 65]) {
            for (const goal of ["lose", "maintain", "gain"] as const) {
              const boundaryProfile: Profile = {
                ...profile,
                height,
                weight,
                age,
                sex,
                bodyFat,
                goal,
              };
              assert.equal(validateProfile(boundaryProfile), null);
              const result = calculateBudget(boundaryProfile);
              for (const value of [
                result.bmr,
                result.maintenance,
                result.target,
              ]) {
                assert.ok(Number.isFinite(value) && value > 0);
              }
              assert.ok(result.target >= result.bmr);
            }
          }
      }
});

test("exercise calories count expenditure above rest and validate inputs", () => {
  closeTo(exerciseCalories(8, 70, 30), 257.25);
  assert.equal(exerciseCalories(1, 70, 30), 0);
  assert.equal(exerciseCalories(0.95, 70, 30), 0);
  for (const args of [
    [NaN, 70, 30],
    [8, -70, 30],
    [8, 70, 0],
    [99, 70, 30],
    [8, 70, 1441],
  ]) {
    assert.throws(() => exerciseCalories(args[0], args[1], args[2]));
  }
});

test("logs retain portion nutrition, historical weight, dates, and unique UUIDs", () => {
  const food = makeFoodLog(rice, 150, "午餐", "2026-10-12");
  const exercise = makeExerciseLog(running, 30, 70, "2026-10-12");
  assert.equal(food.kcal, 174);
  closeTo(food.protein, 3.9);
  closeTo(food.carbs, 38.85);
  closeTo(food.fat, 0.45);
  assert.equal(exercise.weight, 70);
  closeTo(exercise.kcal, 257.25);
  const uuidPattern =
    /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;
  assert.match(food.id, uuidPattern);
  assert.match(exercise.id, uuidPattern);
  assert.notEqual(food.id, exercise.id);
  assert.throws(() => makeFoodLog(rice, 0, "午餐", "2026-10-12"));
  assert.throws(() => makeFoodLog(rice, 150, "午餐", "2026-02-30"));
  assert.throws(() => makeExerciseLog(running, 30, 1, "2026-10-12"));
});

test("daily summaries combine both meals and exclude other dates", () => {
  const foods = [
    makeFoodLog(rice, 100, "午餐", "2026-10-12"),
    makeFoodLog(rice, 50, "晚餐", "2026-10-12"),
    makeFoodLog(rice, 100, "早餐", "2026-10-11"),
  ];
  const exercises = [
    makeExerciseLog(running, 30, 70, "2026-10-12"),
    makeExerciseLog(running, 60, 70, "2026-10-11"),
  ];
  const result = summarize(foods, exercises, "2026-10-12");
  assert.equal(result.intake, 174);
  closeTo(result.protein, 3.9);
  closeTo(result.carbs, 38.85);
  closeTo(result.fat, 0.45);
  assert.equal(result.exercise, 257.25);
  assert.deepEqual(summarize(foods, exercises, "2026-10-10"), {
    intake: 0,
    exercise: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
});

test("import validates schema, numbers, dates and record identity without mutating input", () => {
  const state = {
    version: 1 as const,
    profile,
    foodLogs: [makeFoodLog(rice, 100, "午餐", "2026-10-12")],
    exerciseLogs: [makeExerciseLog(running, 30, 70, "2026-10-12")],
    customFoods: [],
  };
  const parsed = parseState(state);
  assert.deepEqual(parsed, state);
  assert.notEqual(parsed, state);
  assert.notEqual(parsed.profile, state.profile);
  assert.notEqual(parsed.foodLogs[0], state.foodLogs[0]);
  for (const bad of [
    null,
    [],
    {},
    { ...state, version: 2 },
    { ...state, profile: undefined },
    { ...state, foodLogs: {} },
    { ...state, exerciseLogs: null },
  ]) {
    assert.throws(() => parseState(bad));
  }
  for (const bad of [NaN, Infinity, -1, "116", 1e20]) {
    assert.throws(() =>
      parseState({ ...state, foodLogs: [{ ...state.foodLogs[0], kcal: bad }] }),
    );
  }
  for (const patch of [
    { grams: 0 },
    { protein: -1 },
    { carbs: Infinity },
    { fat: 1e20 },
    { meal: "夜宵" },
    { date: "2026-02-29" },
    { date: "2026-13-01" },
    { date: "2026-10-12T00:00:00Z" },
    { id: "" },
    { name: "" },
  ]) {
    assert.throws(() =>
      parseState({ ...state, foodLogs: [{ ...state.foodLogs[0], ...patch }] }),
    );
  }
  for (const patch of [
    { met: NaN },
    { met: 1000 },
    { minutes: -1 },
    { weight: 1 },
    { date: "2026-04-31" },
    { kcal: -1 },
  ]) {
    assert.throws(() =>
      parseState({
        ...state,
        exerciseLogs: [{ ...state.exerciseLogs[0], ...patch }],
      }),
    );
  }
  assert.throws(() =>
    parseState({ ...state, foodLogs: [state.foodLogs[0], state.foodLogs[0]] }),
  );
  assert.deepEqual(parseState(emptyState()), emptyState());
});

test("legacy version 1 backups gain an empty custom catalog without losing profiles or logs", () => {
  const legacy = {
    version: 1,
    profile,
    foodLogs: [makeFoodLog(rice, 150, "午餐", "2026-10-12")],
    exerciseLogs: [makeExerciseLog(running, 30, 70, "2026-10-12")],
  };
  const before = JSON.stringify(legacy);
  const migrated = parseState(JSON.parse(before));
  assert.equal(STORAGE_KEY, "calorie-studio:v1");
  assert.equal(migrated.version, 1);
  assert.deepEqual(migrated.profile, legacy.profile);
  assert.deepEqual(migrated.foodLogs, legacy.foodLogs);
  assert.deepEqual(migrated.exerciseLogs, legacy.exerciseLogs);
  assert.deepEqual(migrated.customFoods, []);
  assert.equal(JSON.stringify(legacy), before);
  assert.deepEqual(parseState(JSON.parse(JSON.stringify(migrated))), migrated);
});

test("custom food nutrition survives JSON backup and logging at the chosen portion", () => {
  const custom = makeCustomFood({
    name: "  我的蛋白麦片  ",
    kcal: 250,
    protein: 12,
    carbs: 34,
    fat: 7,
    portionGrams: 150,
  });
  assert.equal(custom.name, "我的蛋白麦片");
  assert.equal(custom.category, "自定义");
  assert.equal(custom.emoji, "🍽️");
  assert.equal(custom.portion, "1 份");
  assert.match(
    custom.id,
    /^custom-[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
  );
  const log = makeFoodLog(custom, custom.portionGrams, "早餐", "2026-10-12");
  assert.equal(log.kcal, 375);
  assert.equal(log.protein, 18);
  assert.equal(log.carbs, 51);
  assert.equal(log.fat, 10.5);
  assert.equal(log.foodId, custom.id);
  const state = {
    ...emptyState(),
    profile,
    customFoods: [custom],
    foodLogs: [log],
  };
  const restored = parseState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.notEqual(restored.customFoods, state.customFoods);
  assert.notEqual(restored.customFoods[0], state.customFoods[0]);
  restored.customFoods[0].name = "改名";
  assert.equal(state.customFoods[0].name, "我的蛋白麦片");
  const unknownMacros = makeCustomFood({
    name: "只知道热量的包装食品",
    kcal: 400,
    protein: 0,
    carbs: 0,
    fat: 0,
    portionGrams: 50,
  });
  assert.equal(makeFoodLog(unknownMacros, 50, "加餐", "2026-10-12").kcal, 200);
  assert.notEqual(unknownMacros.id, custom.id);
});

test("custom food imports reject malformed catalogs, invalid labels/numbers and duplicate IDs", () => {
  const custom = makeCustomFood({
    name: "自定义米饭",
    kcal: 116,
    protein: 2.6,
    carbs: 25.6,
    fat: 0.3,
    portionGrams: 150,
  });
  const state = { ...emptyState(), customFoods: [custom] };
  for (const customFoods of [
    null,
    {},
    "food",
    [null],
    new Array(2001).fill(custom),
  ]) {
    assert.throws(() => parseState({ ...state, customFoods }));
  }
  assert.throws(
    () => parseState({ ...state, customFoods: [custom, custom] }),
    /重复/,
  );
  const badPatches = [
    { id: "white-rice" },
    { id: "custom-" },
    { category: "主食谷物" },
    { name: " " },
    { name: "a".repeat(101) },
    { emoji: "" },
    { portion: "" },
    { portionGrams: 0 },
    { portionGrams: 2001 },
    { kcal: -1 },
    { kcal: NaN },
    { kcal: Infinity },
    { kcal: "116" },
    { kcal: 1001 },
    { protein: -1 },
    { protein: 101 },
    { carbs: undefined },
    { fat: Infinity },
    { protein: 50, carbs: 50, fat: 2 },
    { keywords: 42 },
    { keywords: "a".repeat(501) },
  ];
  for (const patch of badPatches) {
    assert.throws(() =>
      parseState({ ...state, customFoods: [{ ...custom, ...patch }] }),
    );
  }
  assert.equal(
    parseState({
      ...state,
      customFoods: [{ ...custom, protein: 100, carbs: 1, fat: 0 }],
    }).customFoods.length,
    1,
  );
  assert.equal(
    parseState({
      ...state,
      customFoods: [{ ...custom, keywords: "麦片 cereal" }],
    }).customFoods[0].keywords,
    "麦片 cereal",
  );
  assert.equal(
    parseState({
      ...state,
      customFoods: Array.from({ length: 2000 }, (_, index) => ({
        ...custom,
        id: `custom-import-${index}`,
      })),
    }).customFoods.length,
    2000,
  );
  for (const patch of [
    { name: "" },
    { kcal: NaN },
    { portionGrams: 0 },
    { protein: 50, carbs: 50, fat: 2 },
  ]) {
    assert.throws(() =>
      makeCustomFood({
        name: custom.name,
        kcal: custom.kcal,
        protein: custom.protein,
        carbs: custom.carbs,
        fat: custom.fat,
        portionGrams: custom.portionGrams,
        ...patch,
      }),
    );
  }
});

test("body profile accepts adult ranges and rejects invalid body fat and activity values", () => {
  assert.equal(validateProfile(profile), null);
  assert.equal(validateProfile({ ...profile, bodyFat: 3 }), null);
  assert.equal(validateProfile({ ...profile, bodyFat: 65 }), null);
  for (const patch of [
    { height: NaN },
    { weight: 0 },
    { age: 17 },
    { age: 30.5 },
    { age: 101 },
    { bodyFat: 0 },
    { bodyFat: 66 },
    { bodyFat: undefined },
    { activityLevel: 2 },
    { sex: "other" },
    { goal: "unknown" },
  ]) {
    const invalid = { ...profile, ...patch } as Profile;
    assert.ok(validateProfile(invalid));
    assert.throws(() => calculateBmr(invalid));
    assert.throws(() => parseState({ ...emptyState(), profile: invalid }));
  }
});

test("calendar helpers handle leap years, year boundaries, local timezone and DST", () => {
  assert.equal(shiftDate("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftDate("2024-02-29", 1), "2024-03-01");
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDate("2026-03-08", 1), "2026-03-09");
  assert.throws(() => shiftDate("2026-02-29", 1));
  assert.throws(() => shiftDate("2026-10-12", NaN));
  assert.throws(() => shiftDate("2026-10-12", 0.5));
  assert.throws(() => localDate(new Date("invalid")));
  const originalTimezone = process.env.TZ;
  try {
    process.env.TZ = "Asia/Shanghai";
    assert.equal(localDate(new Date("2026-01-01T18:30:00Z")), "2026-01-02");
    process.env.TZ = "America/Los_Angeles";
    assert.equal(localDate(new Date("2026-01-01T01:30:00Z")), "2025-12-31");
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("loading never silently replaces damaged stored data or writes to storage", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let raw: string | null = null;
  let writes = 0;
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: undefined,
    });
    assert.deepEqual(loadState(), emptyState());
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
    assert.deepEqual(loadState(), emptyState());
    raw = JSON.stringify({ ...emptyState(), profile });
    assert.deepEqual(loadState().profile, profile);
    raw = JSON.stringify({
      version: 1,
      profile,
      foodLogs: [],
      exerciseLogs: [],
    });
    assert.deepEqual(loadState(), { ...emptyState(), profile });
    raw = "{broken";
    assert.throws(() => loadState(), /无法读取/);
    raw = JSON.stringify({
      ...emptyState(),
      profile: { ...profile, weight: -2 },
    });
    assert.throws(() => loadState());
    assert.equal(writes, 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("food catalog has diverse populated categories, unique IDs and usable nutrition/portions", () => {
  assert.ok(foods.length >= 400);
  assert.ok(foodCategories.length >= 8);
  assert.ok(!foodCategories.includes("自定义"));
  assert.equal(new Set(foodCategories).size, foodCategories.length);
  assert.equal(new Set(foods.map((food) => food.id)).size, foods.length);
  assert.equal(new Set(foods.map((food) => food.name)).size, foods.length);
  for (const category of foodCategories)
    assert.ok(
      foods.filter((food) => food.category === category).length >= 10,
      category,
    );
  for (const food of foods) {
    assert.ok(foodCategories.includes(food.category), food.name);
    assert.ok(
      food.id.trim() &&
        food.name.trim() &&
        food.emoji.trim() &&
        food.portion.trim(),
      food.name,
    );
    assert.ok(
      Number.isFinite(food.kcal) && food.kcal >= 0 && food.kcal <= 1000,
      food.name,
    );
    for (const macro of [food.protein, food.carbs, food.fat]) {
      assert.ok(
        Number.isFinite(macro) && macro >= 0 && macro <= 100,
        food.name,
      );
    }
    assert.ok(
      food.protein + food.carbs + food.fat <= 101,
      `${food.name}: macros exceed 100 g`,
    );
    assert.ok(
      Number.isFinite(food.portionGrams) &&
        food.portionGrams > 0 &&
        food.portionGrams <= 2000,
      food.name,
    );
    // Fiber, food-specific Atwater factors and rounding justify modest differences,
    // while this bound catches a mismatched cooked/raw row or misplaced decimal.
    const macroEnergy = 4 * food.protein + 4 * food.carbs + 9 * food.fat;
    assert.ok(
      Math.abs(food.kcal - macroEnergy) <= Math.max(40, food.kcal * 0.25),
      `${food.name}: ${food.kcal} kcal disagrees with ${macroEnergy} macro kcal`,
    );
    assert.equal(
      makeFoodLog(food, food.portionGrams, "午餐", "2026-10-12").foodId,
      food.id,
    );
  }
});

test("activity catalog has diverse populated categories, unique IDs and valid MET estimates", () => {
  assert.ok(activities.length >= 50);
  assert.equal(activityCategories.length, 6);
  assert.equal(new Set(activityCategories).size, activityCategories.length);
  assert.equal(
    new Set(activities.map((activity) => activity.id)).size,
    activities.length,
  );
  for (const category of activityCategories)
    assert.ok(
      activities.filter((activity) => activity.category === category).length >=
        5,
      category,
    );
  for (const activity of activities) {
    assert.ok(activityCategories.includes(activity.category), activity.name);
    assert.ok(
      activity.id.trim() &&
        activity.name.trim() &&
        activity.emoji.trim() &&
        activity.description.trim(),
      activity.name,
    );
    assert.ok(
      ["低强度", "中强度", "高强度"].includes(activity.intensity),
      activity.name,
    );
    assert.ok(
      Number.isFinite(activity.met) && activity.met >= 1 && activity.met <= 20,
      activity.name,
    );
    const log = makeExerciseLog(activity, 30, 70, "2026-10-12");
    assert.ok(Number.isFinite(log.kcal) && log.kcal >= 0, activity.name);
    assert.equal(log.activityId, activity.id);
  }
});
