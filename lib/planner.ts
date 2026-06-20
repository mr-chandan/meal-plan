// Pure, deterministic meal-planning core. No I/O, no framework — easy to test.

import type {
  Diet,
  GroceryItem,
  Ingredient,
  MealEntry,
  MealSlot,
  PlanRequest,
  PlanResult,
  Recipe,
  Substitution,
} from "./types.ts";
import {
  BUDGET_SUBSTITUTIONS,
  RECIPES,
  TAG_SUBSTITUTIONS,
} from "./recipes.ts";

const DIET_RANK: Record<Diet, number> = {
  omnivore: 0,
  vegetarian: 1,
  vegan: 2,
};

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const VALID_DIETS: Diet[] = ["omnivore", "vegetarian", "vegan"];
const KNOWN_ALLERGENS = ["dairy", "gluten", "nuts", "egg", "meat", "fish"];

export class ValidationError extends Error {}

/**
 * Validate and normalize untrusted input (e.g. a request body) into a
 * `PlanRequest`. Throws `ValidationError` with a user-safe message on bad data.
 */
export function parsePlanRequest(input: unknown): PlanRequest {
  if (typeof input !== "object" || input === null) {
    throw new ValidationError("Request body must be a JSON object.");
  }
  const raw = input as Record<string, unknown>;

  const people = toInt(raw.people, "people");
  if (people < 1 || people > 12) {
    throw new ValidationError("people must be between 1 and 12.");
  }

  const budget = toNumber(raw.budget, "budget");
  if (budget <= 0 || budget > 100000) {
    throw new ValidationError("budget must be between 1 and 100000.");
  }

  const diet = raw.diet;
  if (typeof diet !== "string" || !VALID_DIETS.includes(diet as Diet)) {
    throw new ValidationError(
      `diet must be one of: ${VALID_DIETS.join(", ")}.`
    );
  }

  const maxPrepMinutes =
    raw.maxPrepMinutes === undefined
      ? 120
      : toInt(raw.maxPrepMinutes, "maxPrepMinutes");
  if (maxPrepMinutes < 5 || maxPrepMinutes > 600) {
    throw new ValidationError("maxPrepMinutes must be between 5 and 600.");
  }

  let exclude: string[] = [];
  if (raw.exclude !== undefined) {
    if (!Array.isArray(raw.exclude)) {
      throw new ValidationError("exclude must be an array of allergen tags.");
    }
    exclude = raw.exclude
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.toLowerCase().trim())
      .filter((t) => KNOWN_ALLERGENS.includes(t));
  }

  return { people, budget, diet: diet as Diet, exclude, maxPrepMinutes };
}

function toNumber(value: unknown, field: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new ValidationError(`${field} must be a finite number.`);
  }
  return n;
}

function toInt(value: unknown, field: string): number {
  const n = toNumber(value, field);
  if (!Number.isInteger(n)) {
    throw new ValidationError(`${field} must be a whole number.`);
  }
  return n;
}

/** Round to 2 decimals to avoid floating-point noise in money. */
const money = (n: number): number => Math.round(n * 100) / 100;

function dietAllows(req: Diet, recipe: Diet): boolean {
  return DIET_RANK[recipe] >= DIET_RANK[req];
}

/**
 * Resolve one ingredient against the request, applying allergen/diet
 * substitutions. Returns the (possibly swapped) ingredient and any
 * substitution that was made.
 */
function resolveIngredient(
  ingredient: Ingredient,
  req: PlanRequest
): { ingredient: Ingredient; sub?: Substitution } {
  // Vegan requests must drop animal-derived tags even if the recipe qualified.
  const mustClear = new Set(req.exclude);
  if (req.diet === "vegan") {
    ["dairy", "egg", "meat", "fish"].forEach((t) => mustClear.add(t));
  } else if (req.diet === "vegetarian") {
    ["meat", "fish"].forEach((t) => mustClear.add(t));
  }

  const offending = ingredient.tags.find((t) => mustClear.has(t));
  if (!offending) return { ingredient };

  const rule = TAG_SUBSTITUTIONS[offending];
  if (!rule) return { ingredient };

  const swapped: Ingredient = {
    ...ingredient,
    name: `${rule.to} (for ${ingredient.name})`,
    unitCost: money(ingredient.unitCost * rule.costFactor),
    tags: ingredient.tags.filter((t) => !rule.clears.includes(t)),
  };
  const reason: Substitution["reason"] = req.exclude.includes(offending)
    ? "allergen"
    : "diet";
  return {
    ingredient: swapped,
    sub: { from: ingredient.name, to: rule.to, reason },
  };
}

