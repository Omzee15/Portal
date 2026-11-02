import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameFrame } from "@/components/GameFrame";
import { isRoomCode } from "@/lib/room-code";
import { DuelRoom } from "@/components/party/DuelRoom";

export async function generateMetadata({ params }: PageProps<"/d/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Letterbox Duel room ${code.toUpperCase()}`, description: "Join the Letterbox Duel room on Portal." };
}

async function Room({ params }: { params: PageProps<"/d/[code]">["params"] }) {
  const code = (await params).code.toUpperCase();
  if (!isRoomCode(code)) notFound();
  return <DuelRoom code={code} />;
}

export default function RoomPage(props: PageProps<"/d/[code]">) {
  return (
    <Suspense fallback={<GameFrame><div className="h-40" /></GameFrame>}>
      <Room params={props.params} />
    </Suspense>
  );
}
