import React from 'react';
import { PrivyProvider } from '@privy-io/expo';
import { worldChainSepolia } from './chain';

const APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '';
const CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '';

export const WALLET_ENABLED = APP_ID.length > 0;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  if (!WALLET_ENABLED) return <>{children}</>;
  return (
    <PrivyProvider appId={APP_ID} clientId={CLIENT_ID || undefined} supportedChains={[worldChainSepolia]}>
      {children}
    </PrivyProvider>
  );
}