/** Pick the cheapest qualifying recipe per slot, after substitutions. */
function chooseRecipe(slot: MealSlot, req: PlanRequest): Recipe | undefined {
  let best: Recipe | undefined;
  let bestCost = Infinity;
  for (const recipe of RECIPES) {
    if (recipe.slot !== slot) continue;
    if (!dietAllows(req.diet, recipe.diet)) continue;
    if (recipe.prepMinutes > req.maxPrepMinutes) continue;
    const cost = recipe.ingredients.reduce(
      (sum, i) => sum + i.quantity * i.unitCost,
      0
    );
    if (cost < bestCost) {
      best = recipe;
      bestCost = cost;
    }
  }
  return best;
}

/**
 * Generate a full-day cooking plan: meals, grocery list, substitutions and
 * budget feasibility. Deterministic given the same input.
 */
export function buildPlan(req: PlanRequest): PlanResult {
  const meals: MealEntry[] = [];
  const subs: Substitution[] = [];
  const notes: string[] = [];
  // Aggregate identical grocery lines across meals.
  const grocery = new Map<string, GroceryItem>();

  const addGrocery = (i: Ingredient) => {
    const key = `${i.name}|${i.unit}`;
    const qty = i.quantity * req.people;
    const cost = money(qty * i.unitCost);
    const existing = grocery.get(key);
    if (existing) {
      existing.quantity = money(existing.quantity + qty);
      existing.cost = money(existing.cost + cost);
    } else {
      grocery.set(key, { name: i.name, quantity: qty, unit: i.unit, cost });
    }
  };

  for (const slot of SLOTS) {
    const recipe = chooseRecipe(slot, req);
    if (!recipe) {
      notes.push(
        `No ${slot} recipe matched your diet/time limit — slot skipped.`
      );
      continue;
    }
    meals.push({
      slot,
      recipe: recipe.name,
      prepMinutes: recipe.prepMinutes,
      servings: req.people,
    });
    for (const ingredient of recipe.ingredients) {
      const { ingredient: resolved, sub } = resolveIngredient(ingredient, req);
      if (sub && !subs.some((s) => s.from === sub.from && s.to === sub.to)) {
        subs.push(sub);
      }
      addGrocery(resolved);
    }
  }

  let items = [...grocery.values()];
  let totalCost = money(items.reduce((s, i) => s + i.cost, 0));

  // Budget feasibility: if over, apply cheaper swaps to the priciest items.
  if (totalCost > req.budget) {
    const byCost = [...items].sort((a, b) => b.cost - a.cost);
    for (const item of byCost) {
      if (totalCost <= req.budget) break;
      const rule = BUDGET_SUBSTITUTIONS[item.name];
      if (!rule) continue;
      const originalName = item.name;
      const saved = money(item.cost * (1 - rule.costFactor));
      item.name = `${rule.to} (budget swap)`;
      item.cost = money(item.cost - saved);
      totalCost = money(totalCost - saved);
      subs.push({ from: originalName, to: rule.to, reason: "budget" });
    }
    items = byCost;
  }

  const feasible = totalCost <= req.budget;
  notes.push(
    feasible
      ? `Plan fits your budget with ₹${money(req.budget - totalCost)} to spare.`
      : `Plan is over budget by ₹${money(totalCost - req.budget)}. Consider raising the budget or cutting a meal.`
  );

  return {
    meals,
    grocery: items.sort((a, b) => a.name.localeCompare(b.name)),
    substitutions: subs,
    totalCost,
    budget: req.budget,
    feasible,
    notes,
  };
}
