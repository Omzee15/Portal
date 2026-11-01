import Link from "next/link";

const TABS = [
  { id: "today", label: "Today", href: "/", live: true },
  { id: "party", label: "Party", href: "/party", live: true },
  { id: "journal", label: "Journal", href: "/journal", live: true },
  { id: "circles", label: "Circles", href: "#", live: false },
] as const;

export function BottomNav({ active }: { active: (typeof TABS)[number]["id"] }) {
  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 mt-auto -mx-4 grid md:hidden grid-cols-4 border-t-[1.5px] border-ink bg-paper px-2 py-2"
    >
      {TABS.map((t) => {
        const on = t.id === active;
        const cls = `mx-auto min-h-11 min-w-16 rounded-full px-3 py-2 text-center text-xs font-bold ${on ? "bg-mustard border-[1.5px] border-ink" : "text-ink-soft"}`;
        return t.live ? (
          <Link key={t.id} href={t.href} className={cls} aria-current={on ? "page" : undefined}>
            {t.label}
          </Link>
        ) : (
          <span key={t.id} className={`${cls} opacity-50`} aria-disabled="true">
            {t.label}
          </span>
        );
      })}
    </nav>
  );
}
