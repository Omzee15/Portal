import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Dev stand-in for the daily_attempts table: a signed cookie that records how
 * many guesses this browser has used on today's puzzle, so the server (not the
 * client) decides when the answer may be revealed.
 */
export const ATTEMPT_COOKIE = "lb_attempt";

export type AttemptState = {
  puzzle: number;
  count: number;
  lastActionId: string;
};

function secret(): string {
  const s = process.env.LETTERBOX_COOKIE_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("LETTERBOX_COOKIE_SECRET is required in production");
  }
  return "dev-only-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeAttempt(s: AttemptState): string {
  const payload = `${s.puzzle}.${s.count}.${s.lastActionId}`;
  return `${payload}.${sign(payload)}`;
}

export function decodeAttempt(raw: string | undefined): AttemptState | null {
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i < 0) return null;
  const payload = raw.slice(0, i);
  const sig = Buffer.from(raw.slice(i + 1));
  const expected = Buffer.from(sign(payload));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  const [puzzle, count, ...rest] = payload.split(".");
  const p = Number(puzzle);
  const c = Number(count);
  if (!Number.isInteger(p) || !Number.isInteger(c)) return null;
  return { puzzle: p, count: c, lastActionId: rest.join(".") };
}
