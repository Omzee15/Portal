// Today's answers, from the test-only endpoint (the server must be started with PASTIME_E2E=1).
const BASE = process.env.BASE || "http://localhost:3100";
export async function answers() {
  const res = await fetch(BASE + "/api/e2e-answers");
  if (!res.ok) throw new Error("start the server with PASTIME_E2E=1 to run the e2e tests");
  return res.json();
}
