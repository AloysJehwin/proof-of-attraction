import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { colors, spacing, font, radius } from '../../src/theme';
import { useApp } from '../../src/lib/store';
import { EVENTS } from '../../src/lib/data';
import { runSelfieCheck } from '../../src/verification/selfieCheck';
import { CURRENT_USER } from '../../src/lib/data';

export default function Events() {
  const { rsvpEvents, toggleRsvp, setSelfieCredential, tier, setTier } = useApp();
  const [pending, setPending] = useState<string | null>(null);

  async function rsvp(eventId: string) {
    if (rsvpEvents.includes(eventId)) {
      toggleRsvp(eventId);
      return;
    }
    setPending(eventId);
    const result = await runSelfieCheck({
      userId: CURRENT_USER.id,
      action: `rsvp-${eventId}`,
      requireUserPresence: true,
    });
    setPending(null);
    if (result.ok) {
      if (result.credential) setSelfieCredential(result.credential);
      if (tier === 'unverified') setTier('selfie');
      toggleRsvp(eventId);
    }
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      data={EVENTS}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        <Text style={styles.header}>RSVP requires Selfie Check so every seat is a real, unique human.</Text>
      }
      renderItem={({ item }) => {
        const going = rsvpEvents.includes(item.id);
        const full = item.attendees >= item.capacity && !going;
        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.date}>{item.date}</Text>
            </View>
            <Text style={styles.venue}>{item.venue}</Text>
            <Text style={styles.capacity}>
              {item.attendees + (going ? 1 : 0)} / {item.capacity} going
            </Text>
            <Pressable
              style={[styles.rsvpBtn, going ? styles.going : full ? styles.full : styles.open]}
              onPress={() => !full && rsvp(item.id)}
              disabled={full || pending === item.id}
            >
              {pending === item.id ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={[styles.rsvpText, going && styles.goingText]}>
                  {going ? 'Going, tap to cancel' : full ? 'Full' : 'RSVP with Selfie Check'}
                </Text>
              )}
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.bold, flex: 1 },
  date: { color: colors.accent, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  venue: { color: colors.textMuted, fontSize: font.size.sm },
  capacity: { color: colors.textFaint, fontSize: font.size.xs, marginBottom: spacing.sm },
  rsvpBtn: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  open: { backgroundColor: colors.success },
  going: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  full: { backgroundColor: colors.surfaceAlt },
  rsvpText: { color: colors.bg, fontSize: font.size.sm, fontWeight: font.weight.bold },
  goingText: { color: colors.textMuted },
});
