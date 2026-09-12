import { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Divider } from '../src/components/Button';
import { colors, spacing, font, radius } from '../src/theme';
import { useApp } from '../src/lib/store';
import { runSelfieCheck } from '../src/verification/selfieCheck';
import { setToken } from '../src/auth/session';
import { CURRENT_USER } from '../src/lib/data';

export default function Onboarding() {
  const { setTier, setSelfieCredential, setGenderEstimate } = useApp();
  const [loading, setLoading] = useState<'selfie' | 'orb' | null>(null);

  async function verifySelfie() {
    setLoading('selfie');
    const result = await runSelfieCheck({ userId: CURRENT_USER.id, action: 'onboard' });
    setLoading(null);
    if (result.ok && result.credential) {
      if (result.token) await setToken(result.token);
      setSelfieCredential(result.credential);
      if (result.genderEstimate) setGenderEstimate(result.genderEstimate);
      setTier('selfie');
      router.replace('/(tabs)/discover');
    }
  }

  function verifyOrb() {
    setLoading('orb');
    setTimeout(() => {
      setTier('orb');
      setLoading(null);
      router.replace('/(tabs)/discover');
    }, 1200);
  }

  function skip() {
    setTier('unverified');
    router.replace('/(tabs)/discover');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Image source={{ uri: 'https://i.pravatar.cc/200?img=12' }} style={styles.avatar} />
        <Text style={styles.title}>Proof of Attraction</Text>
        <Text style={styles.subtitle}>
          Dating where every match is a verified human. Prove you are real, then meet others who did too.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Verify with Selfie Check"
          onPress={verifySelfie}
          loading={loading === 'selfie'}
          disabled={loading !== null}
        />
        <Text style={styles.hint}>Liveness and continuity. No Orb needed. Valid 90 days.</Text>

        <Divider />

        <Button
          label="Verify with Orb (World ID)"
          onPress={verifyOrb}
          variant="secondary"
          loading={loading === 'orb'}
          disabled={loading !== null}
        />
        <Text style={styles.hint}>Highest trust. Unique anonymous human.</Text>

        <Button label="Explore unverified" onPress={skip} variant="ghost" disabled={loading !== null} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between', padding: spacing.lg },
  hero: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.md },
  avatar: { width: 96, height: 96, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.accent },
  title: { color: colors.text, fontSize: font.size.xl, fontWeight: font.weight.bold },
  subtitle: {
    color: colors.textMuted,
    fontSize: font.size.md,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  actions: { gap: spacing.sm, paddingBottom: spacing.lg },
  hint: { color: colors.textFaint, fontSize: font.size.xs, textAlign: 'center', marginBottom: spacing.sm },
});
