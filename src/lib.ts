import type {
  Activity,
  AppState,
  ExerciseLog,
  Food,
  FoodLog,
  Meal,
  Profile,
} from "./types";

export const STORAGE_KEY = "calorie-studio:v1";

const MEALS: readonly Meal[] = ["早餐", "午餐", "晚餐", "加餐"];
const ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725];
const MAX_LOGS = 100_000;
const MAX_CUSTOM_FOODS = 2000;

export function emptyState(): AppState {
  return {
    version: 1,
    profile: null,
    foodLogs: [],
    exerciseLogs: [],
    customFoods: [],
  };
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isNumber(input: unknown, min: number, max: number): input is number {
  return (
    typeof input === "number" &&
    Number.isFinite(input) &&
    input >= min &&
    input <= max
  );
}

function number(
  input: unknown,
  name: string,
  min: number,
  max: number,
): number {
  if (!isNumber(input, min, max))
    throw new Error(`${name}必须是 ${min} 至 ${max} 之间的有效数字。`);
  return input;
}

function string(input: unknown, name: string, maxLength = 200): string {
  if (typeof input !== "string" || !input.trim() || input.length > maxLength) {
    throw new Error(`${name}格式无效。`);
  }
  return input;
}

function foodUnit(input: unknown): "g" | "ml" {
  if (input === undefined) return "g";
  if (input !== "g" && input !== "ml")
    throw new Error("食物计量单位必须是克（g）或毫升（ml）。");
  return input;
}

function dateString(input: unknown): string {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error("记录日期必须使用 YYYY-MM-DD 格式。");
  }
  const [year, month, day] = input.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    year > 2199 ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error("记录日期无效。");
  }
  return input;
}

function bmrValue(profile: Profile): number {
  return profile.bodyFat !== null
    ? 370 + 21.6 * profile.weight * (1 - profile.bodyFat / 100)
    : 10 * profile.weight +
        6.25 * profile.height -
        5 * profile.age +
        (profile.sex === "male" ? 5 : -161);
}

export function validateProfile(profile: Profile): string | null {
  if (!isObject(profile)) return "身体资料格式无效。";
  if (!isNumber(profile.height, 100, 250)) return "身高需在 100–250 厘米之间。";
  if (!isNumber(profile.weight, 25, 350)) return "体重需在 25–350 公斤之间。";
  if (!isNumber(profile.age, 18, 100) || !Number.isInteger(profile.age))
    return "年龄需为 18–100 岁的整数。";
  if (profile.sex !== "male" && profile.sex !== "female")
    return "请选择用于公式计算的生理性别。";
  if (profile.bodyFat !== null && !isNumber(profile.bodyFat, 3, 65))
    return "体脂率需在 3%–65% 之间，或留空。";
  if (!ACTIVITY_LEVELS.includes(profile.activityLevel))
    return "请选择有效的日常活动水平。";
  if (!["lose", "maintain", "gain", "strictLoss"].includes(profile.goal))
    return "请选择有效的目标。";
  const estimatedBmr = bmrValue(profile);
  if (!Number.isFinite(estimatedBmr) || estimatedBmr <= 0)
    return "这些身体资料无法得到有效的基础代谢估算，请检查身高、体重、年龄和体脂率。";
  return null;
}

function parseProfile(input: unknown): Profile | null {
  if (input === null) return null;
  if (!isObject(input)) throw new Error("身体资料格式无效。");
  const profile = input as unknown as Profile;
  const error = validateProfile(profile);
  if (error) throw new Error(error);
  return {
    height: profile.height,
    weight: profile.weight,
    age: profile.age,
    sex: profile.sex,
    bodyFat: profile.bodyFat,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
  };
}

function parseFoodLog(input: unknown): FoodLog {
  if (!isObject(input)) throw new Error("饮食记录格式无效。");
  if (!MEALS.includes(input.meal as Meal))
    throw new Error("饮食记录的餐次无效。");
  return {
    id: string(input.id, "记录 ID", 100),
    foodId: string(input.foodId, "食物 ID", 100),
    name: string(input.name, "食物名称"),
    emoji: string(input.emoji, "食物图标", 32),
    grams: number(input.grams, "食物用量", 0.1, 10_000),
    unit: foodUnit(input.unit),
    meal: input.meal as Meal,
    date: dateString(input.date),
    kcal: number(input.kcal, "食物热量", 0, 100_000),
    protein: number(input.protein, "蛋白质", 0, 10_000),
    carbs: number(input.carbs, "碳水化合物", 0, 10_000),
    fat: number(input.fat, "脂肪", 0, 10_000),
  };
}

function parseExerciseLog(input: unknown): ExerciseLog {
  if (!isObject(input)) throw new Error("运动记录格式无效。");
  return {
    id: string(input.id, "记录 ID", 100),
    activityId: string(input.activityId, "运动 ID", 100),
    name: string(input.name, "运动名称"),
    emoji: string(input.emoji, "运动图标", 32),
    minutes: number(input.minutes, "运动时长", 0.1, 1440),
    weight: number(input.weight, "运动时体重", 25, 350),
    met: number(input.met, "运动 MET", 0.1, 30),
    date: dateString(input.date),
    kcal: number(input.kcal, "运动热量", 0, 300_000),
  };
}

