import type { ReactNode } from "react";

/** Full-bleed on phones; a centred printed card on desktop. */
export function GameFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[430px] bg-paper md:my-8 md:max-w-xl md:overflow-hidden md:rounded-2xl md:border-[1.5px] md:border-ink md:shadow-[4px_4px_0_var(--ink)]">
      {children}
    </div>
  );
}
