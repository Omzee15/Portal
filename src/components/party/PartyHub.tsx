"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { saveName, savedName } from "@/lib/identity";
import { isRoomCode, newRoomCode } from "@/lib/room-code";

const GAMES = [
  {
    id: "fuse",
    base: "/r",
    name: "Fuse",
    bg: "bg-mauve",
    blurb: "A letter chunk appears. Type a word containing it before the fuse burns out. Three lives, and the fuse gets shorter.",
    players: "2–12 players · ~10 min",
  },
  {
    id: "quicklist",
    base: "/q",
    name: "Quicklist",
    bg: "bg-teal",
    blurb: "A letter, eight categories, ninety seconds. Write an answer for each: if anyone else writes the same, neither scores. Answers must be real, but spelling slips are fine.",
    players: "2–12 players · ~15 min",
  },
  {
    id: "hintline",
    base: "/h",
    name: "Hintline",
    bg: "bg-mustard",
    blurb: "Two teams, 25 words. A clue-giver links words with one-word hints while the team tries not to hit the trap.",
    players: "4–12 players · ~15 min",
  },
  {
    id: "duel",
    base: "/d",
    name: "Letterbox Duel",
    bg: "bg-terracotta",
    blurb: "Everyone guesses the same hidden word, and all rows flip together each turn. You see rivals' colours, never their letters. First to solve takes the round.",
    players: "2–8 players · ~10 min",
  },
  {
    id: "doodle",
    base: "/s",
    name: "Doodle Dash",
    bg: "bg-sage",
    blurb: "Take turns drawing a word while everyone else races to guess it in the chat. Quicker guesses score more.",
    players: "2–10 players · ~15 min",
  },
] as const;

export function PartyHub() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string>();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the saved name; localStorage is unavailable during SSR
  useEffect(() => setName(savedName()), []);

  const go = (base: string, c: string) => {
    if (!name.trim()) return setErr("Pick a name your friends will recognise.");
    saveName(name);
    router.push(`${base}/${c}`);
  };

  return (
    <div className="px-4 pt-5 pb-6 md:px-6 md:pt-8">
      <h1 className="font-serif text-3xl font-bold">Party</h1>
      <p className="font-serif text-sm italic text-ink-soft">Live games for the evening. Pick one, share the code.</p>

      <label className="mt-5 block max-w-sm text-xs font-bold uppercase tracking-wide">
        Your name
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErr(undefined);
          }}
          maxLength={16}
          placeholder="e.g. Kabir"
          className="mt-1 h-12 w-full rounded-xl border-[1.5px] border-ink bg-paper px-3 text-base font-normal normal-case tracking-normal"
        />
      </label>
      {err && (
        <p role="alert" className="mt-2 text-sm font-bold text-brick">
          {err}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        {GAMES.map((g) => (
          <section key={g.id} className={`card p-4 ${g.bg}`}>
            <h2 className="font-serif text-xl font-bold">{g.name}</h2>
            <p className="font-pixel mt-0.5 text-[10px] uppercase">{g.players}</p>
            <p className="mt-2 text-sm">{g.blurb}</p>
            <button onClick={() => go(g.base, newRoomCode())} className="mt-4 h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper active:scale-[0.97]">
              Create a room
            </button>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const c = (codes[g.id] ?? "").trim().toUpperCase();
                if (!isRoomCode(c)) return setErr("Room codes are 4 letters.");
                go(g.base, c);
              }}
            >
              <input
                value={codes[g.id] ?? ""}
                onChange={(e) => {
                  setCodes((c) => ({ ...c, [g.id]: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) }));
                  setErr(undefined);
                }}
                placeholder="CODE"
                aria-label={`${g.name} room code`}
                autoCapitalize="characters"
                autoComplete="off"
                className="font-pixel h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-ink bg-paper px-3 text-center text-lg tracking-widest"
              />
              <button className="h-12 rounded-full border-[1.5px] border-ink bg-paper px-6 font-bold active:scale-[0.97]">Join</button>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}
