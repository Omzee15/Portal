/**
 * Browsers hide some features on plain http (anything but localhost or HTTPS), such as a laptop opening the
 * app by its wifi address. These stand-ins work everywhere, so the games don't depend on HTTPS.
 */

/** A random hex id. crypto.randomUUID is HTTPS-only; getRandomValues is not. */
export function randomId(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Copies text, falling back to the old selection route where navigator.clipboard is missing. */
export async function copyText(text: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const box = document.createElement("textarea");
  box.value = text;
  box.style.position = "fixed";
  document.body.append(box);
  box.select();
  document.execCommand("copy");
  box.remove();
}

/** Where the party server is: the configured host, or port 1999 on whichever machine served this page. */
export const partyHost = () => process.env.NEXT_PUBLIC_PARTYKIT_HOST || `${location.hostname}:1999`;
