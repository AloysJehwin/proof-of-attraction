import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, font, radius } from '../../src/theme';
import { useApp } from '../../src/lib/store';
import { useAuth } from '../../src/auth/AuthContext';
import { TierBadge, AgentBadge } from '../../src/components/Badge';
import { Button, Divider } from '../../src/components/Button';
import { daysUntilExpiry, isSelfieValid } from '../../src/verification/tiers';
import { GENDER_ESTIMATE_DISCLAIMER } from '../../src/verification/genderEstimate';
import { pickFromLibrary, uploadPhoto } from '../../src/media/photo';

function declaredMatches(declared: string, label: string): boolean {
  if (label === 'androgynous') return true;
  if (declared === 'woman') return label === 'feminine';
  if (declared === 'man') return label === 'masculine';
  return true;
}

export default function Profile() {
  const { tier, selfieCredential, genderEstimate, agent, matches, profile, setTier, setSelfieCredential, setGenderEstimate, setProfile, updateAgent, refreshProfile, refreshMatches } = useApp();
  const { signOut: authSignOut } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const days = daysUntilExpiry(selfieCredential);
  const valid = isSelfieValid(selfieCredential);

  useFocusEffect(useCallback(() => { refreshProfile(); refreshMatches(); }, [refreshProfile, refreshMatches]));

  async function signOut() {
    await authSignOut();
    setTier('unverified');
    setSelfieCredential(null);
    setGenderEstimate(null);
    setProfile(null);
    updateAgent({ registered: false, walletAddress: null });
    router.replace('/');
  }

  async function changePhoto() {
    const picked = await pickFromLibrary();
    if (!picked) return;
    setUploading(true);
    setPhotoError(null);
    try {
      await uploadPhoto(picked);
      await refreshProfile();
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'photo upload failed');
    } finally {
      setUploading(false);
    }
  }

  const photo = profile?.photos[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <View style={styles.header}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.noPhoto]}><Text style={styles.noPhotoText}>No photo</Text></View>
        )}
        <Text style={styles.name}>
          {profile ? `${profile.name}, ${profile.age}` : 'Your profile'}
        </Text>
        <View style={styles.badges}>
          <TierBadge tier={tier} />
          {agent.registered && <AgentBadge />}
        </View>
        {profile && (
          <Button label={photo ? 'Change photo' : 'Add photo'} onPress={changePhoto} variant="secondary" loading={uploading} disabled={uploading} />
        )}
        {photoError && <Text style={styles.error}>{photoError}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Verification</Text>
        {tier === 'orb' && <Text style={styles.line}>Orb verified. Highest trust tier.</Text>}
        {tier === 'selfie' && selfieCredential && (
          <Text style={styles.line}>
            {valid ? `Selfie Check valid. ${days} days until re-verify.` : 'Selfie Check expired. Re-verify to keep messaging.'}
          </Text>
        )}
        {tier === 'selfie' && !selfieCredential && <Text style={styles.line}>Selfie verified.</Text>}
        {tier === 'unverified' && <Text style={styles.line}>Unverified. Verify to message and RSVP.</Text>}
        {tier !== 'orb' && (
          <Button label={tier === 'unverified' ? 'Verify now' : 'Re-verify Selfie Check'} onPress={() => router.push('/')} variant="secondary" />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gender (estimated)</Text>
        {genderEstimate ? (
          <>
            <Text style={styles.estimate}>{genderEstimate.label} ({Math.round(genderEstimate.confidence * 100)}%)</Text>
            {profile?.gender && genderEstimate.label !== 'unknown' && !declaredMatches(profile.gender, genderEstimate.label) && (
              <Text style={styles.line}>The estimate differs from what you declared. Only you can see this note.</Text>
            )}
          </>
        ) : (
          <Text style={styles.line}>No live selfie estimate yet.</Text>
        )}
        <Text style={styles.disclaimer}>{GENDER_ESTIMATE_DISCLAIMER}</Text>
        <Button label={genderEstimate ? 'Redo live selfie estimate' : 'Take live selfie estimate'} onPress={() => router.push('/gender-estimate')} variant="secondary" />
      </View>

      {profile && (profile.gender || profile.lookingFor) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gender (self-declared)</Text>
          {profile.gender && <Text style={styles.estimate}>{profile.gender}</Text>}
          {profile.lookingFor && <Text style={styles.line}>Looking for {profile.lookingFor}</Text>}
        </View>
      )}

      {profile && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bio</Text>
          <Text style={styles.line}>{profile.bio || 'No bio yet.'}</Text>
          {profile.interests.length > 0 && (
            <>
              <Divider />
              <View style={styles.chips}>
                {profile.interests.map((i) => (
                  <View key={i} style={styles.chip}><Text style={styles.chipText}>{i}</Text></View>
                ))}
              </View>
            </>
          )}
        </View>
      )}

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
  noPhoto: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { color: colors.textFaint, fontSize: font.size.xs },
  name: { color: colors.text, fontSize: font.size.lg, fontWeight: font.weight.bold },
  badges: { flexDirection: 'row', gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.bold },
  line: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
  estimate: { color: colors.text, fontSize: font.size.md, textTransform: 'capitalize' },
  disclaimer: { color: colors.textFaint, fontSize: font.size.xs, lineHeight: 18 },
  error: { color: colors.danger, fontSize: font.size.sm, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipText: { color: colors.textMuted, fontSize: font.size.xs },
});
