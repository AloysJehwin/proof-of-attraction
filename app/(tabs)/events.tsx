import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, font, radius } from '../../src/theme';
import { useApp } from '../../src/lib/store';
import { runSelfieCheck } from '../../src/verification/selfieCheck';
import { SELF_USER_ID } from '../../src/lib/data';
import { rsvp as apiRsvp, cancelRsvp as apiCancel } from '../../src/api';

export default function Events() {
  const { events, refreshEvents, tier, setTier, setSelfieCredential } = useApp();
  const [pending, setPending] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { refreshEvents(); }, [refreshEvents]));

  async function toggle(eventId: string, going: boolean) {
    setPending(eventId);
    if (going) {
      await apiCancel(eventId).catch(() => undefined);
      await refreshEvents();
      setPending(null);
      return;
    }
    if (tier === 'unverified') {
      const result = await runSelfieCheck({ userId: SELF_USER_ID, action: `rsvp-${eventId}`, requireUserPresence: true });
      if (result.ok) {
        if (result.credential) setSelfieCredential(result.credential);
        setTier('selfie');
      } else {
        setPending(null);
        return;
      }
    }
    await apiRsvp(eventId).catch(() => undefined);
    await refreshEvents();
    setPending(null);
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      data={events}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={<Text style={styles.header}>RSVP requires Selfie Check so every seat is a real, unique human.</Text>}
      renderItem={({ item }) => {
        const full = item.attendees >= item.capacity && !item.going;
        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.date}>{item.startsAt}</Text>
            </View>
            <Text style={styles.venue}>{item.venue}</Text>
            <Text style={styles.capacity}>{item.attendees} / {item.capacity} going</Text>
            <Pressable
              style={[styles.rsvpBtn, item.going ? styles.going : full ? styles.full : styles.open]}
              onPress={() => !full && toggle(item.id, item.going)}
              disabled={full || pending === item.id}
            >
              {pending === item.id ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={[styles.rsvpText, item.going && styles.goingText]}>
                  {item.going ? 'Going, tap to cancel' : full ? 'Full' : 'RSVP with Selfie Check'}
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
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 6 },
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
