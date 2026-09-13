import { privateKeyToAccount } from 'viem/accounts';

let key = (process.env.FUNDER_PRIVATE_KEY ?? '').trim();
if (key && !key.startsWith('0x')) key = `0x${key}`;
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.error('not an EVM key: expected 64 hex characters (optionally 0x-prefixed). Solana/TRON keys are not usable here.');
  process.exit(1);
}
const { address } = privateKeyToAccount(key);
console.log(`this key controls: ${address}`);
console.log(address.toLowerCase() === '0x465954c4de4b72ba549bcab6009bc903b5d0899e' ? 'MATCH: this is the wallet holding the 0.1 testnet ETH' : 'no match: try another key');
