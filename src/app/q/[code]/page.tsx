import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameFrame } from "@/components/GameFrame";
import { isRoomCode } from "@/lib/room-code";
import { QuicklistRoom } from "@/components/party/QuicklistRoom";

export async function generateMetadata({ params }: PageProps<"/q/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Quicklist room ${code.toUpperCase()}`, description: "Join the Quicklist room on Portal." };
}

async function Room({ params }: { params: PageProps<"/q/[code]">["params"] }) {
  const code = (await params).code.toUpperCase();
  if (!isRoomCode(code)) notFound();
  return <QuicklistRoom code={code} />;
}

export default function RoomPage(props: PageProps<"/q/[code]">) {
  return (
    <Suspense fallback={<GameFrame><div className="h-40" /></GameFrame>}>
      <Room params={props.params} />
    </Suspense>
  );
}
