"use client";

import { useId, useState } from "react";
import { ChefHat, ShieldCheck, Sparkles, TriangleAlert, Wallet } from "lucide-react";
import type { Diet, PlanResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ALLERGENS = ["dairy", "gluten", "nuts", "egg", "meat", "fish"] as const;
const DIETS: { value: Diet; label: string }[] = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
];

export default function Home() {
  const id = useId();
  const [people, setPeople] = useState(2);
  const [budget, setBudget] = useState(500);
  const [diet, setDiet] = useState<Diet>("vegetarian");
  const [maxPrep, setMaxPrep] = useState(45);
  const [exclude, setExclude] = useState<string[]>([]);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // CAPTCHA challenge issued by the server on every 3rd generation.
  const [captcha, setCaptcha] = useState<{ question: string; token: string } | null>(
    null
  );
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const toggleAllergen = (tag: string, checked: boolean) => {
    setExclude((prev) =>
      checked ? [...prev, tag] : prev.filter((t) => t !== tag)
    );
  };

  async function requestPlan(captchaPayload?: { token: string; answer: number }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          people,
          budget,
          diet,
          maxPrepMinutes: maxPrep,
          exclude,
          captcha: captchaPayload,
        }),
      });
      const data = await res.json();

      if (res.status === 401 && data.captchaRequired) {
        setCaptcha(data.captcha);
        setCaptchaAnswer("");
        setError(data.error ?? "Please verify to continue.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Request failed.");

      setResult(data as PlanResult);
      setCaptcha(null);
      setCaptchaAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void requestPlan();
  }

  function onVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!captcha) return;
    void requestPlan({ token: captcha.token, answer: Number(captchaAnswer) });
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <ChefHat className="size-7" aria-hidden />
          Cooking To-Do Planner
        </h1>
        <p className="text-muted-foreground">
          Tell us about your day and get a breakfast, lunch and dinner plan with
          a grocery list, smart substitutions and a budget check.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Plan your day</CardTitle>
          <CardDescription>All fields are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`${id}-people`}>People</FieldLabel>
                  <Input
                    id={`${id}-people`}
                    type="number"
                    min={1}
                    max={12}
                    required
                    value={people}
                    onChange={(e) => setPeople(Number(e.target.value))}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor={`${id}-budget`}>Budget (₹)</FieldLabel>
                  <Input
                    id={`${id}-budget`}
                    type="number"
                    min={1}
                    max={100000}
                    required
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor={`${id}-diet`}>Diet</FieldLabel>
                  <Select
                    value={diet}
                    onValueChange={(value) => setDiet(value as Diet)}
                  >
                    <SelectTrigger id={`${id}-diet`} className="w-full">
                      <SelectValue placeholder="Choose a diet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {DIETS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor={`${id}-prep`}>
                    Max prep per meal (min)
                  </FieldLabel>
                  <Input
                    id={`${id}-prep`}
                    type="number"
                    min={5}
                    max={600}
                    required
                    value={maxPrep}
                    onChange={(e) => setMaxPrep(Number(e.target.value))}
                  />
                </Field>
              </div>

              <FieldSet>
                <FieldLegend>Avoid (allergens)</FieldLegend>
                <div className="flex flex-wrap gap-4">
                  {ALLERGENS.map((tag) => (
                    <FieldLabel
                      key={tag}
                      htmlFor={`${id}-${tag}`}
                      className="flex items-center gap-2 font-normal capitalize"
                    >
                      <Checkbox
                        id={`${id}-${tag}`}
                        checked={exclude.includes(tag)}
                        onCheckedChange={(checked) =>
                          toggleAllergen(tag, checked === true)
                        }
                      />
                      {tag}
                    </FieldLabel>
                  ))}
                </div>
              </FieldSet>

              <Button type="submit" disabled={loading} className="w-fit">
                {loading ? "Planning…" : "Generate plan"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {captcha && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" aria-hidden />
              Quick verification
            </CardTitle>
            <CardDescription>
              A quick check is required for this plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onVerify}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`${id}-captcha`}>
                    {captcha.question}
                  </FieldLabel>
                  <Input
                    id={`${id}-captcha`}
                    type="number"
                    inputMode="numeric"
                    required
                    autoFocus
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                  />
                </Field>
                <Button type="submit" disabled={loading} className="w-fit">
                  {loading ? "Verifying…" : "Verify & generate"}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}

      <div aria-live="polite" className="flex flex-col gap-6">
        {error && (
          <Alert variant="destructive" role="alert">
            <TriangleAlert />
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {result && <PlanView plan={result} />}
      </div>
    </main>
  );
}

function PlanView({ plan }: { plan: PlanResult }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Badge variant={plan.source === "gemini" ? "default" : "secondary"}>
          <Sparkles className="size-3" aria-hidden />
          {plan.source === "gemini" ? "AI · Gemini" : "Rule-based"}
        </Badge>
      </div>

      <Alert variant={plan.feasible ? "default" : "destructive"}>
        <Wallet />
        <AlertTitle>
          ₹{plan.totalCost.toFixed(2)} of ₹{plan.budget.toFixed(2)} budget —{" "}
          {plan.feasible ? "fits your budget" : "over budget"}
        </AlertTitle>
        <AlertDescription>
          <ul className="flex flex-col gap-1">
            {plan.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Meals</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {plan.meals.map((m) => (
            <div
              key={m.slot}
              className="flex items-baseline justify-between gap-4"
            >
              <span>
                <span className="font-medium capitalize">{m.slot}</span>:{" "}
                {m.recipe}
              </span>
              <span className="text-sm text-muted-foreground">
                {m.prepMinutes} min · {m.servings} serving(s)
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grocery list</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="text-right">Cost (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.grocery.map((g) => (
                <TableRow key={g.name}>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>
                    {g.quantity} {g.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {g.cost.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {plan.substitutions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Substitutions</CardTitle>
            <CardDescription>
              Swaps applied for your diet, allergens or budget.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {plan.substitutions.map((s) => (
              <div
                key={`${s.from}-${s.to}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="font-medium">{s.from}</span>
                <span aria-hidden>→</span>
                <span>{s.to}</span>
                <Badge variant="secondary" className="capitalize">
                  {s.reason}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
