import { VALID_GUESSES } from "@/lib/letterbox/valid";

// Valid guesses for the client-side "not a word" check. Sorted so the answer schedule is not
// leaked; the pool is public anyway, as with any guess list. Server still re-validates every guess.
export function GET() {
  return Response.json(
    { words: [...VALID_GUESSES].sort() },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
