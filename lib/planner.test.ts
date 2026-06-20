// Run with: npm test  (uses Node's built-in test runner via tsx/node --test)
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlan, parsePlanRequest, ValidationError } from "./planner.ts";

test("parsePlanRequest accepts and normalizes valid input", () => {
  const req = parsePlanRequest({
    people: 2,
    budget: 500,
    diet: "vegetarian",
    exclude: ["NUTS", "unknown-tag"],
  });
  assert.equal(req.people, 2);
  assert.equal(req.diet, "vegetarian");
  // Unknown tags dropped, known ones lower-cased.
  assert.deepEqual(req.exclude, ["nuts"]);
  assert.equal(req.maxPrepMinutes, 120);
});

test("parsePlanRequest rejects bad input", () => {
  assert.throws(() => parsePlanRequest(null), ValidationError);
  assert.throws(() => parsePlanRequest({ people: 0, budget: 1, diet: "vegan" }), ValidationError);
  assert.throws(() => parsePlanRequest({ people: 2, budget: -1, diet: "vegan" }), ValidationError);
  assert.throws(() => parsePlanRequest({ people: 2, budget: 100, diet: "carnivore" }), ValidationError);
});

test("buildPlan produces breakfast, lunch and dinner", () => {
  const plan = buildPlan(
    parsePlanRequest({ people: 1, budget: 1000, diet: "omnivore" })
  );
  const slots = plan.meals.map((m) => m.slot);
  assert.deepEqual(slots, ["breakfast", "lunch", "dinner"]);
  assert.ok(plan.grocery.length > 0);
});

test("grocery cost scales with number of people", () => {
  const one = buildPlan(parsePlanRequest({ people: 1, budget: 100000, diet: "vegan" }));
  const four = buildPlan(parsePlanRequest({ people: 4, budget: 100000, diet: "vegan" }));
  assert.ok(Math.abs(four.totalCost - one.totalCost * 4) < 0.05);
});

test("vegan diet substitutes animal ingredients", () => {
  const plan = buildPlan(
    parsePlanRequest({ people: 1, budget: 100000, diet: "vegan" })
  );
  // No grocery line should carry a dairy/meat/fish ingredient name unswapped.
  const hasGhee = plan.grocery.some((g) => g.name === "Ghee");
  assert.equal(hasGhee, false);
});

test("allergen exclusion creates a substitution", () => {
  const plan = buildPlan(
    parsePlanRequest({ people: 1, budget: 100000, diet: "omnivore", exclude: ["nuts"] })
  );
  assert.ok(plan.substitutions.some((s) => s.reason === "allergen"));
});

test("tight budget flips feasibility and attempts budget swaps", () => {
  const plan = buildPlan(
    parsePlanRequest({ people: 6, budget: 1, diet: "omnivore" })
  );
  assert.equal(plan.feasible, false);
  assert.ok(plan.notes.some((n) => n.includes("over budget")));
});

test("totalCost equals sum of grocery costs", () => {
  const plan = buildPlan(
    parsePlanRequest({ people: 3, budget: 100000, diet: "vegetarian" })
  );
  const sum = Math.round(plan.grocery.reduce((s, g) => s + g.cost, 0) * 100) / 100;
  assert.equal(plan.totalCost, sum);
});
