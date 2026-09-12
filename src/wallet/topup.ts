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

let signer: Signer | null = null;

export function registerSigner(fn: Signer | null): void {
  signer = fn;
}

export function walletConnected(): boolean {
  return signer !== null;
}

export async function topUpAgent(): Promise<TopUpResult> {
  if (!signer) return { ok: false, error: 'wallet not connected' };

  const signed = await signer();
  if (!signed.ok || !signed.hash) return signed;

  try {
    const res = await authedFetch('/agent/topup', {
      method: 'POST',
      body: JSON.stringify({ txHash: signed.hash }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; credited?: number; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, hash: signed.hash, explorerUrl: explorerTxUrl(signed.hash), error: data.error ?? 'settlement rejected' };
    }
    return { ok: true, hash: signed.hash, explorerUrl: explorerTxUrl(signed.hash), credited: data.credited };
  } catch (e) {
    return { ok: false, hash: signed.hash, explorerUrl: explorerTxUrl(signed.hash), error: e instanceof Error ? e.message : 'network error' };
  }
}