function parseCustomFood(input: unknown): Food {
  if (!isObject(input)) throw new Error("自定义食物格式无效。");
  const id = string(input.id, "自定义食物 ID", 100);
  if (!id.startsWith("custom-") || !id.slice(7).trim()) {
    throw new Error("自定义食物 ID 格式无效。");
  }
  if (input.category !== "自定义") throw new Error("自定义食物分类无效。");
  const unit = foodUnit(input.unit);
  const nutritionBasis = unit === "ml" ? "每 100 毫升" : "每百克";
  const food: Food = {
    id,
    name: string(input.name, "自定义食物名称", 100),
    category: "自定义",
    emoji: string(input.emoji, "自定义食物图标", 32),
    kcal: number(input.kcal, `${nutritionBasis}热量`, 0, 1000),
    protein: number(input.protein, `${nutritionBasis}蛋白质`, 0, 100),
    carbs: number(input.carbs, `${nutritionBasis}碳水化合物`, 0, 100),
    fat: number(input.fat, `${nutritionBasis}脂肪`, 0, 100),
    portion: string(input.portion, "自定义食物份量名称", 100),
    portionGrams: number(input.portionGrams, "一份食物用量", 0.1, 2000),
    unit,
  };
  if (food.protein + food.carbs + food.fat > 101) {
    throw new Error(
      `${nutritionBasis}食物的蛋白质、碳水和脂肪总量不能超过 100 克（允许 1 克的标签舍入误差）。`,
    );
  }
  if (input.keywords !== undefined) {
    if (typeof input.keywords !== "string" || input.keywords.length > 500) {
      throw new Error("自定义食物搜索关键词格式无效。");
    }
    food.keywords = input.keywords;
  }
  if (input.note !== undefined)
    food.note = string(input.note, "食物参考说明", 500);
  return food;
}

/** Build a fresh, validated state. This never mutates the input or touches storage. */
export function parseState(input: unknown): AppState {
  if (!isObject(input) || input.version !== 1)
    throw new Error("数据格式或版本不受支持，请使用本应用导出的备份。");
  if (
    !Array.isArray(input.foodLogs) ||
    !Array.isArray(input.exerciseLogs) ||
    input.foodLogs.length > MAX_LOGS ||
    input.exerciseLogs.length > MAX_LOGS
  ) {
    throw new Error("记录列表格式无效或记录数量过多。");
  }
  // Version 1 backups made before custom foods existed keep all their records.
  const customFoods = input.customFoods === undefined ? [] : input.customFoods;
  if (!Array.isArray(customFoods) || customFoods.length > MAX_CUSTOM_FOODS) {
    throw new Error("自定义食物列表格式无效，或超过 2,000 项上限。");
  }
  const state: AppState = {
    version: 1,
    profile: parseProfile(input.profile),
    foodLogs: input.foodLogs.map(parseFoodLog),
    exerciseLogs: input.exerciseLogs.map(parseExerciseLog),
    customFoods: customFoods.map(parseCustomFood),
  };
  const ids = new Set<string>();
  for (const log of [...state.foodLogs, ...state.exerciseLogs]) {
    if (ids.has(log.id)) throw new Error("数据中存在重复的记录 ID。");
    ids.add(log.id);
  }
  const foodIds = new Set<string>();
  for (const food of state.customFoods) {
    if (foodIds.has(food.id))
      throw new Error("数据中存在重复的自定义食物 ID。");
    foodIds.add(food.id);
  }
  return state;
}

/** Invalid existing data is surfaced to the caller, never replaced with an empty state. */
export function loadState(): AppState {
  const storage = globalThis.localStorage;
  if (!storage) return emptyState();
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return emptyState();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("已保存的数据无法读取，请先导出原始数据备份，再选择重置。");
  }
  return parseState(parsed);
}

