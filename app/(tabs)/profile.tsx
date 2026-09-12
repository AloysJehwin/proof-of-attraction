import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, font, radius } from '../../src/theme';
import { useApp } from '../../src/lib/store';
import { TierBadge, AgentBadge } from '../../src/components/Badge';
import { Button, Divider } from '../../src/components/Button';
import { CURRENT_USER } from '../../src/lib/data';
import { daysUntilExpiry, isSelfieValid } from '../../src/verification/tiers';

export default function Profile() {
  const { tier, selfieCredential, agent, matches, setTier, setSelfieCredential } = useApp();
  const days = daysUntilExpiry(selfieCredential);
  const valid = isSelfieValid(selfieCredential);

  function signOut() {
    setTier('unverified');
    setSelfieCredential(null);
    router.replace('/');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <View style={styles.header}>
        <Image source={{ uri: CURRENT_USER.photo }} style={styles.avatar} />
        <Text style={styles.name}>
          {CURRENT_USER.name === 'You' ? 'You' : CURRENT_USER.name}, {CURRENT_USER.age}
        </Text>
        <View style={styles.badges}>
          <TierBadge tier={tier} />
          {agent.registered && <AgentBadge />}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Verification</Text>
        {tier === 'orb' && <Text style={styles.line}>Orb verified. Highest trust tier.</Text>}
        {tier === 'selfie' && selfieCredential && (
          <Text style={styles.line}>
            {valid
              ? `Selfie Check valid. ${days} days until re-verify.`
              : 'Selfie Check expired. Re-verify to keep messaging.'}
          </Text>
        )}
        {tier === 'unverified' && (
          <Text style={styles.line}>Unverified. Verify to message and RSVP.</Text>
        )}
        {tier !== 'orb' && (
          <Button
            label={tier === 'unverified' ? 'Verify now' : 'Re-verify Selfie Check'}
            onPress={() => router.push('/')}
            variant="secondary"
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bio</Text>
        <Text style={styles.line}>{CURRENT_USER.bio}</Text>
        <Divider />
        <View style={styles.chips}>
          {CURRENT_USER.interests.map((i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{i}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Activity</Text>
        <Text style={styles.line}>{matches.length} matches</Text>
      </View>

      <Button label="Sign out" onPress={signOut} variant="ghost" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  avatar: { width: 96, height: 96, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.accent },
  name: { color: colors.text, fontSize: font.size.lg, fontWeight: font.weight.bold },
  badges: { flexDirection: 'row', gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.bold },
  line: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipText: { color: colors.textMuted, fontSize: font.size.xs },
});
