import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameFrame } from "@/components/GameFrame";
import { isRoomCode } from "@/lib/room-code";
import { HintlineRoom } from "@/components/party/HintlineRoom";

export async function generateMetadata({ params }: PageProps<"/h/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Hintline room ${code.toUpperCase()}`, description: "Join the Hintline room on Portal." };
}

async function Room({ params }: { params: PageProps<"/h/[code]">["params"] }) {
  const code = (await params).code.toUpperCase();
  if (!isRoomCode(code)) notFound();
  return <HintlineRoom code={code} />;
}

export default function RoomPage(props: PageProps<"/h/[code]">) {
  return (
    <Suspense fallback={<GameFrame><div className="h-40" /></GameFrame>}>
      <Room params={props.params} />
    </Suspense>
  );
}
