import { authedFetch } from '../auth/session';
import { explorerTxUrl } from './chain';

export type TopUpResult = {
  ok: boolean;
  hash?: string;
  explorerUrl?: string;
  credited?: number;
  error?: string;
};

type Signer = () => Promise<TopUpResult>;
type MessageSigner = (message: string) => Promise<string>;

let signer: Signer | null = null;
let messageSigner: MessageSigner | null = null;

export function registerSigner(fn: Signer | null): void {
  signer = fn;
}

export function registerMessageSigner(fn: MessageSigner | null): void {
  messageSigner = fn;
}

export function walletConnected(): boolean {
  return signer !== null;
}

export async function signAgentMessage(message: string): Promise<string> {
  if (!messageSigner) throw new Error('wallet not connected');
  return messageSigner(message);
}

export async function topUpAgent(): Promise<TopUpResult> {
  if (!signer) return { ok: false, error: 'wallet not connected' };

  const signed = await signer();
  if (!signed.ok || !signed.hash) return signed;

  let last: TopUpResult = { ok: false, hash: signed.hash, explorerUrl: explorerTxUrl(signed.hash), error: 'settlement pending' };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 4000));
    last = await creditTopUpFromTx(signed.hash);
    if (last.ok || /already credited|wrong recipient|insufficient value|reverted/i.test(last.error ?? '')) return last;
  }
  return last;
}

export async function creditTopUpFromTx(txHash: string): Promise<TopUpResult> {
  const hash = txHash.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return { ok: false, error: 'enter a valid 66-character transaction hash' };
  try {
    const res = await authedFetch('/agent/topup', { method: 'POST', body: JSON.stringify({ txHash: hash }) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; credited?: number; error?: string };
    if (!res.ok || !data.ok) return { ok: false, hash, explorerUrl: explorerTxUrl(hash), error: data.error ?? 'settlement rejected' };
    return { ok: true, hash, explorerUrl: explorerTxUrl(hash), credited: data.credited };
  } catch (e) {
    return { ok: false, hash, error: e instanceof Error ? e.message : 'network error' };
  }
}
