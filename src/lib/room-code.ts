// No I, O, 0 or 1: easy to read out loud across a room.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const isRoomCode = (s: string) => /^[A-Z]{4}$/.test(s);
