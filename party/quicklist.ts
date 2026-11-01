import type * as Party from "partykit/server";
import { cleanName } from "../src/lib/name-filter";
import {
  SEAT_HOLD_MS, disconnect, done, flag, join, newState, next, nextWakeup, ready, rematch, setAnswer, start,
  tick, viewFor, type QState, type Result,
} from "../src/lib/quicklist/engine";

type ClientMsg =
  | { type: "start" }
  | { type: "answer"; cat: number; text: string }
  | { type: "done" }
  | { type: "flag"; owner: string; cat: number }
  | { type: "ready" }
  | { type: "next" }
  | { type: "rematch" };

export default class QuicklistRoom implements Party.Server {
  state: QState = newState();
  /** connection id -> stable player id */
  conns = new Map<string, string>();
  /** when the last socket left; an abandoned game is reset after the seat hold */
  emptySince: number | null = null;

  constructor(readonly room: Party.Room) {}

  /** Restores a room after a restart or eviction. No connection survives that, so every seat is held for 60 s. */
  async onStart() {
    const saved = await this.room.storage.get<QState>("state");
    if (!saved || typeof saved !== "object" || !Array.isArray(saved.players)) return;
    this.state = saved;
    const now = Date.now();
    for (const p of [...this.state.players]) if (p.connected) disconnect(this.state, p.id, now);
    this.emptySince = now; // nobody is here yet: an abandoned game is reset after the seat hold
    this.publish();
  }

  private persistTimer?: ReturnType<typeof setTimeout>;
  private persist() {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.room.storage.put("state", this.state), 300);
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const q = new URL(ctx.request.url).searchParams;
    const pid = (q.get("pid") ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    if (!pid) return conn.close(4000, "missing_pid");
    const res = join(this.state, { id: pid, name: cleanName(q.get("name")) }, Date.now());
    if (!res.ok) {
      conn.send(JSON.stringify({ type: "rejected", reason: res.reason }));
      return conn.close(4001, res.reason);
    }
    this.conns.set(conn.id, pid);
    this.emptySince = null;
    this.publish();
  }

  onClose(conn: Party.Connection) {
    const pid = this.conns.get(conn.id);
    this.conns.delete(conn.id);
    if (!pid) return;
    if (![...this.conns.values()].includes(pid)) {
      disconnect(this.state, pid, Date.now());
      // everyone present may now be done / ready
      if (this.state.phase === "writing" || this.state.phase === "review") this.recheck();
    }
    if (this.conns.size === 0) this.emptySince = Date.now();
    this.publish();
  }

  onMessage(raw: string, sender: Party.Connection) {
    const pid = this.conns.get(sender.id);
    if (!pid || typeof raw !== "string" || raw.length > 400) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const now = Date.now();
    tick(this.state, now); // settle an expired phase before applying the action
    let res: Result;
    switch (msg.type) {
      case "start": res = start(this.state, pid, now); break;
      case "answer": res = setAnswer(this.state, pid, Number(msg.cat), String(msg.text ?? "")); break;
      case "done": res = done(this.state, pid, now); break;
      case "flag": res = flag(this.state, pid, String(msg.owner ?? ""), Number(msg.cat)); break;
      case "ready": res = ready(this.state, pid); break;
      case "next": res = next(this.state, pid, now); break;
      case "rematch": res = rematch(this.state, pid); break;
      default: return;
    }
    if (!res.ok) sender.send(JSON.stringify({ type: "rejected", reason: res.reason }));
    // answers are drafts that only matter to their author until review: skip the broadcast for them
    if (msg.type === "answer" && res.ok) return this.persist();
    this.publish();
  }

  async onAlarm() {
    const now = Date.now();
    tick(this.state, now);
    if (this.conns.size === 0 && this.emptySince !== null && now - this.emptySince >= SEAT_HOLD_MS) {
      this.state = newState();
      this.emptySince = null;
    }
    this.publish();
  }

  /** After someone leaves, the remaining players may already all be done / ready. */
  private recheck() {
    const now = Date.now();
    const s = this.state;
    const here = s.players.filter((p) => p.connected);
    if (here.length === 0) return;
    if (s.phase === "writing" && here.every((p) => p.done)) done(s, here[0].id, now);
    else if (s.phase === "review" && here.every((p) => p.ready)) ready(s, here[0].id);
  }

  private publish() {
    this.persist();
    for (const conn of this.room.getConnections()) {
      const pid = this.conns.get(conn.id);
      if (!pid) continue;
      conn.send(JSON.stringify({ type: "state", state: viewFor(this.state, pid), serverNow: Date.now() }));
    }
    let wake = nextWakeup(this.state);
    if (this.emptySince !== null) wake = Math.min(wake ?? Infinity, this.emptySince + SEAT_HOLD_MS);
    if (wake !== null && Number.isFinite(wake)) void this.room.storage.setAlarm(Math.max(wake, Date.now() + 5));
  }
}
