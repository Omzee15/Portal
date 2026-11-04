"use client";

import Link from "next/link";

/** Shown when a page breaks. The site header stays, so one broken game never takes the whole app down. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-3xl font-bold">Something went wrong</h1>
      <p className="text-ink-soft">That page hit a snag. Your progress is saved on this device, so nothing is lost.</p>
      <div className="flex gap-2">
        <button onClick={reset} className="h-12 rounded-full border-[1.5px] border-ink bg-ink px-6 font-bold text-paper active:scale-[0.97]">
          Try again
        </button>
        <Link href="/" className="grid h-12 place-items-center rounded-full border-[1.5px] border-ink px-6 font-bold">
          Back to Today
        </Link>
      </div>
    </main>
  );
}
