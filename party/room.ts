import type * as Party from "partykit/server";
import { cleanName } from "../src/lib/name-filter";
import { SEAT_HOLD_MS, join, leave, type Engine, type RoomState, type Seat } from "../src/lib/party-room/core";

// A stored value is capped at 128 KB and Doodle Relay rooms can be bigger, so state is saved in pieces.
const CHUNK = 100_000;
// Each connection may send a burst of 40 messages, refilled at 20 a second: plenty for typing and drawing, not for flooding.
const BURST = 40, REFILL_PER_MS = 20 / 1000;

/** Wraps a pure engine in a PartyKit room: sockets, saving, restoring after a restart, and timers. */
export function roomServer<S extends RoomState<P>, P extends Seat>(engine: Engine<S, P>) {
  return class Room implements Party.Server {
    state: S = engine.newState();
    conns = new Map<string, string>();
    budget = new Map<string, { tokens: number; at: number }>();
    emptySince: number | null = null;
    persistTimer?: ReturnType<typeof setTimeout>;

    constructor(readonly room: Party.Room) {}

    async onStart() {
      const count = await this.room.storage.get<number>("chunks");
      if (!count) return;
      const parts = await this.room.storage.get<string>(Array.from({ length: count }, (_, i) => `state:${i}`));
      try {
        const saved = JSON.parse(Array.from({ length: count }, (_, i) => parts.get(`state:${i}`) ?? "").join("")) as S;
        if (!Array.isArray(saved?.players)) return;
        this.state = saved;
      } catch {
        return;
      }
      const now = Date.now();
      for (const p of [...this.state.players]) if (p.connected) leave(this.state, p.id, now);
      this.emptySince = now;
      this.publish();
    }

    persist() {
      clearTimeout(this.persistTimer);
      this.persistTimer = setTimeout(() => {
        const json = JSON.stringify(this.state);
        const entries: Record<string, string | number> = { chunks: Math.ceil(json.length / CHUNK) || 1 };
        for (let i = 0; i * CHUNK < json.length; i++) entries[`state:${i}`] = json.slice(i * CHUNK, (i + 1) * CHUNK);
        void this.room.storage.put(entries);
      }, 300);
    }

    onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
      const q = new URL(ctx.request.url).searchParams;
      const pid = (q.get("pid") ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
      if (!pid) return conn.close(4000, "missing_pid");
      const res = join(engine, this.state, { id: pid, name: cleanName(q.get("name")) }, Date.now());
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
      this.budget.delete(conn.id);
      if (!pid) return;
      if (![...this.conns.values()].includes(pid)) leave(this.state, pid, Date.now());
      if (this.conns.size === 0) this.emptySince = Date.now();
      engine.tick(this.state, Date.now());
      this.publish();
    }

    onMessage(raw: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection) {
      const pid = this.conns.get(sender.id);
      if (!pid || typeof raw !== "string" || raw.length > engine.maxMessage) return;
      if (!this.spend(sender.id)) return;
      let msg: unknown;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      const now = Date.now();
      engine.tick(this.state, now);
      const res = engine.apply(this.state, pid, msg as Record<string, unknown>, now);
      if (!res.ok) sender.send(JSON.stringify({ type: "rejected", reason: res.reason }));
      if (res.ok && res.quiet) return this.persist();
      this.publish();
    }

    /** Takes one message from the connection's allowance; false means it is sending too fast and the message is dropped. */
    spend(connId: string) {
      const now = Date.now();
      const b = this.budget.get(connId) ?? { tokens: BURST, at: now };
      b.tokens = Math.min(BURST, b.tokens + (now - b.at) * REFILL_PER_MS);
      b.at = now;
      this.budget.set(connId, b);
      if (b.tokens < 1) return false;
      b.tokens -= 1;
      return true;
    }

    async onAlarm() {
      const now = Date.now();
      engine.tick(this.state, now);
      if (this.conns.size === 0 && this.emptySince !== null && now - this.emptySince >= SEAT_HOLD_MS) {
        this.state = engine.newState();
        this.emptySince = null;
        // nothing from the old game (names, chat, drawings) is kept once the room is cleared
        await this.room.storage.deleteAll();
      }
      this.publish();
    }

    publish() {
      this.persist();
      for (const conn of this.room.getConnections()) {
        const pid = this.conns.get(conn.id);
        if (pid) conn.send(JSON.stringify({ type: "state", state: engine.viewFor(this.state, pid), serverNow: Date.now() }));
      }
      let wake = engine.nextWakeup(this.state);
      if (this.emptySince !== null) wake = Math.min(wake ?? Infinity, this.emptySince + SEAT_HOLD_MS);
      if (wake !== null && Number.isFinite(wake)) void this.room.storage.setAlarm(Math.max(wake, Date.now() + 5));
    }
  };
}
