import type { Captured, EndpointView, ReplySettings } from "../types";

export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };

export type StoreEvent = { type: "capture"; request: Captured } | { type: "cleared" } | { type: "deleted" } | { type: "updated"; endpoint: EndpointView };

export type CreateError = "too_many_for_ip" | "full";

/** Where captured requests live. v1: memory (one Node process); a Redis or Postgres version can implement the same interface. */
export interface CaptureStore {
  create(ownerIp: string): { ok: true; endpoint: EndpointView } | { ok: false; code: CreateError };
  get(id: string): EndpointView | null;
  /** Records a capture; false when the endpoint is gone. Older requests beyond the ring size are dropped. */
  add(id: string, request: Captured): boolean;
  /** Counts a hit for the per-minute limit; false when the endpoint already had too many this minute. */
  hit(id: string): boolean;
  extend(id: string): { ok: true; endpoint: EndpointView } | { ok: false; code: "not_found" | "no_more_extensions" };
  clear(id: string): boolean;
  remove(id: string): boolean;
  setReply(id: string, reply: ReplySettings): EndpointView | null;
  findRequest(id: string, requestId: string): Captured | null;
  subscribe(id: string, listener: (e: StoreEvent) => void): () => void;
  /** Deletes expired endpoints; returns how many. */
  sweep(): number;
  size(): number;
}
