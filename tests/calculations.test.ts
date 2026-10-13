import assert from "node:assert/strict";
import test from "node:test";
import {
  STORAGE_KEY,
  calculateBmr,
  calculateBudget,
  calculateNutritionTargets,
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

test("strict loss requests at most 20% or 500 kcal and reports the effective BMR floor", () => {
  const moderate = calculateBudget({
    ...profile,
    goal: "strictLoss",
    activityLevel: 1.375,
  });
  closeTo(moderate.requestedDeficit, moderate.maintenance * 0.2);
  closeTo(moderate.actualDeficit, moderate.requestedDeficit);
  closeTo(moderate.target, moderate.maintenance * 0.8);
  assert.equal(moderate.floorApplied, false);
  assert.equal(moderate.effectiveStatus, "strictLoss");

  const active = calculateBudget({
    ...profile,
    goal: "strictLoss",
    activityLevel: 1.55,
  });
  assert.equal(active.requestedDeficit, 500);
  closeTo(active.actualDeficit, 500);
  closeTo(active.target, active.maintenance - 500);
  assert.equal(active.floorApplied, false);

  const floor = calculateBudget({ ...profile, goal: "strictLoss" });
  assert.equal(floor.target, floor.bmr);
  closeTo(floor.requestedDeficit, floor.maintenance * 0.2);
  closeTo(floor.actualDeficit, floor.maintenance - floor.bmr);
  assert.ok(floor.actualDeficit < floor.requestedDeficit);
  assert.equal(floor.floorApplied, true);
  assert.equal(floor.effectiveStatus, "bmrFloor");
});

test("strict loss maintains calories below BMI 18.5 and resumes at the threshold", () => {
  const underweight = calculateBudget({
    ...profile,
    height: 180,
    weight: 55,
    activityLevel: 1.55,
    goal: "strictLoss",
  });
  assert.ok(underweight.bmi < 18.5);
  assert.ok(underweight.requestedDeficit > 0);
  assert.equal(underweight.actualDeficit, 0);
  assert.equal(underweight.target, underweight.maintenance);
  assert.equal(underweight.floorApplied, false);
  assert.equal(underweight.effectiveStatus, "lowBmi");
  const threshold = calculateBudget({
    ...profile,
    height: 200,
    weight: 74,
    activityLevel: 1.55,
    goal: "strictLoss",
  });
  assert.equal(threshold.bmi, 18.5);
  assert.ok(threshold.actualDeficit > 0);
  assert.equal(threshold.effectiveStatus, "strictLoss");
  // The three established goals retain their original calculation behavior.
  const oldLoss = calculateBudget({
    ...profile,
    height: 180,
    weight: 55,
    activityLevel: 1.55,
    goal: "lose",
  });
  closeTo(oldLoss.target, oldLoss.maintenance - 300);
});

test("extreme loss requests at most 25% or 600 kcal and exposes the protected budget floor", () => {
  const moderate = calculateBudget({
    ...profile,
    goal: "extremeLoss",
    activityLevel: 1.375,
  });
  closeTo(moderate.requestedDeficit, moderate.maintenance * 0.25);
  closeTo(moderate.actualDeficit, moderate.requestedDeficit);
  closeTo(moderate.target, moderate.maintenance * 0.75);
  assert.equal(moderate.floorApplied, false);
  assert.equal(moderate.effectiveStatus, "extremeLoss");
  assert.equal(moderate.budgetFloor, moderate.bmr);

  const active = calculateBudget({
    ...profile,
    goal: "extremeLoss",
    activityLevel: 1.55,
  });
  assert.equal(active.requestedDeficit, 600);
  closeTo(active.actualDeficit, 600);
  closeTo(active.target, active.maintenance - 600);

  const bmrFloor = calculateBudget({ ...profile, goal: "extremeLoss" });
  assert.equal(bmrFloor.target, bmrFloor.bmr);
  assert.equal(bmrFloor.budgetFloor, bmrFloor.bmr);
  assert.equal(bmrFloor.floorApplied, true);
  assert.equal(bmrFloor.effectiveStatus, "bmrFloor");
  assert.ok(bmrFloor.actualDeficit < bmrFloor.requestedDeficit);
});

test("extreme loss respects male and female intake floors without inventing a deficit", () => {
  const male = calculateBudget({
    ...profile,
    height: 165,
    weight: 60,
    age: 65,
    sex: "male",
    goal: "extremeLoss",
  });
  assert.ok(male.bmr < 1500);
  assert.equal(male.budgetFloor, 1500);
  assert.equal(male.target, 1500);
  assert.equal(male.effectiveStatus, "intakeFloor");
  assert.equal(male.floorApplied, true);
  closeTo(male.actualDeficit, male.maintenance - 1500);

  const female = calculateBudget({
    ...profile,
    height: 150,
    weight: 60,
    age: 60,
    sex: "female",
    goal: "extremeLoss",
  });
  assert.ok(female.bmr < 1200);
  assert.equal(female.budgetFloor, 1200);
  assert.equal(female.target, 1200);
  assert.equal(female.effectiveStatus, "intakeFloor");
  closeTo(female.actualDeficit, female.maintenance - 1200);

  for (const sex of ["female", "male"] as const) {
    const belowFloor = calculateBudget({
      ...profile,
      height: 100,
      weight: 25,
      age: 100,
      sex,
      goal: "extremeLoss",
    });
    assert.ok(belowFloor.bmi >= 18.5);
    assert.ok(belowFloor.maintenance < belowFloor.budgetFloor);
    assert.equal(belowFloor.target, sex === "male" ? 1500 : 1200);
    assert.equal(belowFloor.actualDeficit, 0);
    assert.equal(belowFloor.effectiveStatus, "intakeFloor");
    assert.equal(belowFloor.floorApplied, true);
  }
});

test("extreme loss stops cutting below BMI 18.5 while retaining any higher nutrition floor", () => {
  const underweight = calculateBudget({
    ...profile,
    height: 180,
    weight: 55,
    activityLevel: 1.55,
    goal: "extremeLoss",
  });
  assert.ok(underweight.bmi < 18.5);
  assert.equal(underweight.target, underweight.maintenance);
  assert.equal(underweight.actualDeficit, 0);
  assert.equal(underweight.effectiveStatus, "lowBmi");
  assert.equal(underweight.floorApplied, false);

  const floorAboveMaintenance = calculateBudget({
    ...profile,
    height: 150,
    weight: 25,
    age: 100,
    sex: "female",
    goal: "extremeLoss",
  });
  assert.ok(floorAboveMaintenance.bmi < 18.5);
  assert.ok(
    floorAboveMaintenance.maintenance < floorAboveMaintenance.budgetFloor,
  );
  assert.equal(floorAboveMaintenance.target, 1200);
  assert.equal(floorAboveMaintenance.actualDeficit, 0);
  assert.equal(floorAboveMaintenance.effectiveStatus, "lowBmi");
  assert.equal(floorAboveMaintenance.floorApplied, true);

  const threshold = calculateBudget({
    ...profile,
    height: 200,
    weight: 74,
    activityLevel: 1.55,
    goal: "extremeLoss",
  });
  assert.equal(threshold.bmi, 18.5);
  assert.ok(threshold.actualDeficit > 0);
  assert.equal(threshold.effectiveStatus, "extremeLoss");
});

test("extreme nutrition uses 2.2 g/kg reference with a 35% energy cap and preserves older modes", () => {
  const extremeProfile: Profile = {
    ...profile,
    goal: "extremeLoss",
    activityLevel: 1.55,
  };
  const budget = calculateBudget(extremeProfile);
  const nutrition = calculateNutritionTargets(extremeProfile);
  closeTo(nutrition.proteinReference, profile.weight * 2.2);
  closeTo(nutrition.protein, profile.weight * 2.2);
  assert.equal(nutrition.proteinLimited, false);
  closeTo(nutrition.fat * 9, budget.target * 0.25);
  closeTo(
    nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9,
    budget.target,
  );

  const cappedProfile: Profile = {
    ...profile,
    height: 150,
    sex: "female",
    age: 60,
    goal: "extremeLoss",
  };
  const cappedBudget = calculateBudget(cappedProfile);
  const cappedNutrition = calculateNutritionTargets(cappedProfile);
  assert.equal(cappedNutrition.proteinLimited, true);
  closeTo(cappedNutrition.protein * 4, cappedBudget.target * 0.35);
  closeTo(cappedNutrition.carbs * 4, cappedBudget.target * 0.4);
  closeTo(cappedNutrition.fat * 9, cappedBudget.target * 0.25);

  for (const goal of ["lose", "maintain", "gain", "strictLoss"] as const) {
    const older = { ...profile, goal };
    const olderBudget = calculateBudget(older);
    assert.equal(olderBudget.budgetFloor, olderBudget.bmr);
    const olderNutrition = calculateNutritionTargets(older);
    assert.equal(
      olderNutrition.proteinReference,
      profile.weight * (goal === "strictLoss" ? 2 : 1.2),
    );
  }
});

test("strict nutrition uses body weight protein with an energy cap and balanced fat/carbs", () => {
  const strictProfile: Profile = {
    ...profile,
    goal: "strictLoss",
    activityLevel: 1.375,
  };
  const target = calculateBudget(strictProfile).target;
  const nutrition = calculateNutritionTargets(strictProfile);
  assert.equal(nutrition.proteinReference, 140);
  assert.equal(nutrition.protein, 140);
  assert.equal(nutrition.proteinLimited, false);
  closeTo(nutrition.fat * 9, target * 0.25);
  closeTo(
    nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9,
    target,
  );

  const cappedProfile: Profile = {
    ...strictProfile,
    sex: "female",
    height: 150,
    age: 60,
    activityLevel: 1.2,
  };
  const cappedTarget = calculateBudget(cappedProfile).target;
  const capped = calculateNutritionTargets(cappedProfile);
  assert.equal(capped.proteinReference, 140);
  assert.equal(capped.proteinLimited, true);
  closeTo(capped.protein * 4, cappedTarget * 0.35);
  closeTo(capped.carbs * 4, cappedTarget * 0.4);
  closeTo(capped.fat * 9, cappedTarget * 0.25);

  const withoutFat = calculateNutritionTargets(strictProfile, 2000);
  const withFat = calculateNutritionTargets(
    { ...strictProfile, bodyFat: 20 },
    2000,
  );
  assert.deepEqual(withFat, withoutFat);
  for (const goal of ["lose", "maintain", "gain"] as const) {
    const oldProfile = { ...profile, goal };
    const oldTarget = calculateBudget(oldProfile).target;
    const oldNutrition = calculateNutritionTargets(oldProfile);
    assert.equal(oldNutrition.protein, profile.weight * 1.2);
    assert.equal(oldNutrition.proteinLimited, false);
    closeTo(oldNutrition.fat, (oldTarget * 0.25) / 9);
    closeTo(
      oldNutrition.carbs,
      (oldTarget * 0.75 - profile.weight * 1.2 * 4) / 4,
    );
  }
});

test("nutrition stays finite, nonnegative and calorie-balanced across accepted boundary profiles", () => {
  for (const height of [100, 250])
    for (const weight of [25, 350])
      for (const age of [18, 100]) {
        for (const sex of ["male", "female"] as const)
          for (const bodyFat of [null, 3, 65]) {
            for (const activityLevel of [1.2, 1.375, 1.55, 1.725])
              for (const goal of [
                "lose",
                "maintain",
                "gain",
                "strictLoss",
                "extremeLoss",
              ] as const) {
                const boundary: Profile = {
                  height,
                  weight,
                  age,
                  sex,
                  bodyFat,
                  activityLevel,
                  goal,
                };
                const budget = calculateBudget(boundary);
                const nutrition = calculateNutritionTargets(boundary);
                for (const value of [
                  nutrition.protein,
                  nutrition.carbs,
                  nutrition.fat,
                  nutrition.proteinReference,
                ]) {
                  assert.ok(Number.isFinite(value) && value >= 0);
                }
                closeTo(
                  nutrition.protein * 4 +
                    nutrition.carbs * 4 +
                    nutrition.fat * 9,
                  budget.target,
                );
                if (goal === "strictLoss" || goal === "extremeLoss")
                  assert.ok(
                    nutrition.protein * 4 <= budget.target * 0.35 + 1e-8,
                  );
                else assert.equal(nutrition.protein, weight * 1.2);
                if (goal === "extremeLoss") {
                  assert.ok(
                    budget.target >=
                      Math.max(budget.bmr, sex === "male" ? 1500 : 1200),
                  );
                  assert.ok(budget.actualDeficit >= 0);
                  assert.ok(
                    budget.actualDeficit <= budget.requestedDeficit + 1e-8,
                  );
                }
              }
          }
      }
  for (const target of [1, 2000, 100_000]) {
    const nutrition = calculateNutritionTargets(
      { ...profile, goal: "strictLoss" },
      target,
    );
    closeTo(
      nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9,
      target,
    );
  }
  for (const target of [NaN, Infinity, -1, 0, 100_001])
    assert.throws(() => calculateNutritionTargets(profile, target));
});

test("new bounded loss goals and established goals round-trip without changing stored records", () => {
  const foodLog = makeFoodLog(rice, 150, "午餐", "2026-10-12");
  const exerciseLog = makeExerciseLog(running, 30, 70, "2026-10-12");
  for (const goal of [
    "lose",
    "maintain",
    "gain",
    "strictLoss",
    "extremeLoss",
  ] as const) {
    const selectedProfile = { ...profile, goal };
    assert.equal(validateProfile(selectedProfile), null);
    const state = {
      ...emptyState(),
      profile: selectedProfile,
      foodLogs: [foodLog],
      exerciseLogs: [exerciseLog],
    };
    const restored = parseState(JSON.parse(JSON.stringify(state)));
    assert.deepEqual(restored, state);
    assert.equal(restored.foodLogs[0].id, foodLog.id);
    assert.equal(restored.foodLogs[0].foodId, "rice");
    assert.equal(restored.exerciseLogs[0].id, exerciseLog.id);
    assert.equal(restored.version, 1);
  }
  assert.equal(STORAGE_KEY, "calorie-studio:v1");
  assert.throws(() =>
    parseState({
      ...emptyState(),
      profile: { ...profile, goal: "strict_loss" },
    }),
  );
  assert.throws(() =>
    parseState({
      ...emptyState(),
      profile: { ...profile, goal: "extreme_loss" },
    }),
  );
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
            for (const goal of [
              "lose",
              "maintain",
              "gain",
              "strictLoss",
              "extremeLoss",
            ] as const) {
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
    ...emptyState(),
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

test("milliliter food labels scale by measured volume and survive JSON backups", () => {
  const drink = makeCustomFood({
    name: "测试饮品",
    kcal: 69,
    protein: 1,
    carbs: 16,
    fat: 0,
    portionGrams: 100,
    unit: "ml",
    note: "合成测试标签：数值按每 100 ml 填写。",
  });
  assert.equal(drink.unit, "ml");
  const bottle = makeFoodLog(drink, 100, "加餐", "2026-10-12");
  const twoBottles = makeFoodLog(drink, 200, "加餐", "2026-10-12");
  assert.equal(bottle.kcal, 69);
  assert.equal(twoBottles.kcal, 138);
  assert.equal(twoBottles.grams, 200);
  assert.equal(twoBottles.unit, "ml");
  assert.equal(twoBottles.protein, 2);
  assert.equal(twoBottles.carbs, 32);
  const riceLog = makeFoodLog(rice, 100, "午餐", "2026-10-12");
  assert.equal(riceLog.unit, "g");
  const state = {
    ...emptyState(),
    profile,
    customFoods: [drink],
    foodLogs: [bottle, twoBottles, riceLog],
  };
  const restored = parseState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.equal(restored.customFoods[0].note, drink.note);
  assert.equal(restored.customFoods[0].unit, "ml");
  assert.equal(restored.foodLogs[1].unit, "ml");
  assert.equal(summarize([twoBottles, riceLog], [], "2026-10-12").intake, 254);
});

test("legacy gram records and custom foods gain g units without changing historical amounts or nutrition", () => {
  const { unit: ignoredLogUnit, ...oldLog } = makeFoodLog(
    rice,
    150,
    "午餐",
    "2026-10-12",
  );
  const { unit: ignoredFoodUnit, ...oldCustom } = makeCustomFood({
    name: "旧自定义食物",
    kcal: 116,
    protein: 2.6,
    carbs: 25.6,
    fat: 0.3,
    portionGrams: 150,
  });
  const exerciseLog = makeExerciseLog(running, 30, 70, "2026-10-12");
  const legacy = {
    version: 1,
    profile,
    foodLogs: [oldLog],
    exerciseLogs: [exerciseLog],
    customFoods: [oldCustom],
  };
  const before = JSON.stringify(legacy);
  const migrated = parseState(legacy);
  const { unit: logUnit, ...migratedLog } = migrated.foodLogs[0];
  const { unit: customUnit, ...migratedCustom } = migrated.customFoods[0];
  assert.equal(logUnit, "g");
  assert.equal(customUnit, "g");
  assert.deepEqual(migratedLog, oldLog);
  assert.deepEqual(migratedCustom, oldCustom);
  assert.deepEqual(migrated.profile, profile);
  assert.deepEqual(migrated.exerciseLogs, [exerciseLog]);
  assert.equal(migrated.version, 1);
  assert.equal(STORAGE_KEY, "calorie-studio:v1");
  assert.equal(JSON.stringify(legacy), before);
  assert.deepEqual(parseState(JSON.parse(JSON.stringify(migrated))), migrated);
});

test("food units and optional label notes are validated without losing metadata", () => {
  const input = {
    name: "单位测试",
    kcal: 69,
    protein: 1,
    carbs: 16,
    fat: 0,
    portionGrams: 100,
  };
  const custom = makeCustomFood(input);
  const log = makeFoodLog(custom, 100, "加餐", "2026-10-12");
  for (const invalidUnit of [null, "kg", "ML", "毫升", 100, []]) {
    assert.throws(() =>
      parseState({
        ...emptyState(),
        foodLogs: [{ ...log, unit: invalidUnit }],
      }),
    );
    assert.throws(() =>
      parseState({
        ...emptyState(),
        customFoods: [{ ...custom, unit: invalidUnit }],
      }),
    );
    assert.throws(() =>
      makeCustomFood({ ...input, unit: invalidUnit } as Parameters<
        typeof makeCustomFood
      >[0]),
    );
    assert.throws(() =>
      makeFoodLog(
        { ...custom, unit: invalidUnit } as Food,
        100,
        "加餐",
        "2026-10-12",
      ),
    );
  }
  for (const invalidNote of [null, 42, [], "", "   ", "a".repeat(501)]) {
    assert.throws(() =>
      parseState({
        ...emptyState(),
        customFoods: [{ ...custom, note: invalidNote }],
      }),
    );
    assert.throws(() =>
      makeCustomFood({ ...input, note: invalidNote } as Parameters<
        typeof makeCustomFood
      >[0]),
    );
  }
  const noted = makeCustomFood({ ...input, unit: "ml", note: "a".repeat(500) });
  const restored = parseState({ ...emptyState(), customFoods: [noted] });
  assert.equal(restored.customFoods[0].note, noted.note);
  assert.equal(restored.customFoods[0].unit, "ml");
  assert.equal(custom.unit, "g");
  assert.equal(custom.note, undefined);
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
