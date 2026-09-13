import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Switch, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, font, radius } from '../../src/theme';
import { useApp } from '../../src/lib/store';
import { TierBadge, AgentBadge } from '../../src/components/Badge';
import { ApiProfile, getDiscovery, like } from '../../src/api';
import { agentCall } from '../../src/agent/agentkit';

export default function Discover() {
  const { verifiedOnly, setVerifiedOnly, refreshMatches, agent, refreshAgentLog } = useApp();
  const [take, setTake] = useState<{ userId: string; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [deck, setDeck] = useState<ApiProfile[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchName, setMatchName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const profiles = await getDiscovery(verifiedOnly).catch(() => []);
    setDeck(profiles);
    setIndex(0);
    setLoading(false);
  }, [verifiedOnly]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const current = deck[index];

  function advance() {
    setIndex((i) => Math.min(i + 1, deck.length));
  }

  async function askAgent() {
    if (!current || asking) return;
    setAsking(true);
    const res = await agentCall('context', { userId: current.userId, matchName: current.name, walletAddress: agent.walletAddress, style: agent.icebreakerStyle });
    setAsking(false);
    setTake({ userId: current.userId, text: res.payload ?? res.error ?? 'No take available.' });
    refreshAgentLog();
  }

  async function act(kind: 'like' | 'pass') {
    if (!current) return;
    const target = current;
    advance();
    if (kind === 'like') {
      const res = await like(target.userId, 'like').catch(() => ({ matched: false }));
      if (res.matched) {
        setMatchName(target.name);
        refreshMatches();
      }
    } else {
      like(target.userId, 'pass').catch(() => undefined);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Verified humans only</Text>
        <Switch
          value={verifiedOnly}
          onValueChange={setVerifiedOnly}
          trackColor={{ true: colors.accentMuted, false: colors.border }}
          thumbColor={verifiedOnly ? colors.accent : colors.textFaint}
        />
      </View>

      {matchName && (
        <Pressable style={styles.matchBanner} onPress={() => setMatchName(null)}>
          <Text style={styles.matchText}>It is a match with {matchName}. Tap to keep swiping.</Text>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.empty}><ActivityIndicator color={colors.accent} /></View>
      ) : current ? (
        <View style={styles.card}>
          {current.photos[0] ? (
            <Image source={{ uri: current.photos[0] }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.noPhoto]}><Text style={styles.noPhotoText}>No photo</Text></View>
          )}
          <ScrollView style={styles.cardScroll} contentContainerStyle={styles.cardBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.name}>{current.name}, {current.age}</Text>
            {typeof current.matchScore === 'number' && (
              <Text style={styles.match}>{Math.round(current.matchScore * 100)}% match</Text>
            )}
            <View style={styles.badgeRow}>
              <TierBadge tier={current.tier} />
              {current.hasAgent && <AgentBadge />}
            </View>
            <Text style={styles.bio}>{current.bio}</Text>
            {agent.registered && (
              take?.userId === current.userId ? (
                <View style={styles.take}>
                  <Text style={styles.takeLabel}>Agent take</Text>
                  <Text style={styles.takeText}>{take.text}</Text>
                </View>
              ) : (
                <Pressable style={styles.askBtn} onPress={askAgent} disabled={asking}>
                  {asking ? <ActivityIndicator color={colors.agent} size="small" /> : <Text style={styles.askText}>Ask my agent about {current.name}</Text>}
                </Pressable>
              )
            )}
            <View style={styles.chips}>
              {current.interests.map((i) => (
                <View key={i} style={styles.chip}><Text style={styles.chipText}>{i}</Text></View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No more profiles.</Text>
          <Text style={styles.emptySub}>{verifiedOnly ? 'Try turning off the verified filter.' : 'Check back later.'}</Text>
        </View>
      )}

      {!loading && current && (
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, styles.pass]} onPress={() => act('pass')}>
            <Text style={styles.passText}>Pass</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.like]} onPress={() => act('like')}>
            <Text style={styles.likeText}>Like</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  filterLabel: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: font.weight.medium },
  matchBanner: { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  matchText: { color: colors.bg, fontSize: font.size.sm, fontWeight: font.weight.bold, textAlign: 'center' },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  photo: { width: '100%', height: 300 },
  cardScroll: { flex: 1 },
  noPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  noPhotoText: { color: colors.textFaint },
  cardBody: { padding: spacing.md, gap: spacing.sm },
  name: { color: colors.text, fontSize: font.size.lg, fontWeight: font.weight.bold },
  match: { color: colors.accent, fontSize: font.size.sm, fontWeight: font.weight.bold, marginTop: spacing.xs },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  bio: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  askBtn: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.agent },
  askText: { color: colors.agent, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  take: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, gap: 2, borderLeftWidth: 3, borderLeftColor: colors.agent },
  takeLabel: { color: colors.agent, fontSize: font.size.xs, fontWeight: font.weight.semibold },
  takeText: { color: colors.text, fontSize: font.size.sm, lineHeight: 20 },
  chip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipText: { color: colors.textMuted, fontSize: font.size.xs },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  actionBtn: { flex: 1, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pass: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  like: { backgroundColor: colors.accent },
  passText: { color: colors.textMuted, fontSize: font.size.md, fontWeight: font.weight.semibold },
  likeText: { color: colors.bg, fontSize: font.size.md, fontWeight: font.weight.bold },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { color: colors.text, fontSize: font.size.lg, fontWeight: font.weight.semibold },
  emptySub: { color: colors.textFaint, fontSize: font.size.sm },
});
