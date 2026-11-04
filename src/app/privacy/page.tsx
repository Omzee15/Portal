import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy">
      <p>Portal is a set of daily games, live party games and a journal. It keeps very little about you, and this page says exactly what.</p>

      <h2>No accounts, no ads, nothing sold</h2>
      <p>You don&apos;t sign up. There are no ads, no trackers and no analytics. We don&apos;t sell or share your data.</p>

      <h2>What is stored on your device</h2>
      <ul>
        <li>Your game progress, results and streaks.</li>
        <li>Your journal notes and the stickers you earn.</li>
        <li>The display name you choose for party games, and a random player ID so a room can recognise you if you reconnect.</li>
      </ul>
      <p>This stays in your browser. Clearing your site data for Portal deletes it all, and it is not copied anywhere else.</p>

      <h2>Cookies</h2>
      <p>Each daily game sets a small cookie that counts your guesses for the day, so the answer can only be revealed when the game is over. It holds no personal information, can&apos;t be read by scripts, and expires after 48 hours. We use no advertising or tracking cookies.</p>

      <h2>Party games</h2>
      <p>When you join a party room, the display name you typed and your moves are held on the game server while the room is active so everyone sees the same game. Rooms are cleared after they finish or sit empty. Other players in your room can see your display name, so don&apos;t use your real name if you&apos;d rather not.</p>

      <h2>Services we rely on</h2>
      <ul>
        <li>Our web host and our party-game host receive your IP address and basic request details in their ordinary server logs.</li>
        <li>The Pixel Peek pictures are freely licensed images fetched by our server from Wikimedia Commons. Your device doesn&apos;t contact Wikimedia for them.</li>
      </ul>

      <h2>Who it&apos;s for</h2>
      <p>Portal is intended for people aged 18 and over.</p>

      <h2>Questions or deletion</h2>
      <p>Because we hold no account data, there is nothing for us to delete on your behalf: clear your site data to remove everything. For anything else, reach us at <ContactLine />.</p>
    </LegalPage>
  );
}
