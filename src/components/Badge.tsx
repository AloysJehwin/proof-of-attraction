import { Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing, font, tierColors } from '../theme';
import { VerificationTier, TIER_LABEL } from '../verification/tiers';

export function TierBadge({ tier, small }: { tier: VerificationTier; small?: boolean }) {
  const color = tierColors[tier];
  return (
    <View style={[styles.badge, { borderColor: color }, small && styles.badgeSmall]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }, small && styles.badgeTextSmall]}>
        {TIER_LABEL[tier]}
      </Text>
    </View>
  );
}

export function AgentBadge({ small }: { small?: boolean }) {
  return (
    <View style={[styles.badge, { borderColor: colors.agent }, small && styles.badgeSmall]}>
      <Text style={[styles.badgeText, { color: colors.agent }, small && styles.badgeTextSmall]}>
        Agent enabled
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 6,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
  badgeTextSmall: { fontSize: 10 },
});
