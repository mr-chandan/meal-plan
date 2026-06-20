import { NextResponse } from "next/server";
import { buildPlan, parsePlanRequest, ValidationError } from "@/lib/planner";

// User-specific output: never cache.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  try {
    const plan = buildPlan(parsePlanRequest(body));
    return NextResponse.json(plan);
  } catch (err) {
    if (err instanceof ValidationError) {
      // Safe to echo: messages are crafted to avoid leaking internals.
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    // Unexpected: log server-side, return a generic message to the client.
    console.error("Failed to build plan:", err);
    return NextResponse.json(
      { error: "Something went wrong generating your plan." },
      { status: 500 }
    );
  }
}
