import type { ReactNode } from "react";

/**
 * Exactly one screen tall: the header keeps its size and the last child (the game) gets the rest,
 * scrolling only if it must. Full-bleed on phones, a centred printed card on laptops; the sizing
 * lives in globals.css (.game-frame) because it depends on the screen's height as well as its width.
 * `wide` is for games that put things side by side.
 */
export function GameFrame({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="game-frame" data-wide={wide || undefined}>
      {children}
    </div>
  );
}
