import Link from "next/link";

const LINKS = [
  { href: "/", label: "Today", live: true },
  { href: "/party", label: "Party", live: true },
  { href: "/journal", label: "Journal", live: true },
  { href: "#", label: "Circles", live: false },
] as const;

/** Desktop-only top bar; phones use the bottom nav instead. */
export function SiteHeader() {
  return (
    <header className="hidden border-b-[1.5px] border-ink bg-paper md:block">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="font-serif text-2xl font-bold">
          Portal
        </Link>
        <nav aria-label="Main" className="flex gap-1">
          {LINKS.map((l) =>
            l.live ? (
              <Link key={l.label} href={l.href} className="rounded-full px-4 py-2 text-sm font-bold hover:bg-mustard focus-visible:outline-2">
                {l.label}
              </Link>
            ) : (
              <span key={l.label} className="rounded-full px-4 py-2 text-sm font-bold opacity-40" aria-disabled="true">
                {l.label} <span className="font-pixel text-[9px]">SOON</span>
              </span>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
