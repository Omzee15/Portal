import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto hidden max-w-5xl px-6 py-6 text-xs text-ink-soft md:block">
      <nav aria-label="Legal" className="flex gap-4">
        <Link href="/privacy" className="underline">Privacy</Link>
        <Link href="/terms" className="underline">Terms</Link>
      </nav>
    </footer>
  );
}
