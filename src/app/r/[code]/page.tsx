import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameFrame } from "@/components/GameFrame";
import { isRoomCode } from "@/lib/room-code";
import { FuseRoom } from "@/components/party/FuseRoom";

export async function generateMetadata({ params }: PageProps<"/r/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Fuse room ${code.toUpperCase()}`, description: "Join the Fuse room on Portal." };
}

async function Room({ params }: { params: PageProps<"/r/[code]">["params"] }) {
  const code = (await params).code.toUpperCase();
  if (!isRoomCode(code)) notFound();
  return <FuseRoom code={code} />;
}

export default function RoomPage(props: PageProps<"/r/[code]">) {
  return (
    <Suspense fallback={<GameFrame><div className="h-40" /></GameFrame>}>
      <Room params={props.params} />
    </Suspense>
  );
}
