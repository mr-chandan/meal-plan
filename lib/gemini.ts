// Gemini-backed plan generation. Returns the creative parts of a plan
// (meals, grocery, substitutions, notes); the route recomputes all money
// server-side so feasibility never depends on the model's arithmetic.

import type {
  GroceryItem,
  MealEntry,
  PlanRequest,
  Substitution,
} from "./types.ts";

export interface GeminiPlan {
  meals: MealEntry[];
  grocery: GroceryItem[];
  substitutions: Substitution[];
  notes: string[];
}

const TIMEOUT_MS = 25_000;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    meals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: { type: "string", enum: ["breakfast", "lunch", "dinner"] },
          recipe: { type: "string" },
          prepMinutes: { type: "integer" },
          servings: { type: "integer" },
        },
        required: ["slot", "recipe", "prepMinutes", "servings"],
      },
    },
    grocery: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          cost: { type: "number" },
        },
        required: ["name", "quantity", "unit", "cost"],
      },
    },
    substitutions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          reason: { type: "string", enum: ["allergen", "diet", "budget"] },
        },
        required: ["from", "to", "reason"],
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["meals", "grocery", "substitutions", "notes"],
} as const;

function buildPrompt(req: PlanRequest): string {
  const allergens = req.exclude.length ? req.exclude.join(", ") : "none";
  return [
    "You are a practical home-cooking assistant. Plan one day of meals.",
    `People: ${req.people}`,
    `Total budget for the day: ₹${req.budget} (Indian Rupees)`,
    `Diet: ${req.diet}`,
    `Allergens to avoid: ${allergens}`,
    `Max prep time per meal: ${req.maxPrepMinutes} minutes`,
    "",
    "Produce a breakfast, a lunch and a dinner. Give a consolidated grocery",
    "list with realistic per-line costs in INR (quantities scaled for all",
    "people). List any substitutions you made for diet, allergens or budget.",
    "Keep the grocery total at or under the budget when feasible. Costs must be",
    "numbers only. Respond as JSON matching the provided schema.",
  ].join("\n");
}

/** Trim model output to known fields and coerce types; throws if unusable. */
function normalize(raw: unknown): GeminiPlan {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Gemini returned a non-object plan.");
  }
  const obj = raw as Record<string, unknown>;
  const meals = Array.isArray(obj.meals) ? obj.meals : [];
  const grocery = Array.isArray(obj.grocery) ? obj.grocery : [];
  if (meals.length === 0 || grocery.length === 0) {
    throw new Error("Gemini plan missing meals or grocery list.");
  }

  return {
    meals: meals.map((m) => {
      const e = m as Record<string, unknown>;
      return {
        slot: e.slot as MealEntry["slot"],
        recipe: String(e.recipe ?? "Meal"),
        prepMinutes: Number(e.prepMinutes) || 0,
        servings: Number(e.servings) || 1,
      };
    }),
    grocery: grocery.map((g) => {
      const e = g as Record<string, unknown>;
      return {
        name: String(e.name ?? "Item"),
        quantity: Number(e.quantity) || 0,
        unit: String(e.unit ?? ""),
        cost: Math.max(0, Number(e.cost) || 0),
      };
    }),
    substitutions: (Array.isArray(obj.substitutions) ? obj.substitutions : []).map(
      (s) => {
        const e = s as Record<string, unknown>;
        return {
          from: String(e.from ?? ""),
          to: String(e.to ?? ""),
          reason: (e.reason as Substitution["reason"]) ?? "diet",
        };
      }
    ),
    notes: (Array.isArray(obj.notes) ? obj.notes : []).map(String),
  };
}

/**
 * Call Gemini and return a normalized plan. Throws on missing key, network
 * failure, timeout, HTTP error or unparseable output — the caller falls back
 * to the deterministic planner.
 */
export async function generatePlanWithGemini(
  req: PlanRequest
): Promise<GeminiPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(req) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.7,
            // Disable "thinking" — much lower latency for this structured task.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: controller.signal,
      }
    );

    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = await res.json();
    const text: unknown =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") throw new Error("Empty Gemini response.");
    return normalize(JSON.parse(text));
  } finally {
    clearTimeout(timer);
  }
}
