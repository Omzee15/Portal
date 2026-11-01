"use client";

import { useSyncExternalStore } from "react";

import type { GameId } from "./games";
import { CORE_IDS } from "./games";

export type { GameId };

/** The three dailies that make a "full" day. Bonus games count toward streaks but not toward this. */
export const CORE_GAMES: GameId[] = CORE_IDS;

export function coreCount(day: Results[string] | undefined): number {
  return CORE_GAMES.filter((g) => day?.[g]).length;
}

export type DayResult = {
  puzzle: number;
  solved: boolean;
  /** letterbox: guesses used; bundle: mistakes made; pixel-peek: guesses used */
  score: number;
  /** spoiler-free emoji grid for sharing and journal stamps */
  grid: string;
  /** pixel-peek: a tiny pixelated copy of the solved picture (data URL), used as a journal sticker */
  sticker?: string;
};

export type Results = Record<string, Partial<Record<GameId, DayResult>>>;
export type Notes = Record<string, string>;

const RESULTS_KEY = "pastime:v1:results";
const NOTES_KEY = "pastime:v1:notes";
const EVENT = "pastime:change";

const EMPTY_RESULTS: Results = {};
const EMPTY_NOTES: Notes = {};

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota: keep playing, just don't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// useSyncExternalStore needs a referentially stable snapshot, so parse only when the raw string changes.
function makeSnapshot<T extends object>(key: string, empty: T) {
  let lastRaw: string | null = null;
  let lastValue: T = empty;
  return () => {
    const raw = read(key);
    if (raw !== lastRaw) {
      lastRaw = raw;
      try {
        lastValue = raw ? (JSON.parse(raw) as T) : empty;
      } catch {
        lastValue = empty;
      }
    }
    return lastValue;
  };
}

const resultsSnapshot = makeSnapshot<Results>(RESULTS_KEY, EMPTY_RESULTS);
const notesSnapshot = makeSnapshot<Notes>(NOTES_KEY, EMPTY_NOTES);

export function useResults(): Results {
  return useSyncExternalStore(subscribe, resultsSnapshot, () => EMPTY_RESULTS);
}

export function useNotes(): Notes {
  return useSyncExternalStore(subscribe, notesSnapshot, () => EMPTY_NOTES);
}

/** Idempotent: recording the same game and day twice keeps the first result. */
export function recordResult(date: string, game: GameId, result: DayResult) {
  const all = resultsSnapshot();
  if (all[date]?.[game]) return;
  write(RESULTS_KEY, JSON.stringify({ ...all, [date]: { ...all[date], [game]: result } }));
}

export function setNote(date: string, text: string) {
  const all = notesSnapshot();
  const next = { ...all };
  if (text) next[date] = text;
  else delete next[date];
  write(NOTES_KEY, JSON.stringify(next));
}

/** Days with at least one daily finished. */
export function playedDates(results: Results): Set<string> {
  return new Set(Object.keys(results).filter((d) => Object.keys(results[d] ?? {}).length > 0));
}
