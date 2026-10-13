import type { Food, FoodCategory } from "./types";
export type FoodRow = [
  id: string,
  name: string,
  emoji: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  portion: string,
  portionGrams: number,
  keywords?: string,
];
export function foodGroup(category: FoodCategory, rows: FoodRow[]): Food[] {
  return rows.map(
    ([
      id,
      name,
      emoji,
      kcal,
      protein,
      carbs,
      fat,
      portion,
      portionGrams,
      keywords,
    ]) => ({
      id,
      name,
      emoji,
      kcal,
      protein,
      carbs,
      fat,
      portion,
      portionGrams,
      keywords,
      category,
    }),
  );
}
