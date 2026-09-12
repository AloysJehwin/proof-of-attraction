import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Switch } from 'react-native';
import { colors, spacing, font, radius } from '../../src/theme';
import { useApp, DISCOVERY_DECK } from '../../src/lib/store';
import { TierBadge, AgentBadge } from '../../src/components/Badge';
import { meetsTier } from '../../src/verification/tiers';

export default function Discover() {
  const { verifiedOnly, setVerifiedOnly, addMatch } = useApp();
  const [index, setIndex] = useState(0);

  const deck = useMemo(
    () => (verifiedOnly ? DISCOVERY_DECK.filter((p) => meetsTier(p.tier, 'selfie')) : DISCOVERY_DECK),
    [verifiedOnly]
  );

  const current = deck[index];

  function pass() {
    setIndex((i) => Math.min(i + 1, deck.length));
  }

  function like() {
    if (current) addMatch(current);
    setIndex((i) => Math.min(i + 1, deck.length));
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Verified humans only</Text>
        <Switch
          value={verifiedOnly}
          onValueChange={(v) => {
            setVerifiedOnly(v);
            setIndex(0);
          }}
          trackColor={{ true: colors.accentMuted, false: colors.border }}
          thumbColor={verifiedOnly ? colors.accent : colors.textFaint}
        />
      </View>

      {current ? (
        <View style={styles.card}>
          <Image source={{ uri: current.photo }} style={styles.photo} />
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {current.name}, {current.age}
              </Text>
              <Text style={styles.distance}>{current.distanceKm} km</Text>
            </View>
            <View style={styles.badgeRow}>
              <TierBadge tier={current.tier} />
              {current.hasAgent && <AgentBadge />}
            </View>
            <Text style={styles.bio}>{current.bio}</Text>
            <View style={styles.chips}>
              {current.interests.map((i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{i}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No more profiles.</Text>
          <Text style={styles.emptySub}>
            {verifiedOnly ? 'Try turning off the verified filter.' : 'Check back later.'}
          </Text>
        </View>
      )}

      {current && (
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, styles.pass]} onPress={pass}>
            <Text style={styles.passText}>Pass</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.like]} onPress={like}>
            <Text style={styles.likeText}>Like</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  filterLabel: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: font.weight.medium },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photo: { width: '100%', height: '58%' },
  cardBody: { padding: spacing.md, gap: spacing.sm },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { color: colors.text, fontSize: font.size.lg, fontWeight: font.weight.bold },
  distance: { color: colors.textFaint, fontSize: font.size.sm },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  bio: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
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
