export type FoodCategory =
  | "主食谷物"
  | "肉蛋水产"
  | "蔬菜菌菇"
  | "水果"
  | "奶豆坚果"
  | "饮品零食"
  | "中式菜肴"
  | "调味与油脂"
  | "自定义";
export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  emoji: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: string;
  portionGrams: number;
  keywords?: string;
  unit?: "g" | "ml";
  note?: string;
}
export type ActivityCategory =
  "有氧运动" | "力量训练" | "球类运动" | "户外运动" | "日常活动" | "身心训练";
export interface Activity {
  id: string;
  name: string;
  category: ActivityCategory;
  emoji: string;
  met: number;
  intensity: "低强度" | "中强度" | "高强度";
  description: string;
}
export type Meal = "早餐" | "午餐" | "晚餐" | "加餐";
export interface FoodLog {
  id: string;
  foodId: string;
  name: string;
  emoji: string;
  grams: number;
  unit?: "g" | "ml";
  meal: Meal;
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}
export interface ExerciseLog {
  id: string;
  activityId: string;
  name: string;
  emoji: string;
  minutes: number;
  weight: number;
  met: number;
  date: string;
  kcal: number;
}
export interface Profile {
  height: number;
  weight: number;
  age: number;
  sex: "female" | "male";
  bodyFat: number | null;
  activityLevel: number;
  goal: "lose" | "maintain" | "gain" | "strictLoss";
}
export interface AppState {
  version: 1;
  profile: Profile | null;
  foodLogs: FoodLog[];
  exerciseLogs: ExerciseLog[];
  customFoods: Food[];
}
