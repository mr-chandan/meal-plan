// Stateless math CAPTCHA. The challenge token is an HMAC over the correct
// answer + expiry, so the server never has to store pending challenges and the
// answer can't be derived from or forged in the token.

import crypto from "node:crypto";

const TTL_MS = 5 * 60_000;

// Reuse a server-only secret. Falls back to a dev value if unset.
const SECRET =
  process.env.CAPTCHA_SECRET ?? process.env.GEMINI_API_KEY ?? "dev-captcha-secret";

export interface Challenge {
  question: string;
  token: string;
}

function hmac(answer: number, expiresAt: number): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${answer}.${expiresAt}`)
    .digest("hex");
}

/** Create a fresh "a + b" challenge. The token does not reveal the answer. */
export function createChallenge(): Challenge {
  const a = crypto.randomInt(2, 10);
  const b = crypto.randomInt(2, 10);
  const expiresAt = Date.now() + TTL_MS;
  // token = expiry + signature over (answer, expiry)
  const token = `${expiresAt}.${hmac(a + b, expiresAt)}`;
  return { question: `What is ${a} + ${b}?`, token };
}

/** True only if `answer` is correct for `token` and the token is unexpired. */
export function verifyChallenge(token: unknown, answer: unknown): boolean {
  if (typeof token !== "string") return false;
  const value = typeof answer === "string" ? Number(answer) : answer;
  if (typeof value !== "number" || !Number.isInteger(value)) return false;

  const sep = token.indexOf(".");
  if (sep === -1) return false;
  const expiresAt = Number(token.slice(0, sep));
  const mac = token.slice(sep + 1);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt || !mac) {
    return false;
  }

  const expected = hmac(value, expiresAt);
  if (expected.length !== mac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac));
}
