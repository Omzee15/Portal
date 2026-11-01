import { Suspense } from "react";
import { connection } from "next/server";
import { istDateString } from "@/lib/puzzle-day";
import { BottomNav } from "@/components/BottomNav";
import { Journal } from "@/components/journal/Journal";

async function Content() {
  await connection();
  return <Journal today={istDateString()} />;
}

export default function JournalPage() {
  return (
    <main className="flex min-h-dvh md:min-h-[640px] flex-col md:mx-auto md:w-full md:max-w-2xl md:pt-4">
      <Suspense fallback={<div className="h-40" />}>
        <Content />
      </Suspense>
      <div className="px-4">
        <BottomNav active="journal" />
      </div>
    </main>
  );
}
