import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameFrame } from "@/components/GameFrame";
import { isRoomCode } from "@/lib/room-code";
import { DoodleRoom } from "@/components/party/DoodleRoom";

export async function generateMetadata({ params }: PageProps<"/s/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Doodle Relay room ${code.toUpperCase()}`, description: "Join the Doodle Relay room on Portal." };
}

async function Room({ params }: { params: PageProps<"/s/[code]">["params"] }) {
  const code = (await params).code.toUpperCase();
  if (!isRoomCode(code)) notFound();
  return <DoodleRoom code={code} />;
}

export default function RoomPage(props: PageProps<"/s/[code]">) {
  return (
    <Suspense fallback={<GameFrame><div className="h-40" /></GameFrame>}>
      <Room params={props.params} />
    </Suspense>
  );
}
