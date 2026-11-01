"use client";

/** Anonymous player identity until accounts exist: a stable id and a display name kept on this device. */
const PID_KEY = "pastime:pid";
const NAME_KEY = "pastime:name";

function get(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function set(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

export function playerId(): string {
  let id = get(PID_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    set(PID_KEY, id);
  }
  return id;
}

export const savedName = () => get(NAME_KEY) ?? "";
export const saveName = (n: string) => set(NAME_KEY, n.trim().slice(0, 16));
