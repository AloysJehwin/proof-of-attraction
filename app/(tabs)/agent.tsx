import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator } from 'react-native';
import { colors, spacing, font, radius } from '../../src/theme';
import { useApp } from '../../src/lib/store';
import { Button } from '../../src/components/Button';
import { WORLD_CHAIN } from '../../src/agent/agentkit';

const STYLES: Array<'warm' | 'witty' | 'direct'> = ['warm', 'witty', 'direct'];

export default function AgentScreen() {
  const { agent, updateAgent, agentLog, revokeAgentAction } = useApp();
  const [registering, setRegistering] = useState(false);

  function register() {
    setRegistering(true);
    setTimeout(() => {
      updateAgent({
        registered: true,
        walletAddress: '0x' + Math.random().toString(16).slice(2, 10) + '...a9f2',
      });
      setRegistering(false);
    }, 1500);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your agent</Text>
        {agent.registered ? (
          <>
            <Text style={styles.status}>Registered in AgentBook</Text>
            <Text style={styles.mono}>{agent.walletAddress}</Text>
            <Text style={styles.chain}>Resolves on World Chain {WORLD_CHAIN}</Text>
          </>
        ) : (
          <>
            <Text style={styles.desc}>
              Register a human-backed agent. It acts in your chats and its every action is verified against
              AgentBook so matches know a real, unique human is behind it.
            </Text>
            <Button label="Register agent" onPress={register} variant="agent" loading={registering} />
          </>
        )}
      </View>

      {agent.registered && (
        <>
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
            <Text style={styles.cardTitle}>Action log</Text>
            <Text style={styles.desc}>Every verified agent call. Revoke any action.</Text>
            {agentLog.length === 0 ? (
              <Text style={styles.empty}>No actions yet. Open a chat and tap Agent.</Text>
            ) : (
              agentLog.map((a) => (
                <View key={a.id} style={styles.logRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logKind}>
                      {a.kind} to {a.matchName} {a.verified ? '(verified)' : '(unverified)'}
                    </Text>
                    <Text style={styles.logDetail} numberOfLines={1}>
                      {a.detail}
                    </Text>
                  </View>
                  <Pressable onPress={() => revokeAgentAction(a.id)}>
                    <Text style={styles.revoke}>Revoke</Text>
                  </Pressable>
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
  styleRow: { flexDirection: 'row', gap: spacing.sm },
  stylePill: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  stylePillActive: { backgroundColor: colors.agent, borderColor: colors.agent },
  stylePillText: { color: colors.textMuted, fontSize: font.size.sm, textTransform: 'capitalize' },
  stylePillTextActive: { color: colors.bg, fontWeight: font.weight.bold },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: colors.text, fontSize: font.size.sm },
  empty: { color: colors.textFaint, fontSize: font.size.sm },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  logKind: { color: colors.text, fontSize: font.size.sm, fontWeight: font.weight.medium, textTransform: 'capitalize' },
  logDetail: { color: colors.textFaint, fontSize: font.size.xs },
  revoke: { color: colors.danger, fontSize: font.size.sm, fontWeight: font.weight.semibold },
});
