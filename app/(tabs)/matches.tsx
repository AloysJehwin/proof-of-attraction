import { View, Text, StyleSheet, Image, Pressable, FlatList } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, font, radius } from '../../src/theme';
import { useApp } from '../../src/lib/store';
import { TierBadge } from '../../src/components/Badge';

export default function Matches() {
  const { matches } = useApp();

  if (matches.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No matches yet</Text>
        <Text style={styles.emptySub}>Like someone in Discover to start.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md }}
      data={matches}
      keyExtractor={(m) => m.profile.id}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => {
        const last = item.messages[item.messages.length - 1];
        return (
          <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.profile.id}`)}>
            <Image source={{ uri: item.profile.photo }} style={styles.avatar} />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.name}>{item.profile.name}</Text>
                <TierBadge tier={item.profile.tier} small />
              </View>
              <Text style={styles.preview} numberOfLines={1}>
                {last
                  ? `${last.viaAgent ? 'Agent: ' : ''}${last.text}`
                  : item.firstMessageUnlocked
                    ? 'Say hi'
                    : 'Selfie Check required to message'}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  avatar: { width: 56, height: 56, borderRadius: radius.pill },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.semibold },
  preview: { color: colors.textMuted, fontSize: font.size.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.bg },
  emptyText: { color: colors.text, fontSize: font.size.lg, fontWeight: font.weight.semibold },
  emptySub: { color: colors.textFaint, fontSize: font.size.sm },
});
