import { NextResponse } from "next/server";
import { buildPlan, parsePlanRequest, ValidationError } from "@/lib/planner";
import { generatePlanWithGemini } from "@/lib/gemini";
import { createChallenge, verifyChallenge } from "@/lib/captcha";
import {
  getPlanCount,
  incrementPlanCount,
  isCaptchaDue,
  rateLimit,
} from "@/lib/rateLimit";
import type { PlanRequest, PlanResult } from "@/lib/types";

// Per-user output; never cache. Runs on the Node runtime (needs node:crypto).
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_096;

function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

const money = (n: number) => Math.round(n * 100) / 100;

/** Recompute all money server-side so feasibility never trusts the model. */
function finalizeAiPlan(
  ai: Awaited<ReturnType<typeof generatePlanWithGemini>>,
  req: PlanRequest
): PlanResult {
  const totalCost = money(ai.grocery.reduce((s, g) => s + g.cost, 0));
  const feasible = totalCost <= req.budget;
  const notes = [...ai.notes];
  notes.push(
    feasible
      ? `Plan fits your budget with ₹${money(req.budget - totalCost)} to spare.`
      : `Plan is over budget by ₹${money(totalCost - req.budget)}.`
  );
  return {
    meals: ai.meals,
    grocery: ai.grocery,
    substitutions: ai.substitutions,
    totalCost,
    budget: req.budget,
    feasible,
    notes,
    source: "gemini",
  };
}

export async function POST(request: Request) {
  const key = clientKey(request);

  // 1. Rate limit.
  const rl = rateLimit(key);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // 2. Bounded body read, then parse.
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  // 3. Validate inputs.
  let req: PlanRequest;
  try {
    req = parsePlanRequest(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // 4. CAPTCHA gate on every 3rd generation.
  if (isCaptchaDue(getPlanCount(key))) {
    const captcha = body.captcha as
      | { token?: unknown; answer?: unknown }
      | undefined;
    if (!verifyChallenge(captcha?.token, captcha?.answer)) {
      return NextResponse.json(
        {
          captchaRequired: true,
          captcha: createChallenge(),
          error: "Please solve the verification to continue.",
        },
        { status: 401 }
      );
    }
  }

  // 5. Generate — Gemini first, deterministic planner as guaranteed fallback.
  let plan: PlanResult;
  try {
    plan = finalizeAiPlan(await generatePlanWithGemini(req), req);
  } catch (err) {
    console.error("Gemini failed, using rules engine:", err);
    plan = buildPlan(req);
  }

  incrementPlanCount(key);
  return NextResponse.json(plan);
}
