import { defineChain } from 'viem';

export const worldChainSepolia = defineChain({
  id: 4801,
  name: 'World Chain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.EXPO_PUBLIC_WORLDCHAIN_SEPOLIA_RPC ?? 'https://worldchain-sepolia.g.alchemy.com/public'],
    },
  },
  blockExplorers: { default: { name: 'Worldscan', url: 'https://sepolia.worldscan.org' } },
  testnet: true,
});

export const FAUCET_URL = 'https://ethglobal.com/faucet/world-chain-sepolia-4801';
export const TOPUP_ADDRESS = process.env.EXPO_PUBLIC_TOPUP_ADDRESS ?? '0x0000000000000000000000000000000000000000';
export const TOPUP_ETH = process.env.EXPO_PUBLIC_TOPUP_ETH ?? '0.0001';

export function explorerTxUrl(hash: string): string {
  return `https://sepolia.worldscan.org/tx/${hash}`;
}
