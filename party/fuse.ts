import type * as Party from "partykit/server";
import {
  disconnect, join, newState, nextWakeup, powerup, reapStale, rematch, start, submit, tick,
  type Deps, type FuseState, type Result,
} from "../src/lib/fuse/engine";
import { isWord, pickChunk } from "./dictionary";

const deps: Deps = { isWord, pickChunk };

type ClientMsg =
  | { type: "start" }
  | { type: "submit"; word: string }
  | { type: "powerup" }
  | { type: "rematch" };

export default class FuseRoom implements Party.Server {
  state: FuseState = newState();
  /** connection id -> stable player id (a player can briefly hold two sockets while reconnecting) */
  conns = new Map<string, string>();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const q = new URL(ctx.request.url).searchParams;
    const pid = (q.get("pid") ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    if (!pid) return conn.close(4000, "missing_pid");
    const res = join(
      this.state,
      { id: pid, name: q.get("name") ?? "", streak: Number(q.get("streak")) || 0 },
      Date.now(),
    );
    if (!res.ok) {
      conn.send(JSON.stringify({ type: "rejected", reason: res.reason }));
      return conn.close(4001, res.reason);
    }
    this.conns.set(conn.id, pid);
    this.publish();
  }

  onClose(conn: Party.Connection) {
    const pid = this.conns.get(conn.id);
    this.conns.delete(conn.id);
    if (!pid) return;
    // Only treat as gone if no other live socket belongs to the same player.
    if ([...this.conns.values()].includes(pid)) return;
    disconnect(this.state, pid, Date.now());
    this.resetIfAbandoned();
    this.publish();
  }

  onMessage(raw: string, sender: Party.Connection) {
    const pid = this.conns.get(sender.id);
    if (!pid || typeof raw !== "string" || raw.length > 200) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const now = Date.now();
    this.step(now); // settle any expired fuse before applying the action
    let res: Result;
    switch (msg.type) {
      case "start":
        res = start(this.state, pid, now, deps);
        break;
      case "submit":
        res = submit(this.state, pid, String(msg.word ?? "").slice(0, 30), now, deps);
        break;
      case "powerup":
        res = powerup(this.state, pid, now);
        break;
      case "rematch":
        res = rematch(this.state, pid);
        break;
      default:
        return;
    }
    if (!res.ok) sender.send(JSON.stringify({ type: "rejected", reason: res.reason }));
    this.publish();
  }

  async onAlarm() {
    this.step(Date.now());
    this.publish();
  }

  private step(now: number) {
    // A single wakeup can owe several burns if the room was idle; settle them all.
    for (let i = 0; i < 50 && tick(this.state, now, deps); i++);
    reapStale(this.state, now, deps);
    this.resetIfAbandoned();
  }

  /** A finished game nobody is watching must not lock the room code: hand the next visitor a fresh lobby. */
  private resetIfAbandoned() {
    if (this.conns.size === 0 && this.state.phase === "ended") this.state = newState();
  }

  private publish() {
    this.room.broadcast(JSON.stringify({ type: "state", state: this.state, serverNow: Date.now() }));
    const t = nextWakeup(this.state);
    if (t !== null) void this.room.storage.setAlarm(Math.max(t, Date.now() + 5));
  }
}
