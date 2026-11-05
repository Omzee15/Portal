import type { Metadata } from "next";
import { ContactLine, GrievanceOfficer, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy">
      <p>Portal is a set of daily games, live party games and a journal. It keeps very little about you, and this page says exactly what, why, for how long, and what you can do about it.</p>

      <h2>No accounts, no ads, nothing sold</h2>
      <p>You don&apos;t sign up. There are no ads, no trackers and no analytics. We don&apos;t sell or share your data, and we don&apos;t use it to profile you.</p>

      <h2>What stays on your device</h2>
      <ul>
        <li>Your game progress, results and streaks.</li>
        <li>Your journal notes and the stickers you earn.</li>
        <li>The display name you choose for party games, and a random player ID so a room can recognise you if you reconnect.</li>
      </ul>
      <p>This stays in your browser and is never sent to us. Clearing your site data for Portal deletes it all.</p>

      <h2>What reaches our servers</h2>
      <ul>
        <li><b>Daily games:</b> each guess is sent to the server to be checked. Guesses aren&apos;t stored or linked to you.</li>
        <li><b>Party games:</b> your display name, random player ID and what you do in the room, such as words, answers, drawings and chat messages. Other players in the room see these. Chat is filtered for slurs and profanity.</li>
        <li><b>Your IP address:</b> used to stop abuse such as scripted guessing. It is kept in memory for a few minutes and never written to a database.</li>
      </ul>

      <h2>Why we use it</h2>
      <p>Only to run the game you asked to play and to keep the service safe from abuse. You provide this information yourself when you play. Under India&apos;s Digital Personal Data Protection Act 2023, it is used only for that purpose. For visitors covered by the EU or UK GDPR, the legal basis is providing the service you request and our legitimate interest in keeping it secure.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Party rooms are deleted completely, including names, chat and drawings, one minute after the last player leaves.</li>
        <li>The daily-game cookie expires after 48 hours.</li>
        <li>Abuse-protection data is kept in memory only, for a few minutes.</li>
        <li>Our hosts keep ordinary server logs for their own short periods.</li>
      </ul>

      <h2>Cookies</h2>
      <p>Each daily game sets one small cookie that counts your guesses for the day, so the answer can only be revealed when the game is over. It is strictly necessary for the game to work, holds no personal information, can&apos;t be read by scripts and expires after 48 hours. We use no advertising, analytics or tracking cookies, so there is nothing to opt in or out of.</p>

      <h2>Services we rely on</h2>
      <ul>
        <li>Our web host and our party-game host run Portal for us. They receive your IP address and basic request details in their ordinary server logs. Their servers may be outside India.</li>
        <li>The Pixel Peek pictures are freely licensed images fetched by our server from Wikimedia Commons. Your device doesn&apos;t contact Wikimedia for them.</li>
      </ul>

      <h2>How it is protected</h2>
      <p>Everything is sent over an encrypted connection. Answers are checked on the server, so they never reach your device early. Requests are rate-limited, and the site blocks third-party scripts.</p>

      <h2>Your rights</h2>
      <p>You can ask us what data we hold about you, ask us to correct or delete it, and complain to us about how it is handled. Under the DPDP Act you can also name someone to act for you. Almost everything lives on your own device, so in practice:</p>
      <ul>
        <li>To delete your data, clear your site data for Portal. Party rooms delete themselves once everyone leaves.</li>
        <li>For anything else, write to us at <ContactLine />.</li>
      </ul>
      <p>If you&apos;re not satisfied with our reply, you can complain to the Data Protection Board of India or, in the EU or UK, to your local data protection authority.</p>

      <h2>Who it&apos;s for</h2>
      <p>Portal is only for people aged 18 and over. We don&apos;t knowingly handle children&apos;s data. If you think a child has used a party room, tell us and we&apos;ll remove anything that remains.</p>

      <h2>Grievance officer</h2>
      <p>Complaints about privacy or content on Portal go to our grievance officer, <GrievanceOfficer />, at <ContactLine />. We acknowledge complaints within 24 hours and resolve them within 15 days.</p>

      <h2>Changes</h2>
      <p>If this page changes, the date at the top changes too. We will never start collecting more without saying so here first.</p>
    </LegalPage>
  );
}
