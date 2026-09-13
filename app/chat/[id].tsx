import { useEffect, useMemo, useRef, useState } from 'react';
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
import { SELF_USER_ID } from '../../src/lib/data';
import { useMatchChannel } from '../../src/realtime/ably';
import { sendMessage as apiSend, ApiMessage } from '../../src/api';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const match = app.matches.find((m) => m.matchId === id);
  const { messages, live, loaded, appendLocal } = useMatchChannel(id);

  const [draft, setDraft] = useState('');
  const [gating, setGating] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [topupNotice, setTopupNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const autoRan = useRef<string | null>(null);

  const canMessage = app.tier !== 'unverified';
  const selfId = app.profile?.userId;

  const ordered = useMemo(() => messages, [messages]);

  if (!match) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Chat' }} />
        <Text style={styles.muted}>Match not found.</Text>
      </View>
    );
  }

  async function passSelfieGate() {
    setGating(true);
    const result = await runSelfieCheck({ userId: SELF_USER_ID, action: `first-message-${id}`, requireUserPresence: true });
    setGating(false);
    if (result.ok) {
      if (result.credential) app.setSelfieCredential(result.credential);
      if (app.tier === 'unverified') app.setTier('selfie');
      await app.refreshProfile();
    }
  }

  const canUseAgent = app.agent.registered;

  useEffect(() => {
    if (!match || !loaded || !canUseAgent || !app.agent.autoSuggest) return;
    if (messages.length > 0 || autoRan.current === match.matchId) return;
    autoRan.current = match.matchId;
    setSuggesting(true);
    agentCall('icebreaker', { matchId: match.matchId, matchName: match.other.name, walletAddress: app.agent.walletAddress, style: app.agent.icebreakerStyle })
      .then((res) => {
        if (res.ok && res.payload) setSuggestion(res.payload);
        app.refreshAgentLog();
      })
      .finally(() => setSuggesting(false));
  }, [match, loaded, messages.length, canUseAgent, app.agent.autoSuggest]);

  async function send(viaAgent?: boolean, override?: string) {
    const text = (override ?? draft).trim();
    if (!text || !id || !match) return;
    setDraft('');
    setSuggestion(null);
    setError(null);
    try {
      if (viaAgent) {
        const res = await agentCall('send', { matchId: id, matchName: match.other.name, walletAddress: app.agent.walletAddress, body: text });
        if (!res.ok || !res.message) throw new Error(res.error ?? 'agent could not send');
        if (!live) appendLocal(res.message);
        if (res.toppedUp?.ok) setTopupNotice(`Agent topped up on-chain. Tx ${res.toppedUp.hash?.slice(0, 10)}...`);
        app.refreshAgentLog();
      } else {
        const message = await apiSend(id, text, false);
        if (!live) appendLocal(message);
      }
      app.refreshMatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not send');
      setDraft(text);
    }
  }

  async function agentDraft() {
    if (!match) return;
    setAgentBusy(true);
    const kind = messages.length > 0 ? 'reply' : 'icebreaker';
    const res = await agentCall(kind, { matchId: match.matchId, matchName: match.other.name, walletAddress: app.agent.walletAddress, style: app.agent.icebreakerStyle });
    setAgentBusy(false);
    if (res.toppedUp?.ok) setTopupNotice(`Agent topped up on-chain. Tx ${res.toppedUp.hash?.slice(0, 10)}...`);
    else if (res.toppedUp && !res.toppedUp.ok) setTopupNotice(`Top-up failed: ${res.toppedUp.error}`);
    if (res.ok && res.payload) setDraft(res.payload);
    else if (res.error) setError(res.error);
    app.refreshAgentLog();
  }

  function isMine(m: ApiMessage): boolean {
    return selfId ? m.senderUser === selfId : false;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: match.other.name }} />

      {match.other.hasAgent && (
        <View style={styles.disclosure}>
          <Text style={styles.disclosureText}>
            This user has authorized an agent. Messages marked Agent are sent by a World ID verified human via AgentBook.
          </Text>
        </View>
      )}

      {topupNotice && (
        <View style={styles.disclosure}><Text style={styles.disclosureText}>{topupNotice}</Text></View>
      )}

      <ScrollView style={styles.thread} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
        {ordered.map((m) => (
          <View key={m.id} style={[styles.bubble, isMine(m) ? styles.mine : styles.theirs]}>
            {m.viaAgent && <Text style={styles.agentTag}>Agent (verified human)</Text>}
            <Text style={styles.bubbleText}>{m.body}</Text>
          </View>
        ))}
        {ordered.length === 0 && canMessage && !suggestion && !suggesting && <Text style={styles.hint}>Verified. Say something real.</Text>}
        {suggesting && <Text style={styles.hint}>Your agent is drafting an opener...</Text>}
        {suggestion && (
          <View style={styles.suggestion}>
            <Text style={styles.suggestionLabel}>Agent suggests (AgentBook verified)</Text>
            <Text style={styles.suggestionText}>{suggestion}</Text>
            <View style={styles.suggestionRow}>
              <Pressable style={styles.suggestionBtn} onPress={() => send(true, suggestion)}><Text style={styles.suggestionBtnText}>Send via agent</Text></Pressable>
              <Pressable style={styles.suggestionGhost} onPress={() => { setDraft(suggestion); setSuggestion(null); }}><Text style={styles.suggestionGhostText}>Edit</Text></Pressable>
              <Pressable style={styles.suggestionGhost} onPress={() => setSuggestion(null)}><Text style={styles.suggestionGhostText}>Dismiss</Text></Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {!canMessage ? (
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Selfie Check required</Text>
          <Text style={styles.gateSub}>Confirm you are a live, real person before your first message. Prevents abuse and impersonation.</Text>
          <Pressable style={styles.gateBtn} onPress={passSelfieGate} disabled={gating}>
            {gating ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.gateBtnText}>Pass Selfie Check to message</Text>}
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.composer}>
            {app.agent.registered && (
              <Pressable style={styles.agentBtn} onPress={agentDraft} disabled={agentBusy}>
                {agentBusy ? <ActivityIndicator color={colors.agent} size="small" /> : <Text style={styles.agentBtnText}>Agent</Text>}
              </Pressable>
            )}
            <TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder="Message" placeholderTextColor={colors.textFaint} multiline />
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
  error: { color: colors.danger, fontSize: font.size.xs, textAlign: 'center', paddingHorizontal: spacing.md },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  agentBtn: { height: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.agent, alignItems: 'center', justifyContent: 'center' },
  agentBtnText: { color: colors.agent, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingTop: 12, color: colors.text, fontSize: font.size.md },
  sendBtn: { height: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.bg, fontWeight: font.weight.bold },
  sendViaAgent: { padding: spacing.sm, alignItems: 'center' },
  sendViaAgentText: { color: colors.agent, fontSize: font.size.xs },
  suggestion: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.agent, marginTop: spacing.md },
  suggestionLabel: { color: colors.agent, fontSize: font.size.xs, fontWeight: font.weight.semibold },
  suggestionText: { color: colors.text, fontSize: font.size.md, lineHeight: 22 },
  suggestionRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  suggestionBtn: { backgroundColor: colors.agent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  suggestionBtnText: { color: colors.bg, fontSize: font.size.sm, fontWeight: font.weight.bold },
  suggestionGhost: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  suggestionGhostText: { color: colors.textMuted, fontSize: font.size.sm },
});
