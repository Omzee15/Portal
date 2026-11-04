import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms of use">
      <p>By using Portal you agree to these terms. They&apos;re short on purpose.</p>

      <h2>Using Portal</h2>
      <ul>
        <li>Portal is free to use, for people aged 18 and over.</li>
        <li>Play fairly. Don&apos;t use scripts, bots or other tools to find answers, to flood the service with requests, or to disrupt other people&apos;s games.</li>
        <li>Pick a display name you&apos;d be happy for your friends to see. Names that are abusive, hateful or impersonate someone may be replaced or blocked.</li>
      </ul>

      <h2>The service is provided as is</h2>
      <p>Portal is offered without any promise that it will always be available or error-free. Puzzles are generated and may occasionally contain mistakes. We may change or remove games at any time. To the extent the law allows, we aren&apos;t liable for losses arising from using Portal.</p>

      <h2>Content</h2>
      <p>Artworks in Pixel Peek are in the public domain and come from Wikimedia Commons. Word definitions in Wordsplice come from WordNet, which is free to use under its own licence. Game names and designs are ours.</p>

      <h2>Your data</h2>
      <p>See the <a className="underline" href="/privacy">Privacy</a> page for what is stored and why.</p>

      <h2>Contact</h2>
      <p>Questions about these terms: <ContactLine />.</p>
    </LegalPage>
  );
}
