# 🍳 Cooking To-Do Planner

A small AI micro-app that turns a few facts about your day into a personal
cooking to-do list: a **breakfast / lunch / dinner plan**, a consolidated
**grocery list**, smart **substitutions** (diet, allergens, budget) and a
**budget feasibility** check.

Built with Next.js 16 (App Router), TypeScript, Tailwind v4 and shadcn/ui
(neutral black-and-white theme).

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Node built-in test runner)
npm run build    # production build + type-check
npm run lint
```

## How it works

The planner is a **pure, deterministic** core in `lib/` — no external API keys,
no network calls — so it's fast, secure and fully testable.

| File | Responsibility |
| --- | --- |
| `lib/types.ts` | Domain types |
| `lib/recipes.ts` | Recipe bank + substitution rules |
| `lib/planner.ts` | Input validation + plan generation |
| `lib/planner.test.ts` | Unit tests |
| `app/api/plan/route.ts` | POST endpoint (validates, returns JSON) |
| `app/page.tsx` | Accessible UI built from shadcn components |

### Planning logic

1. Pick the cheapest recipe per meal slot that fits the diet and prep-time limit.
2. Apply **substitutions** for excluded allergens and stricter diets
   (e.g. vegan swaps ghee → plant-based).
3. Aggregate ingredients into a single grocery list, scaled by number of people.
4. **Budget feasibility**: if the total exceeds the budget, swap the priciest
   items for cheaper alternatives, then report whether the plan fits.

## Design notes (scoring rubric)

- **Code quality** — small pure modules, typed end-to-end, no duplication.
- **Problem alignment** — covers all four required outputs (plan, grocery,
  substitutions, budget logic).
- **Security** — all request input is validated and clamped in
  `parsePlanRequest`; internal errors never leak to the client.
- **Efficiency** — O(recipes) selection, Map-based grocery aggregation, static
  page + dynamic API route only.
- **Testing** — 8 unit tests covering validation, scaling, substitutions and
  budget edge cases.
- **Accessibility** — semantic headings, labelled fields, `FieldSet`/legend for
  checkboxes, `aria-live` results region and keyboard-friendly shadcn controls.