/** Calendar date in the user's local timezone; ISO UTC slicing can select the wrong day. */
export function localDate(date: Date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error("日期无效。");
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

export function shiftDate(iso: string, days: number): string {
  dateString(iso);
  if (!Number.isInteger(days) || Math.abs(days) > 36_600)
    throw new Error("日期偏移无效。");
  const [year, month, day] = iso.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return dateString(shifted.toISOString().slice(0, 10));
}

export function calculateBmr(profile: Profile): {
  value: number;
  method: string;
} {
  const error = validateProfile(profile);
  if (error) throw new Error(error);
  return {
    value: bmrValue(profile),
    method: profile.bodyFat !== null ? "Katch–McArdle" : "Mifflin–St Jeor",
  };
}

export function calculateBudget(profile: Profile): {
  bmr: number;
  maintenance: number;
  target: number;
  method: string;
  bmi: number;
  requestedDeficit: number;
  actualDeficit: number;
  floorApplied: boolean;
  effectiveStatus:
    "maintain" | "lose" | "gain" | "strictLoss" | "bmrFloor" | "lowBmi";
} {
  const { value: bmr, method } = calculateBmr(profile);
  const maintenance = bmr * profile.activityLevel;
  const bmi = profile.weight / (profile.height / 100) ** 2;
  const requestedDeficit =
    profile.goal === "strictLoss"
      ? Math.min(maintenance * 0.2, 500)
      : profile.goal === "lose"
        ? 300
        : 0;
  const lowBmi = profile.goal === "strictLoss" && bmi < 18.5;
  const requestedTarget =
    maintenance -
    (lowBmi ? 0 : requestedDeficit) +
    (profile.goal === "gain" ? 250 : 0);
  const target = Math.max(bmr, requestedTarget);
  const floorApplied = requestedTarget < bmr;
  return {
    bmr,
    maintenance,
    target,
    method,
    bmi,
    requestedDeficit,
    actualDeficit: Math.max(0, maintenance - target),
    floorApplied,
    effectiveStatus: lowBmi
      ? "lowBmi"
      : floorApplied
        ? "bmrFloor"
        : profile.goal,
  };
}

export function calculateNutritionTargets(
  profile: Profile,
  calorieTarget?: number,
): {
  protein: number;
  carbs: number;
  fat: number;
  proteinReference: number;
  proteinLimited: boolean;
} {
  const budget = calculateBudget(profile);
  const target =
    calorieTarget === undefined
      ? budget.target
      : number(calorieTarget, "每日热量预算", 1, 100_000);
  const strict = profile.goal === "strictLoss";
  const proteinReference = profile.weight * (strict ? 2 : 1.2);
  // Standard calculated budgets preserve the original 1.2 g/kg reference.
  // An unusually small explicit override still needs room for the 25% fat share.
  const protein = Math.min(
    proteinReference,
    (target * (strict ? 0.35 : 0.75)) / 4,
  );
  const fat = (target * 0.25) / 9;
  const carbs = Math.max(0, (target - protein * 4 - fat * 9) / 4);
  return {
    protein,
    carbs,
    fat,
    proteinReference,
    proteinLimited: protein < proteinReference,
  };
}

/** Net expenditure above rest, avoiding adding the resting portion a second time. */
export function exerciseCalories(
  met: number,
  weight: number,
  minutes: number,
): number {
  number(met, "运动 MET", 0.1, 30);
  number(weight, "体重", 25, 350);
  number(minutes, "运动时长", 0.1, 1440);
  return ((Math.max(met - 1, 0) * 3.5 * weight) / 200) * minutes;
}

function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues)
    globalThis.crypto.getRandomValues(bytes);
  else
    for (let index = 0; index < bytes.length; index += 1)
      bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function makeCustomFood(input: {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  portionGrams: number;
  unit?: "g" | "ml";
  note?: string;
}): Food {
  if (!isObject(input)) throw new Error("自定义食物格式无效。");
  return parseCustomFood({
    id: `custom-${uuid()}`,
    name: typeof input.name === "string" ? input.name.trim() : input.name,
    category: "自定义",
    emoji: "🍽️",
    kcal: input.kcal,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    portion: "1 份",
    portionGrams: input.portionGrams,
    unit: input.unit,
    note: input.note,
  });
}

export function makeFoodLog(
  food: Food,
  grams: number,
  meal: Meal,
  date: string,
): FoodLog {
  number(grams, "食物用量", 0.1, 10_000);
  const factor = grams / 100;
  const unit = foodUnit(food.unit);
  const nutritionBasis = unit === "ml" ? "每 100 毫升" : "每百克";
  return parseFoodLog({
    id: uuid(),
    foodId: food.id,
    name: food.name,
    emoji: food.emoji,
    grams,
    unit,
    meal,
    date,
    kcal: number(food.kcal, `${nutritionBasis}热量`, 0, 1000) * factor,
    protein: number(food.protein, `${nutritionBasis}蛋白质`, 0, 100) * factor,
    carbs: number(food.carbs, `${nutritionBasis}碳水化合物`, 0, 100) * factor,
    fat: number(food.fat, `${nutritionBasis}脂肪`, 0, 100) * factor,
  });
}

export function makeExerciseLog(
  activity: Activity,
  minutes: number,
  weight: number,
  date: string,
): ExerciseLog {
  return parseExerciseLog({
    id: uuid(),
    activityId: activity.id,
    name: activity.name,
    emoji: activity.emoji,
    minutes,
    weight,
    met: activity.met,
    date,
    kcal: exerciseCalories(activity.met, weight, minutes),
  });
}

export function summarize(
  foodLogs: FoodLog[],
  exerciseLogs: ExerciseLog[],
  date: string,
): {
  intake: number;
  exercise: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  dateString(date);
  const totals = { intake: 0, exercise: 0, protein: 0, carbs: 0, fat: 0 };
  for (const log of foodLogs) {
    if (log.date !== date) continue;
    totals.intake += log.kcal;
    totals.protein += log.protein;
    totals.carbs += log.carbs;
    totals.fat += log.fat;
  }
  for (const log of exerciseLogs)
    if (log.date === date) totals.exercise += log.kcal;
  return totals;
}
