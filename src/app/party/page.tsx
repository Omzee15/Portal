import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { PartyHub } from "@/components/party/PartyHub";

export const metadata: Metadata = { title: "Party" };

export default function PartyPage() {
  return (
    <main className="flex min-h-dvh flex-col md:mx-auto md:min-h-[640px] md:max-w-4xl">
      <PartyHub />
      <div className="px-4 md:hidden">
        <BottomNav active="party" />
      </div>
    </main>
  );
}
