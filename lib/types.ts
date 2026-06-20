// Domain types for the cooking to-do planner.
// Kept framework-agnostic so the core logic stays pure and testable.

export type Diet = "omnivore" | "vegetarian" | "vegan";
export type MealSlot = "breakfast" | "lunch" | "dinner";

/** A single ingredient as used by one serving of a recipe. */
export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  /** Cost of one `unit` of this ingredient, in the app's currency. */
  unitCost: number;
  /** Allergen / dietary tags, e.g. "dairy", "gluten", "nuts", "meat". */
  tags: string[];
}

export interface Recipe {
  id: string;
  name: string;
  slot: MealSlot;
  diet: Diet;
  prepMinutes: number;
  ingredients: Ingredient[];
}

/** Validated, normalized user request. */
export interface PlanRequest {
  people: number;
  budget: number;
  diet: Diet;
  /** Allergen tags to avoid, e.g. ["dairy", "nuts"]. */
  exclude: string[];
  maxPrepMinutes: number;
}

export interface GroceryItem {
  name: string;
  quantity: number;
  unit: string;
  cost: number;
}

export interface Substitution {
  from: string;
  to: string;
  reason: "allergen" | "diet" | "budget";
}

export interface MealEntry {
  slot: MealSlot;
  recipe: string;
  prepMinutes: number;
  servings: number;
}

export interface PlanResult {
  meals: MealEntry[];
  grocery: GroceryItem[];
  substitutions: Substitution[];
  totalCost: number;
  budget: number;
  feasible: boolean;
  notes: string[];
  /** Which engine produced the plan. */
  source: "gemini" | "rules";
}
