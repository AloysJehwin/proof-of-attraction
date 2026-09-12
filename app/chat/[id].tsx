import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { colors, spacing, font, radius } from '../../src/theme';
import { useApp } from '../../src/lib/store';
import { runSelfieCheck } from '../../src/verification/selfieCheck';
import { agentCall } from '../../src/agent/agentkit';
import { CURRENT_USER } from '../../src/lib/data';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const match = app.matches.find((m) => m.profile.id === id);

  const [draft, setDraft] = useState('');
  const [gating, setGating] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [topupNotice, setTopupNotice] = useState<string | null>(null);

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Match not found.</Text>
      </View>
    );
  }

  async function passSelfieGate() {
    setGating(true);
    const result = await runSelfieCheck({
      userId: CURRENT_USER.id,
      action: `first-message-${match!.profile.id}`,
      requireUserPresence: true,
    });
    setGating(false);
    if (result.ok) {
      if (result.credential) app.setSelfieCredential(result.credential);
      if (app.tier === 'unverified') app.setTier('selfie');
      app.unlockFirstMessage(match!.profile.id);
    }
  }

  function send(viaAgent?: boolean) {
    if (!draft.trim()) return;
    app.sendMessage(match!.profile.id, draft.trim(), viaAgent);
    setDraft('');
  }

  async function agentSuggest() {
    setAgentBusy(true);
    const ctx = await agentCall('context', {
      matchId: match!.profile.id,
      matchName: match!.profile.name,
      walletAddress: app.agent.walletAddress,
    });
    app.logAgentAction({
      kind: 'context',
      matchName: match!.profile.name,
      detail: ctx.payload ?? 'fetched context',
      verified: ctx.registered,
    });
    const ice = await agentCall('icebreaker', {
      matchId: match!.profile.id,
      matchName: match!.profile.name,
      walletAddress: app.agent.walletAddress,
    });
    setAgentBusy(false);
    if (ice.toppedUp?.ok) {
      setTopupNotice(`Agent topped up on-chain. Tx ${ice.toppedUp.hash?.slice(0, 10)}...`);
    } else if (ice.toppedUp && !ice.toppedUp.ok) {
      setTopupNotice(`Top-up failed: ${ice.toppedUp.error}`);
    }
    if (ice.ok && ice.payload) {
      setDraft(ice.payload);
      app.logAgentAction({
        kind: 'icebreaker',
        matchName: match!.profile.name,
        detail: ice.payload,
        verified: ice.registered,
      });
    }
  }

  const gated = !match.firstMessageUnlocked;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: match.profile.name }} />

      {match.profile.hasAgent && (
        <View style={styles.disclosure}>
          <Text style={styles.disclosureText}>
            This user has authorized an agent. Messages marked Agent are sent by a World ID verified human via AgentBook.
          </Text>
        </View>
      )}

      {topupNotice && (
        <View style={styles.disclosure}>
          <Text style={styles.disclosureText}>{topupNotice}</Text>
        </View>
      )}

      <ScrollView style={styles.thread} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
        {match.messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.from === 'me' ? styles.mine : styles.theirs]}>
            {m.viaAgent && <Text style={styles.agentTag}>Agent (verified human)</Text>}
            <Text style={styles.bubbleText}>{m.text}</Text>
          </View>
        ))}
        {match.messages.length === 0 && !gated && (
          <Text style={styles.hint}>Verified. Say something real.</Text>
        )}
      </ScrollView>

      {gated ? (
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Selfie Check required</Text>
          <Text style={styles.gateSub}>
            Confirm you are a live, real person before your first message. Prevents abuse and impersonation.
          </Text>
          <Pressable style={styles.gateBtn} onPress={passSelfieGate} disabled={gating}>
            {gating ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.gateBtnText}>Pass Selfie Check to message</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.composer}>
            {app.agent.registered && (
              <Pressable style={styles.agentBtn} onPress={agentSuggest} disabled={agentBusy}>
                {agentBusy ? (
                  <ActivityIndicator color={colors.agent} size="small" />
                ) : (
                  <Text style={styles.agentBtnText}>Agent</Text>
                )}
              </Pressable>
            )}
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message"
              placeholderTextColor={colors.textFaint}
              multiline
            />
            <Pressable style={styles.sendBtn} onPress={() => send(false)}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
          {draft.length > 0 && app.agent.registered && (
            <Pressable style={styles.sendViaAgent} onPress={() => send(true)}>
              <Text style={styles.sendViaAgentText}>Send via agent (disclosed to match)</Text>
            </Pressable>
          )}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { color: colors.textMuted },
  disclosure: { backgroundColor: colors.surfaceAlt, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  disclosureText: { color: colors.agent, fontSize: font.size.xs, lineHeight: 16 },
  thread: { flex: 1 },
  bubble: { maxWidth: '80%', padding: spacing.sm, borderRadius: radius.md },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceAlt },
  bubbleText: { color: colors.text, fontSize: font.size.md },
  agentTag: { color: colors.agent, fontSize: 10, fontWeight: font.weight.semibold, marginBottom: 2 },
  hint: { color: colors.textFaint, fontSize: font.size.sm, textAlign: 'center', marginTop: spacing.lg },
  gate: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  gateTitle: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.bold },
  gateSub: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
  gateBtn: { backgroundColor: colors.success, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  gateBtnText: { color: colors.bg, fontSize: font.size.md, fontWeight: font.weight.bold },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  agentBtn: { height: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.agent, alignItems: 'center', justifyContent: 'center' },
  agentBtnText: { color: colors.agent, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingTop: 12, color: colors.text, fontSize: font.size.md },
  sendBtn: { height: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.bg, fontWeight: font.weight.bold },
  sendViaAgent: { padding: spacing.sm, alignItems: 'center' },
  sendViaAgentText: { color: colors.agent, fontSize: font.size.xs },
});
