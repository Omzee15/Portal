/**
 * Cleans up NEXT_PUBLIC_PARTYKIT_HOST. PartySocket wants a bare "host[:port]", but a pasted value often carries
 * "https://", "wss://" or a trailing slash, and a value copied from a template can still be a placeholder.
 * Returns undefined when nothing usable is set. Shared by next.config.ts (the CSP) and the browser code.
 */
export function cleanPartyHost(raw: string | undefined): string | undefined {
  const host = (raw ?? "")
    .trim()
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/.test(host) || /your|example|placeholder|deployment_address/.test(host)) return undefined;
  return host;
}

/** True for hosts on this machine or the home network, which are reached over plain ws:// rather than wss://. */
export const isLocalHost = (host: string) => /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith(".local");
