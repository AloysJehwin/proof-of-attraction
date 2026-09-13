import { Redis } from '@upstash/redis';

export interface AgentKitStorage {
  tryIncrementUsage(humanId: string, limit: number): Promise<{ used: number; allowed: boolean }>;
  creditUsage(humanId: string, calls: number): Promise<void>;
  usageFor(humanId: string): Promise<number>;
  creditFor(humanId: string): Promise<number>;
  hasUsedNonce(nonce: string): Promise<boolean>;
  recordNonce(nonce: string): Promise<void>;
  registerWallet(wallet: string, humanId: string): Promise<void>;
  humanForWallet(wallet: string): Promise<string | null>;
  recordNullifier(nullifier: string): Promise<boolean>;
}

class MemoryStorage implements AgentKitStorage {
  private usage = new Map<string, number>();
  private credit = new Map<string, number>();
  private nonces = new Set<string>();
  private wallets = new Map<string, string>();
  private nullifiers = new Set<string>();

  async tryIncrementUsage(humanId: string, limit: number) {
    const effectiveLimit = limit + (this.credit.get(humanId) ?? 0);
    const current = this.usage.get(humanId) ?? 0;
    if (current >= effectiveLimit) return { used: current, allowed: false };
    this.usage.set(humanId, current + 1);
    return { used: current + 1, allowed: true };
  }
  async creditUsage(humanId: string, calls: number) {
    this.credit.set(humanId, (this.credit.get(humanId) ?? 0) + calls);
  }
  async usageFor(humanId: string) {
    return this.usage.get(humanId) ?? 0;
  }
  async creditFor(humanId: string) {
    return this.credit.get(humanId) ?? 0;
  }
  async hasUsedNonce(nonce: string) {
    return this.nonces.has(nonce);
  }
  async recordNonce(nonce: string) {
    this.nonces.add(nonce);
  }
  async registerWallet(wallet: string, humanId: string) {
    this.wallets.set(wallet.toLowerCase(), humanId);
  }
  async humanForWallet(wallet: string) {
    return this.wallets.get(wallet.toLowerCase()) ?? null;
  }
  async recordNullifier(nullifier: string) {
    if (this.nullifiers.has(nullifier)) return false;
    this.nullifiers.add(nullifier);
    return true;
  }
}

class RedisStorage implements AgentKitStorage {
  constructor(private redis: Redis) {}

  private usageKey(h: string) { return `usage:${h}`; }
  private creditKey(h: string) { return `credit:${h}`; }
  private nonceKey(n: string) { return `nonce:${n}`; }
  private walletKey(w: string) { return `wallet:${w.toLowerCase()}`; }
  private nullKey(n: string) { return `nullifier:${n}`; }

  async tryIncrementUsage(humanId: string, limit: number) {
    const credit = Number((await this.redis.get(this.creditKey(humanId))) ?? 0);
    const effectiveLimit = limit + credit;
    const used = await this.redis.incr(this.usageKey(humanId));
    if (used > effectiveLimit) {
      await this.redis.decr(this.usageKey(humanId));
      return { used: used - 1, allowed: false };
    }
    return { used, allowed: true };
  }
  async creditUsage(humanId: string, calls: number) {
    await this.redis.incrby(this.creditKey(humanId), calls);
  }
  async usageFor(humanId: string) {
    return Number((await this.redis.get(this.usageKey(humanId))) ?? 0);
  }
  async creditFor(humanId: string) {
    return Number((await this.redis.get(this.creditKey(humanId))) ?? 0);
  }
  async hasUsedNonce(nonce: string) {
    return (await this.redis.exists(this.nonceKey(nonce))) === 1;
  }
  async recordNonce(nonce: string) {
    await this.redis.set(this.nonceKey(nonce), '1', { nx: true });
  }
  async registerWallet(wallet: string, humanId: string) {
    await this.redis.set(this.walletKey(wallet), humanId);
  }
  async humanForWallet(wallet: string) {
    return (await this.redis.get<string>(this.walletKey(wallet))) ?? null;
  }
  async recordNullifier(nullifier: string) {
    const res = await this.redis.set(this.nullKey(nullifier), '1', { nx: true });
    return res === 'OK';
  }
}

let instance: AgentKitStorage | null = null;

export function getStorage(): AgentKitStorage {
  if (instance) return instance;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  instance = url && token ? new RedisStorage(new Redis({ url, token })) : new MemoryStorage();
  return instance;
}

export const usingRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL);
