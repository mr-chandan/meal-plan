// Curated recipe bank + substitution rules.
// Costs are per-serving estimates in INR; tune freely.

import type { Ingredient, Recipe } from "./types.ts";

const ing = (
  name: string,
  quantity: number,
  unit: string,
  unitCost: number,
  tags: string[] = []
): Ingredient => ({ name, quantity, unit, unitCost, tags });

export const RECIPES: Recipe[] = [
  // ---- Breakfast ----
  {
    id: "veg-poha",
    name: "Vegetable Poha",
    slot: "breakfast",
    diet: "vegan",
    prepMinutes: 15,
    ingredients: [
      ing("Flattened rice (poha)", 60, "g", 0.08),
      ing("Onion", 0.5, "pc", 8),
      ing("Peanuts", 15, "g", 0.2, ["nuts"]),
      ing("Mustard oil", 10, "ml", 0.18),
    ],
  },
  {
    id: "egg-toast",
    name: "Egg & Avocado Toast",
    slot: "breakfast",
    diet: "omnivore",
    prepMinutes: 12,
    ingredients: [
      ing("Bread", 2, "slice", 6, ["gluten"]),
      ing("Egg", 2, "pc", 7, ["egg"]),
      ing("Avocado", 0.5, "pc", 40),
      ing("Butter", 10, "g", 0.5, ["dairy"]),
    ],
  },
  {
    id: "oats-bowl",
    name: "Banana Oats Bowl",
    slot: "breakfast",
    diet: "vegetarian",
    prepMinutes: 8,
    ingredients: [
      ing("Rolled oats", 50, "g", 0.12),
      ing("Milk", 200, "ml", 0.06, ["dairy"]),
      ing("Banana", 1, "pc", 10),
      ing("Honey", 10, "g", 0.4),
    ],
  },

  // ---- Lunch ----
  {
    id: "rajma-rice",
    name: "Rajma Chawal",
    slot: "lunch",
    diet: "vegan",
    prepMinutes: 35,
    ingredients: [
      ing("Kidney beans (rajma)", 80, "g", 0.18),
      ing("Rice", 90, "g", 0.06),
      ing("Onion", 1, "pc", 8),
      ing("Tomato", 1, "pc", 9),
    ],
  },
  {
    id: "paneer-wrap",
    name: "Paneer Tikka Wrap",
    slot: "lunch",
    diet: "vegetarian",
    prepMinutes: 25,
    ingredients: [
      ing("Tortilla", 1, "pc", 12, ["gluten"]),
      ing("Paneer", 100, "g", 0.5, ["dairy"]),
      ing("Yogurt", 40, "g", 0.12, ["dairy"]),
      ing("Bell pepper", 0.5, "pc", 15),
    ],
  },
  {
    id: "chicken-bowl",
    name: "Grilled Chicken Rice Bowl",
    slot: "lunch",
    diet: "omnivore",
    prepMinutes: 30,
    ingredients: [
      ing("Chicken breast", 120, "g", 0.4, ["meat"]),
      ing("Rice", 90, "g", 0.06),
      ing("Broccoli", 80, "g", 0.25),
      ing("Olive oil", 10, "ml", 0.3),
    ],
  },

  // ---- Dinner ----
  {
    id: "dal-roti",
    name: "Dal Tadka & Roti",
    slot: "dinner",
    diet: "vegan",
    prepMinutes: 30,
    ingredients: [
      ing("Toor dal", 70, "g", 0.16),
      ing("Wheat flour", 80, "g", 0.05, ["gluten"]),
      ing("Onion", 0.5, "pc", 8),
      ing("Ghee", 10, "g", 0.6, ["dairy"]),
    ],
  },
  {
    id: "veg-pasta",
    name: "Creamy Veg Pasta",
    slot: "dinner",
    diet: "vegetarian",
    prepMinutes: 25,
    ingredients: [
      ing("Pasta", 100, "g", 0.14, ["gluten"]),
      ing("Cream", 50, "ml", 0.3, ["dairy"]),
      ing("Mushroom", 80, "g", 0.3),
      ing("Garlic", 5, "g", 0.2),
    ],
  },
  {
    id: "fish-curry",
    name: "Fish Curry & Rice",
    slot: "dinner",
    diet: "omnivore",
    prepMinutes: 35,
    ingredients: [
      ing("Fish fillet", 150, "g", 0.5, ["fish"]),
      ing("Rice", 90, "g", 0.06),
      ing("Coconut milk", 100, "ml", 0.2),
      ing("Curry leaves", 5, "g", 0.3),
    ],
  },
];

/**
 * Replacement rules keyed by ingredient tag. Each provides an allergen/diet
 * safe alternative and a budget-friendly alternative. `removesTags` lists the
 * tags the replacement no longer carries.
 */
export interface SubRule {
  /** Cheaper or safer ingredient name. */
  to: string;
  /** Cost multiplier vs the original unitCost. */
  costFactor: number;
  /** Tags the substitute does NOT carry (so we can clear allergens). */
  clears: string[];
}

export const TAG_SUBSTITUTIONS: Record<string, SubRule> = {
  dairy: { to: "Plant-based alternative", costFactor: 1.1, clears: ["dairy"] },
  gluten: { to: "Gluten-free alternative", costFactor: 1.3, clears: ["gluten"] },
  nuts: { to: "Seeds (sunflower)", costFactor: 0.8, clears: ["nuts"] },
  egg: { to: "Tofu scramble", costFactor: 0.9, clears: ["egg"] },
  meat: { to: "Soya chunks", costFactor: 0.4, clears: ["meat"] },
  fish: { to: "Jackfruit", costFactor: 0.5, clears: ["fish"] },
};

/** Generic cheaper swaps used only when over budget. */
export const BUDGET_SUBSTITUTIONS: Record<string, SubRule> = {
  Avocado: { to: "Cucumber", costFactor: 0.2, clears: [] },
  Paneer: { to: "Tofu", costFactor: 0.7, clears: ["dairy"] },
  "Chicken breast": { to: "Soya chunks", costFactor: 0.4, clears: ["meat"] },
  "Fish fillet": { to: "Chickpeas", costFactor: 0.4, clears: ["fish"] },
  Cream: { to: "Cashew paste", costFactor: 0.8, clears: ["dairy", "nuts"] },
};
