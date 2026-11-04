import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-pixel text-4xl">404</p>
      <h1 className="font-serif text-3xl font-bold">Nothing here</h1>
      <p className="text-ink-soft">That page doesn&apos;t exist, or the room code was wrong.</p>
      <Link href="/" className="grid h-12 place-items-center rounded-full border-[1.5px] border-ink bg-ink px-6 font-bold text-paper">
        Back to Today
      </Link>
    </main>
  );
}
