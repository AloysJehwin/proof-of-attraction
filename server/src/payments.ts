import { createPublicClient, http, defineChain, parseEther } from 'viem';

export const worldChainSepolia = defineChain({
  id: 4801,
  name: 'World Chain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.WORLDCHAIN_SEPOLIA_RPC ?? 'https://worldchain-sepolia.g.alchemy.com/public'] } },
  blockExplorers: { default: { name: 'Worldscan', url: 'https://sepolia.worldscan.org' } },
  testnet: true,
});

export const publicClient = createPublicClient({ chain: worldChainSepolia, transport: http() });
const client = publicClient;

export const TOPUP_ADDRESS = (process.env.TOPUP_ADDRESS ?? '0x0000000000000000000000000000000000000000').toLowerCase();
export const TOPUP_MIN_WEI = parseEther(process.env.TOPUP_MIN_ETH ?? '0.0001');
export const TOPUP_CALLS_GRANTED = Number(process.env.TOPUP_CALLS_GRANTED ?? 10);

export type ReceiptCheck = { valid: boolean; reason?: string };

export async function verifyTopUp(txHash: string): Promise<ReceiptCheck> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return { valid: false, reason: 'malformed tx hash' };
  const receipt = await client
    .waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 45_000, pollingInterval: 1_500 })
    .catch(() => null);
  if (!receipt) return { valid: false, reason: 'transaction not confirmed yet, retry in a few seconds' };
  if (receipt.status !== 'success') return { valid: false, reason: 'tx reverted' };
  const tx = await client.getTransaction({ hash: txHash as `0x${string}` }).catch(() => null);
  if (!tx) return { valid: false, reason: 'tx not found' };
  if ((tx.to ?? '').toLowerCase() !== TOPUP_ADDRESS) return { valid: false, reason: 'wrong recipient' };
  if (tx.value < TOPUP_MIN_WEI) return { valid: false, reason: 'insufficient value' };
  return { valid: true };
}
