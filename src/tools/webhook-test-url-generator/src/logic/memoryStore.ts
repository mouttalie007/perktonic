// The in-memory CaptureStore (v1: one Node process on the VPS). State lives on globalThis so that
// dev hot reloads keep it; a server restart loses it, which the page says ("temporary").
import { CAPTURES_PER_MINUTE, MAX_ACTIVE_PER_IP, MAX_ENDPOINTS, MAX_EXTENSIONS, MAX_REQUESTS, TTL_MINUTES } from "../limits";
import type { Captured, EndpointView, ReplySettings } from "../types";
import { newId } from "./ids";
import { systemClock, type CaptureStore, type Clock, type StoreEvent } from "./store";

interface Entry {
  id: string;
  ownerIp: string;
  createdAt: number;
  expiresAt: number;
  extensions: number;
  reply: ReplySettings;
  requests: Captured[];
  hits: number[];
  listeners: Set<(e: StoreEvent) => void>;
}

export const DEFAULT_REPLY: ReplySettings = { status: 200, contentType: "text/plain", body: "ok", delayMs: 0 };
const TTL_MS = TTL_MINUTES * 60_000;

export class MemoryStore implements CaptureStore {
  private map = new Map<string, Entry>();
  constructor(
    private clock: Clock = systemClock,
    private makeId: () => string = newId,
  ) {}

  private live(id: string): Entry | null {
    const e = this.map.get(id);
    if (!e) return null;
    if (e.expiresAt <= this.clock.now()) {
      this.drop(e);
      return null;
    }
    return e;
  }

  private view(e: Entry): EndpointView {
    return { id: e.id, createdAt: new Date(e.createdAt).toISOString(), expiresAt: new Date(e.expiresAt).toISOString(), extensionsLeft: MAX_EXTENSIONS - e.extensions, reply: { ...e.reply }, requests: [...e.requests] };
  }

  private emit(e: Entry, ev: StoreEvent) {
    for (const l of e.listeners) l(ev);
  }

  private drop(e: Entry) {
    this.map.delete(e.id);
    this.emit(e, { type: "deleted" });
    e.listeners.clear();
  }

  create(ownerIp: string) {
    this.sweep();
    if ([...this.map.values()].filter((e) => e.ownerIp === ownerIp).length >= MAX_ACTIVE_PER_IP) return { ok: false as const, code: "too_many_for_ip" as const };
    if (this.map.size >= MAX_ENDPOINTS) return { ok: false as const, code: "full" as const };
    const now = this.clock.now();
    const e: Entry = { id: this.makeId(), ownerIp, createdAt: now, expiresAt: now + TTL_MS, extensions: 0, reply: { ...DEFAULT_REPLY }, requests: [], hits: [], listeners: new Set() };
    this.map.set(e.id, e);
    return { ok: true as const, endpoint: this.view(e) };
  }

  get(id: string) {
    const e = this.live(id);
    return e ? this.view(e) : null;
  }

  hit(id: string) {
    const e = this.live(id);
    if (!e) return false;
    const now = this.clock.now();
    e.hits = e.hits.filter((t) => now - t < 60_000);
    if (e.hits.length >= CAPTURES_PER_MINUTE) return false;
    e.hits.push(now);
    return true;
  }

  add(id: string, request: Captured) {
    const e = this.live(id);
    if (!e) return false;
    // Newest first; the ring keeps the last MAX_REQUESTS.
    e.requests = [request, ...e.requests].slice(0, MAX_REQUESTS);
    this.emit(e, { type: "capture", request });
    return true;
  }

  extend(id: string) {
    const e = this.live(id);
    if (!e) return { ok: false as const, code: "not_found" as const };
    if (e.extensions >= MAX_EXTENSIONS) return { ok: false as const, code: "no_more_extensions" as const };
    e.extensions++;
    e.expiresAt = this.clock.now() + TTL_MS;
    const v = this.view(e);
    this.emit(e, { type: "updated", endpoint: v });
    return { ok: true as const, endpoint: v };
  }

  clear(id: string) {
    const e = this.live(id);
    if (!e) return false;
    e.requests = [];
    this.emit(e, { type: "cleared" });
    return true;
  }

  remove(id: string) {
    const e = this.map.get(id);
    if (!e) return false;
    this.drop(e);
    return true;
  }

  setReply(id: string, reply: ReplySettings) {
    const e = this.live(id);
    if (!e) return null;
    e.reply = { ...reply };
    const v = this.view(e);
    this.emit(e, { type: "updated", endpoint: v });
    return v;
  }

  findRequest(id: string, requestId: string) {
    return this.live(id)?.requests.find((r) => r.id === requestId) ?? null;
  }

  subscribe(id: string, listener: (e: StoreEvent) => void) {
    const e = this.live(id);
    if (!e) return () => {};
    e.listeners.add(listener);
    return () => e.listeners.delete(listener);
  }

  sweep() {
    const now = this.clock.now();
    let n = 0;
    for (const e of [...this.map.values()])
      if (e.expiresAt <= now) {
        this.drop(e);
        n++;
      }
    return n;
  }

  size() {
    return this.map.size;
  }
}

const G = globalThis as unknown as { __webhookCatcher?: { store: MemoryStore; timer: ReturnType<typeof setInterval> } };

/** The process-wide store, swept every minute (the timer does not keep the process alive). */
export function getStore(): MemoryStore {
  if (!G.__webhookCatcher) {
    const store = new MemoryStore();
    const timer = setInterval(() => store.sweep(), 60_000);
    (timer as { unref?: () => void }).unref?.();
    G.__webhookCatcher = { store, timer };
  }
  return G.__webhookCatcher.store;
}
