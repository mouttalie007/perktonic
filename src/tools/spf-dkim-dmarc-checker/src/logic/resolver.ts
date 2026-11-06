import type { DnsResult, DnsType } from "@/lib/tools/dns-query";

export type DnsFn = (name: string, type: DnsType, opts?: { timeoutMs?: number }) => Promise<DnsResult>;

/** Answer summary used by the checks; null when the query budget was used up or the resolver failed. */
export interface Answer {
  status: DnsResult["status"] | "error";
  /** TXT strings (joined per record) or other record data of the asked type. */
  values: string[];
}

/**
 * Counts every DNS query so one check never makes more than its share of the
 * 40-query budget, and caches answers (the same name is often asked twice).
 */
export class Resolver {
  used = 0;
  budgetReached = false;
  private cache = new Map<string, Promise<Answer | null>>();

  constructor(
    private dns: DnsFn,
    private max: number,
  ) {}

  remaining(): number {
    return this.max - this.used;
  }

  query(name: string, type: DnsType, reserve = 0): Promise<Answer | null> {
    const key = `${type} ${name.toLowerCase()}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    if (this.used >= this.max - reserve) {
      this.budgetReached = true;
      return Promise.resolve(null);
    }
    this.used++;
    const p = this.dns(name, type, { timeoutMs: 5000 }).then(
      (r): Answer => ({ status: r.status, values: r.records.filter((x) => x.type === type).map((x) => x.data) }),
      (e: { code?: string }): Answer | null => {
        if (e?.code === "invalid_name") return { status: "nxdomain", values: [] };
        return { status: "error", values: [] };
      },
    );
    this.cache.set(key, p);
    return p;
  }
}
