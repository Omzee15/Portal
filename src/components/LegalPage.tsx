import type { ReactNode } from "react";

export const UPDATED = "1 November 2026";

/** Contact details come from the environment so no personal address is written into the code. */
export function ContactLine() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return email ? (
    <a className="underline" href={`mailto:${email}`}>
      {email}
    </a>
  ) : (
    <span>the contact details published with this site</span>
  );
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-ink-soft">Last updated {UPDATED}</p>
      <div className="mt-6 space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
    </main>
  );
}
