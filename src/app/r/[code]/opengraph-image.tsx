import { ImageResponse } from "next/og";

export const alt = "Join a Fuse room on Portal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#dccfd2", color: "#2f2b28", padding: 72, border: "10px solid #2f2b28" }}>
        <div style={{ display: "flex", fontSize: 32, letterSpacing: 6, textTransform: "uppercase" }}>Portal · live party game</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 56 }}>You&apos;re invited to play</div>
          <div style={{ fontSize: 170, fontWeight: 800, lineHeight: 1.1 }}>Fuse</div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 16 }}>
            <div style={{ fontSize: 36 }}>Room code</div>
            <div style={{ fontSize: 90, letterSpacing: 18, background: "#f2eadb", border: "6px dashed #2f2b28", borderRadius: 24, padding: "4px 36px", display: "flex" }}>{code}</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 30 }}>Type a word with the letters before the fuse burns out.</div>
      </div>
    ),
    size,
  );
}
