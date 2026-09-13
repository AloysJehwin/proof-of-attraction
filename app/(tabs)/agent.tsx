import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Linking, TextInput } from 'react-native';
import { colors, spacing, font, radius } from '../../src/theme';
import { useApp } from '../../src/lib/store';
import { Button } from '../../src/components/Button';
import { WORLD_CHAIN, agentDiagnostics } from '../../src/agent/agentkit';
import { saveWallet } from '../../src/api';
import { useWallet } from '../../src/wallet/useWallet';
import { TOPUP_ETH } from '../../src/wallet/chain';
import { topUpAgent, creditTopUpFromTx, TopUpResult } from '../../src/wallet/topup';
import { TOPUP_ADDRESS } from '../../src/wallet/chain';

const STYLES: Array<'warm' | 'witty' | 'direct'> = ['warm', 'witty', 'direct'];

const KIND_LABEL: Record<string, string> = { screen: 'Pre-screened a profile', context: 'Read match context', icebreaker: 'Drafted an opener', reply: 'Drafted a reply', send: 'Sent a message' };

export default function AgentScreen() {
  const { agent, updateAgent, agentLog, agentUsage, refreshAgentLog, revokeAgentAction } = useApp();
  useFocusEffect(useCallback(() => { refreshAgentLog(); }, [refreshAgentLog]));
  const wallet = useWallet();
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [toppingUp, setToppingUp] = useState(false);
  const [topUp, setTopUp] = useState<TopUpResult | null>(null);
  const [txHash, setTxHash] = useState('');
  const [crediting, setCrediting] = useState(false);
  const [credit, setCredit] = useState<TopUpResult | null>(null);

  async function register() {
    setRegisterError(null);
    if (!wallet.enabled) {
      setRegisterError('No wallet available. Set EXPO_PUBLIC_PRIVY_APP_ID to enable the wallet.');
      return;
    }
    if (wallet.error) {
      setRegisterError(`Wallet setup failed: ${wallet.error}`);
      return;
    }
    if (!wallet.address) {
      setRegisterError('Wallet is still provisioning. Try again in a moment.');
      return;
    }
    setRegistering(true);
    try {
      await saveWallet(wallet.address);
      updateAgent({ registered: true, walletAddress: wallet.address });
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : 'could not register agent');
    } finally {
      setRegistering(false);
    }
  }

  async function creditFromHash() {
    setCrediting(true);
    setCredit(null);
    const result = await creditTopUpFromTx(txHash);
    setCredit(result);
    setCrediting(false);
    if (result.ok) {
      setTxHash('');
      refreshAgentLog();
    }
  }

  async function runTopUp() {
    setToppingUp(true);
    setTopUp(null);
    const result = await topUpAgent();
    setTopUp(result);
    setToppingUp(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your agent</Text>
        {agent.registered ? (
          <>
            <Text style={styles.status}>Registered in AgentBook</Text>
            <Text style={styles.mono}>{agent.walletAddress}</Text>
            <Text style={styles.chain}>Resolves on World Chain {WORLD_CHAIN}. Linked to your World ID, restored on every login.</Text>
            {wallet.address && agent.walletAddress && wallet.address.toLowerCase() !== agent.walletAddress.toLowerCase() && (
              <>
                <Text style={styles.error}>This device's wallet differs from the linked agent wallet. Re-link to use the agent here.</Text>
                <Button label="Re-link this device's wallet" onPress={register} variant="secondary" loading={registering} disabled={registering} />
                {registerError && <Text style={styles.error}>{registerError}</Text>}
              </>
            )}
          </>
        ) : (
          <>
            <Text style={styles.desc}>
              Register a human-backed agent. It acts in your chats and its every action is verified against
              AgentBook so matches know a real, unique human is behind it.
            </Text>
            {wallet.enabled && (
              <Text style={styles.chain}>
                {wallet.address ? `Wallet ${wallet.address}` : wallet.busy ? 'Provisioning wallet...' : 'Wallet not provisioned'}
              </Text>
            )}
            <Button label="Register agent" onPress={register} variant="agent" loading={registering} disabled={registering} />
            {wallet.error && (
              <>
                <Text style={styles.error}>Wallet setup failed: {wallet.error}</Text>
                <Button label="Retry wallet setup" onPress={wallet.retry} variant="secondary" loading={wallet.busy} disabled={wallet.busy} />
              </>
            )}
            {registerError && !wallet.error && <Text style={styles.error}>{registerError}</Text>}
          </>
        )}
      </View>

      {agent.registered && (
        <>
          {wallet.enabled && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Agent wallet</Text>
              <Text style={styles.mono}>{wallet.address ?? 'provisioning...'}</Text>
              <Text style={styles.desc}>
                When the free trial runs out, the agent settles a {TOPUP_ETH} ETH top-up on World Chain Sepolia
                to continue. Fund this wallet from the testnet faucet.
              </Text>
              <Button label="Top up agent" onPress={runTopUp} loading={toppingUp} disabled={toppingUp || !wallet.ready} />
              {topUp && topUp.ok && (
                <>
                  <Text style={styles.status}>Credited {topUp.credited} calls</Text>
                  {topUp.explorerUrl && (
                    <Pressable onPress={() => Linking.openURL(topUp.explorerUrl!)}>
                      <Text style={styles.link}>View transaction</Text>
                    </Pressable>
                  )}
                </>
              )}
              {topUp && !topUp.ok && (
                <>
                  <Text style={styles.error}>{topUp.error ?? 'top-up failed'}</Text>
                  {topUp.hash && (
                    <>
                      <Text style={styles.chain}>Payment sent: {topUp.hash}</Text>
                      <Button label="Retry crediting this payment" onPress={() => { setTxHash(topUp.hash!); creditFromHash(); }} variant="secondary" loading={crediting} disabled={crediting} />
                    </>
                  )}
                </>
              )}

              <Text style={styles.cardTitle}>Paid from another wallet?</Text>
              <Text style={styles.desc}>
                Send at least {TOPUP_ETH} ETH on World Chain Sepolia to {TOPUP_ADDRESS} from any wallet, then paste the transaction hash to credit your agent.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="0x transaction hash"
                placeholderTextColor={colors.textFaint}
                value={txHash}
                onChangeText={setTxHash}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button label="Credit from transaction" onPress={creditFromHash} variant="secondary" loading={crediting} disabled={crediting || txHash.trim().length === 0} />
              {credit && credit.ok && <Text style={styles.status}>Credited {credit.credited} calls</Text>}
              {credit && !credit.ok && <Text style={styles.error}>{credit.error}</Text>}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Icebreaker style</Text>
            <View style={styles.styleRow}>
              {STYLES.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.stylePill, agent.icebreakerStyle === s && styles.stylePillActive]}
                  onPress={() => updateAgent({ icebreakerStyle: s })}
                >
                  <Text style={[styles.stylePillText, agent.icebreakerStyle === s && styles.stylePillTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Auto-suggest openers</Text>
              <Switch
                value={agent.autoSuggest}
                onValueChange={(v) => updateAgent({ autoSuggest: v })}
                trackColor={{ true: colors.agent, false: colors.border }}
                thumbColor={colors.text}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Continuity quota</Text>
            {agentUsage ? (
              <>
                <Text style={styles.status}>{agentUsage.remaining} calls remaining</Text>
                <Text style={styles.desc}>
                  {agentUsage.used} used of {agentUsage.freeTrial} free trial calls plus {agentUsage.credit} credited on-chain. The quota is
                  tied to your World ID, so it follows you across devices and agents.
                </Text>
              </>
            ) : (
              <Text style={styles.empty}>Loading quota...</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Action log</Text>
            <Text style={styles.desc}>Every call your agent made through the AgentKit-protected backend. Revoke any action.</Text>
            {(() => {
              const d = agentDiagnostics();
              if (!d.gate && !d.headerError) return null;
              return (
                <Text style={styles.chain}>
                  Last call: {d.gate ?? 'unknown'}{d.headerError ? ` (client could not sign header: ${d.headerError})` : ''}
                </Text>
              );
            })()}
            {agentLog.length === 0 ? (
              <Text style={styles.empty}>No actions yet. Ask the agent in Discover or a chat.</Text>
            ) : (
              agentLog.map((a) => (
                <View key={a.id} style={[styles.logRow, a.revoked && styles.logRevoked]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logKind}>
                      {KIND_LABEL[a.kind] ?? a.kind} {a.agentBacked ? '(AgentBook verified)' : '(fallback gate)'}
                    </Text>
                    <Text style={styles.logDetail} numberOfLines={2}>{a.detail}</Text>
                  </View>
                  {a.revoked ? (
                    <Text style={styles.revoked}>Revoked</Text>
                  ) : (
                    <Pressable onPress={() => revokeAgentAction(a.id)}>
                      <Text style={styles.revoke}>Revoke</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.bold },
  desc: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
  status: { color: colors.agent, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  mono: { color: colors.text, fontSize: font.size.sm, fontFamily: 'monospace' },
  chain: { color: colors.textFaint, fontSize: font.size.xs },
  link: { color: colors.accent, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  error: { color: colors.danger, fontSize: font.size.sm },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: font.size.sm, fontFamily: 'monospace' },
  styleRow: { flexDirection: 'row', gap: spacing.sm },
  stylePill: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  stylePillActive: { backgroundColor: colors.agent, borderColor: colors.agent },
  stylePillText: { color: colors.textMuted, fontSize: font.size.sm, textTransform: 'capitalize' },
  stylePillTextActive: { color: colors.bg, fontWeight: font.weight.bold },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: colors.text, fontSize: font.size.sm },
  empty: { color: colors.textFaint, fontSize: font.size.sm },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  logKind: { color: colors.text, fontSize: font.size.sm, fontWeight: font.weight.medium },
  logDetail: { color: colors.textFaint, fontSize: font.size.xs },
  revoke: { color: colors.danger, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  revoked: { color: colors.textFaint, fontSize: font.size.sm },
  logRevoked: { opacity: 0.5 },
});
