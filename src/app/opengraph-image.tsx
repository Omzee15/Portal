import { ImageResponse } from "next/og";

export const alt = "Portal: your portal for all games";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f2eadb", color: "#2f2b28", padding: 72, border: "10px solid #2f2b28" }}>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, textTransform: "uppercase" }}>Daily puzzles · Party games · Journal</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1 }}>Portal</div>
          <div style={{ fontSize: 40, marginTop: 20, maxWidth: 900 }}>Your portal for all games: daily puzzles, live party games and a journal that writes itself.</div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {["#d9a07e", "#e3c077", "#a9b98c", "#b8a3b0", "#93afb8"].map((c) => (
            <div key={c} style={{ width: 90, height: 90, background: c, border: "5px solid #2f2b28", borderRadius: 20, display: "flex" }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
