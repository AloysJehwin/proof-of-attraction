import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../src/lib/store';
import { WalletProvider, WALLET_ENABLED } from '../src/wallet/provider';
import { useWallet } from '../src/wallet/useWallet';
import { colors } from '../src/theme';

function WalletBridge() {
  useWallet();
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <WalletProvider>
          <AppProvider>
            {WALLET_ENABLED ? <WalletBridge /> : null}
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
            </Stack>
          </AppProvider>
        </WalletProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
