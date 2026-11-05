import type { Metadata } from "next";
import { ContactLine, GrievanceOfficer, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms of use">
      <p>By using Portal you agree to these terms. They&apos;re short on purpose.</p>

      <h2>Using Portal</h2>
      <ul>
        <li>Portal is free to use, for people aged 18 and over. By creating or joining a party room you confirm you are 18 or older.</li>
        <li>Play fairly. Don&apos;t use scripts, bots or other tools to find answers, to flood the service with requests, or to disrupt other people&apos;s games.</li>
        <li>Don&apos;t try to break into, overload or probe the service, and don&apos;t use it for anything unlawful.</li>
      </ul>

      <h2>What you share in party rooms</h2>
      <p>Your display name, answers, drawings and chat are seen by the other players in your room. You&apos;re responsible for what you post. Don&apos;t post anything that:</p>
      <ul>
        <li>is obscene, sexually explicit, hateful, or harasses or threatens anyone;</li>
        <li>impersonates someone, or shares another person&apos;s private information;</li>
        <li>is harmful to children, or breaks any law in force in India or where you are;</li>
        <li>infringes someone else&apos;s copyright or other rights, or contains malware or spam.</li>
      </ul>
      <p>Names and chat are filtered automatically, and anything that breaks these rules may be removed. If you see something that does, tell our grievance officer (below).</p>

      <h2>The service is provided as is</h2>
      <p>Portal is offered without any promise that it will always be available or error-free. Puzzles are generated and may occasionally contain mistakes. We may change or remove games at any time, and we may block anyone who breaks these terms. To the extent the law allows, we aren&apos;t liable for losses arising from using Portal.</p>

      <h2>Content</h2>
      <p>Artworks in Pixel Peek are in the public domain and come from Wikimedia Commons. Word definitions in Wordsplice come from WordNet, which is free to use under its own licence. Game names and designs are ours.</p>

      <h2>Your data</h2>
      <p>See the <a className="underline" href="/privacy">Privacy</a> page for what is stored, why, and your rights.</p>

      <h2>Complaints and grievance officer</h2>
      <p>As required by India&apos;s Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules 2021, complaints about content or these terms go to our grievance officer, <GrievanceOfficer />, at <ContactLine />. We acknowledge complaints within 24 hours and resolve them within 15 days.</p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of India. Nothing in them takes away rights you have under the consumer law of the country you live in.</p>
    </LegalPage>
  );
}
