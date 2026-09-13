import { createWalletClient, createPublicClient, http, parseEther, formatEther, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.WORLDCHAIN_SEPOLIA_RPC ?? 'https://worldchain-sepolia.g.alchemy.com/public';
const TO = (process.env.FUND_TO ?? '').trim();
const AMOUNT = process.env.FUND_ETH ?? '0.01';
let KEY = (process.env.FUNDER_PRIVATE_KEY ?? '').trim();
if (KEY && !KEY.startsWith('0x')) KEY = `0x${KEY}`;

if (!KEY || !/^0x[0-9a-fA-F]{64}$/.test(KEY)) {
  console.error('FUNDER_PRIVATE_KEY missing or not a 0x-prefixed 64-hex key (set it in .env, never commit it)');
  process.exit(1);
}
if (!/^0x[0-9a-fA-F]{40}$/.test(TO)) {
  console.error('FUND_TO must be the recipient address');
  process.exit(1);
}

const chain = defineChain({
  id: 4801,
  name: 'World Chain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  testnet: true,
});

const account = privateKeyToAccount(KEY);
const pub = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({ account, chain, transport: http() });

const balance = await pub.getBalance({ address: account.address });
console.log(`from ${account.address} balance ${formatEther(balance)} ETH -> sending ${AMOUNT} ETH to ${TO}`);
if (balance < parseEther(AMOUNT)) {
  console.error('funder balance too low');
  process.exit(1);
}

const hash = await wallet.sendTransaction({ to: TO, value: parseEther(AMOUNT) });
console.log(`tx ${hash}`);
console.log(`https://sepolia.worldscan.org/tx/${hash}`);
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log(`status ${receipt.status} block ${receipt.blockNumber}`);
