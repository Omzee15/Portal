const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's IST date on the client, for components that can't take it as a server prop. */
export function istDateOnClient(now: number = Date.now()): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}
