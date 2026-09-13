import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TextInput, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Divider } from '../src/components/Button';
import { Logo } from '../src/components/Logo';
import { colors, spacing, font, radius } from '../src/theme';
import { useApp } from '../src/lib/store';
import { useAuth } from '../src/auth/AuthContext';
import { runSelfieCheck, SELFIE_CHECK_ENABLED, WORLD_ID_ENABLED, createWorldSession, getStoredWorldSession, lookupWorldSession, loginWithWorldSession } from '../src/verification/selfieCheck';
import { SELF_USER_ID } from '../src/lib/data';
import { getMe, saveProfile, saveHandle } from '../src/api';
import { pickFromLibrary, uploadPhoto, PickedPhoto } from '../src/media/photo';
import { registerForPush } from '../src/push/register';
import { captureLocation } from '../src/media/location';
import { GenderEstimateCapture } from '../src/verification/GenderEstimateCapture';

type Step = 'verify' | 'blocked' | 'login' | 'gender' | 'handle' | 'profile';

const GENDER_OPTIONS = ['woman', 'man', 'nonbinary', 'other'];
const LOOKING_OPTIONS = ['women', 'men', 'everyone'];
const WORLD_ID_ACTION = process.env.EXPO_PUBLIC_WORLD_ID_ACTION ?? 'onboard4';

export default function Onboarding() {
  const { status, me } = useAuth();
  const [step, setStep] = useState<Step>('verify');

  useEffect(() => {
    console.log('[onboarding] auth', status, 'tier', me?.user?.tier, 'hasProfile', me?.hasProfile, 'handle', me?.user?.handle, 'estimate', Boolean(me?.user?.genderEstimate));
    if (status !== 'signed-in' || me?.user?.tier !== 'orb') return;
    if (me.hasProfile) {
      router.replace('/(tabs)/discover');
      return;
    }
    setStep(!me.user?.genderEstimate && SELFIE_CHECK_ENABLED ? 'gender' : !me.user?.handle ? 'handle' : 'profile');
  }, [status, me]);

  if (status === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <OnboardingForm step={step} setStep={setStep} />;
}

function OnboardingForm({ step, setStep }: { step: Step; setStep: (s: Step) => void }) {
  const { signIn, me } = useAuth();
  const { setSelfieCredential, setGenderEstimate, setTier, setProfile, refreshProfile } = useApp();
  const [loading, setLoading] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [lookingFor, setLookingFor] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [handle, setHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingHandle, setPendingHandle] = useState(!me?.user?.handle);
  const [loginHandle, setLoginHandle] = useState('');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  async function verify() {
    setLoading(true);
    setError(null);
    const result = await runSelfieCheck({ userId: SELF_USER_ID, action: WORLD_ID_ACTION });
    if (!result.ok || !result.credential) {
      setLoading(false);
      if (result.code === 'already_registered') {
        setError('This World ID already has an account. Logging you in instead...');
        await login();
        return;
      }
      setError(result.error ?? 'verification failed');
      return;
    }
    const tier = result.tier ?? 'selfie';
    if (result.token) await signIn(result.token);
    setSelfieCredential(result.credential);
    setTier(tier);

    if (tier !== 'orb') {
      setLoading(false);
      setStep('blocked');
      return;
    }

    if (WORLD_ID_ENABLED) {
      setSessionNotice('Approve once more in the World App to enable one-tap login next time.');
      const session = await createWorldSession();
      setSessionNotice(session.ok ? null : `Login session not created (${session.error}). You can still log in with your handle.`);
    }

    registerForPush().catch(() => undefined);
    const me = SELFIE_CHECK_ENABLED ? await getMe().catch(() => null) : null;
    setLoading(false);
    if (me?.hasProfile) {
      setProfile(me.profile);
      router.replace('/(tabs)/discover');
      return;
    }
    setPendingHandle(Boolean(result.firstUse || !me?.user?.handle));
    if (SELFIE_CHECK_ENABLED && !me?.user?.genderEstimate) {
      setStep('gender');
    } else {
      setStep(result.firstUse || !me?.user?.handle ? 'handle' : 'profile');
    }
  }

  async function login() {
    setError(null);
    if (WORLD_ID_ENABLED) {
      const stored = await getStoredWorldSession();
      if (stored) {
        await loginWithSession(stored);
      } else {
        setStep('login');
      }
      return;
    }
    setLoggingIn(true);
    const result = await runSelfieCheck({ userId: SELF_USER_ID, action: WORLD_ID_ACTION });
    if (!result.ok || !result.credential) {
      setLoggingIn(false);
      setError(result.error ?? 'verification failed');
      return;
    }
    await finishLogin(result);
  }

  async function loginWithHandle() {
    const h = loginHandle.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) {
      setError('Enter the handle you chose at sign-up.');
      return;
    }
    setLoggingIn(true);
    setError(null);
    const found = await lookupWorldSession(h);
    if (!found.ok || !found.sessionId) {
      setLoggingIn(false);
      setError(found.error ?? 'no account found');
      return;
    }
    await loginWithSession(found.sessionId);
  }

  async function loginWithSession(sessionId: string) {
    setLoggingIn(true);
    setError(null);
    const result = await loginWithWorldSession(sessionId);
    if (!result.ok || !result.credential) {
      setLoggingIn(false);
      setError(result.error ?? 'login failed');
      if (step !== 'login') setStep('login');
      return;
    }
    await finishLogin(result);
  }

  async function finishLogin(result: Awaited<ReturnType<typeof runSelfieCheck>>) {
    if (!result.credential) return;
    const tier = result.tier ?? 'selfie';
    if (result.token) await signIn(result.token);
    setSelfieCredential(result.credential);
    setTier(tier);

    if (tier !== 'orb') {
      setLoggingIn(false);
      setStep('blocked');
      return;
    }

    const current = SELFIE_CHECK_ENABLED ? await getMe().catch(() => null) : null;
    setLoggingIn(false);
    registerForPush().catch(() => undefined);
    if (current?.hasProfile) {
      setProfile(current.profile);
      router.replace('/(tabs)/discover');
      return;
    }
    setPendingHandle(!current?.user?.handle);
    setError(null);
    if (SELFIE_CHECK_ENABLED && !current?.user?.genderEstimate) setStep('gender');
    else setStep(current?.user?.handle ? 'profile' : 'handle');
  }

  async function submitHandle() {
    const h = handle.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) {
      setError('Handle must be 3-20 chars: a-z, 0-9, underscore');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveHandle(h);
      setStep('profile');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not set handle');
    } finally {
      setSaving(false);
    }
  }

  async function useLocation() {
    setLocating(true);
    setError(null);
    const loc = await captureLocation();
    setLocating(false);
    if (loc) setCoords(loc);
    else setError('Location unavailable. You can continue without it.');
  }

  async function pickPhoto() {
    const picked = await pickFromLibrary();
    if (picked) setPhoto(picked);
  }

  async function submitProfile() {
    const ageNum = parseInt(age, 10);
    if (!name.trim() || !ageNum) {
      setError('Name and age are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const list = interests.split(',').map((s) => s.trim()).filter(Boolean);
      await saveProfile({
        name: name.trim(),
        age: ageNum,
        bio: bio.trim(),
        interests: list,
        gender: gender ?? undefined,
        lookingFor: lookingFor ?? undefined,
        lat: coords?.lat,
        lng: coords?.lng,
      });
      let photoError: string | null = null;
      if (photo) {
        await uploadPhoto(photo).catch((e) => {
          photoError = e instanceof Error ? e.message : 'photo upload failed';
        });
      }
      await refreshProfile();
      if (photoError) {
        setError(`Profile saved, but the photo failed to upload: ${photoError}. You can add it from your Profile tab.`);
        return;
      }
      router.replace('/(tabs)/discover');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not save profile');
    } finally {
      setSaving(false);
    }
  }

  if (step === 'blocked') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.hero}>
          <Logo size={104} />
          <Text style={styles.title}>Orb verification required</Text>
          <Text style={styles.subtitle}>
            Proof of Attraction is Orb-only. You verified as a real human, but this app admits Orb-verified
            humans only. Verify with the Orb in the World App, then return here.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button label="Verify with Orb" onPress={verify} loading={loading} disabled={loading} />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <Text style={styles.title}>Log in with World ID</Text>
          <Text style={styles.subtitle}>Enter your handle, then approve the login in the World App. No new verification is needed.</Text>
          <TextInput
            style={styles.input}
            placeholder="your handle"
            placeholderTextColor={colors.textFaint}
            value={loginHandle}
            onChangeText={setLoginHandle}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Continue in World App" onPress={loginWithHandle} loading={loggingIn} disabled={loggingIn} />
          <Button label="Back" onPress={() => { setError(null); setStep('verify'); }} variant="ghost" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'gender') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, gap: spacing.md }}>
          <Text style={styles.title}>Live selfie estimate</Text>
          <Text style={styles.subtitle}>A quick two-frame front-camera check. It confirms a live person and records an estimated gender presentation, shown on your profile as an estimate.</Text>
          <GenderEstimateCapture
            onDone={(estimate) => { setGenderEstimate(estimate); setStep(pendingHandle ? 'handle' : 'profile'); }}
            onSkip={() => setStep(pendingHandle ? 'handle' : 'profile')}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'handle') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <Text style={styles.title}>Choose your handle</Text>
          <Text style={styles.subtitle}>This is your unique name on Proof of Attraction. You cannot share it with anyone else.</Text>
          <TextInput
            style={styles.input}
            placeholder="handle"
            placeholderTextColor={colors.textFaint}
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>3-20 characters, lowercase letters, numbers, underscores.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Continue" onPress={submitHandle} loading={saving} disabled={saving} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'profile') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <Text style={styles.title}>Build your profile</Text>
          <Text style={styles.subtitle}>This is what verified humans see when they discover you.</Text>

          <View style={styles.photoRow}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
            ) : (
              <View style={[styles.photoPreview, styles.photoPlaceholder]}>
                <Text style={styles.photoPlaceholderText}>No photo</Text>
              </View>
            )}
            <Button label={photo ? 'Change photo' : 'Add photo'} onPress={pickPhoto} variant="secondary" />
          </View>

          <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.textFaint} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Age" placeholderTextColor={colors.textFaint} value={age} onChangeText={setAge} keyboardType="number-pad" />
          <TextInput style={[styles.input, styles.multiline]} placeholder="Bio" placeholderTextColor={colors.textFaint} value={bio} onChangeText={setBio} multiline />
          <TextInput style={styles.input} placeholder="Interests, comma separated" placeholderTextColor={colors.textFaint} value={interests} onChangeText={setInterests} />

          <Text style={styles.label}>Gender (self-declared)</Text>
          <View style={styles.chips}>
            {GENDER_OPTIONS.map((g) => (
              <Chip key={g} label={g} selected={gender === g} onPress={() => setGender(g)} />
            ))}
          </View>

          <Text style={styles.label}>Looking for</Text>
          <View style={styles.chips}>
            {LOOKING_OPTIONS.map((l) => (
              <Chip key={l} label={l} selected={lookingFor === l} onPress={() => setLookingFor(l)} />
            ))}
          </View>

          <Text style={styles.label}>Location</Text>
          <Button
            label={coords ? `Location set (${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)})` : 'Use my location'}
            onPress={useLocation}
            variant="secondary"
            loading={locating}
            disabled={locating}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Save and start" onPress={submitProfile} loading={saving} disabled={saving} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Logo size={104} />
        <Text style={styles.title}>Proof of Attraction</Text>
        <Text style={styles.subtitle}>
          Dating where every match is an Orb-verified human. Prove you are real and unique, then meet others who did too.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Verify with World ID" onPress={verify} loading={loading} disabled={loading || loggingIn} />
        <Text style={styles.hint}>New here? Orb verification required. Open the World App to prove you are a unique human.</Text>
        <Button label="Log in with World ID" onPress={login} loading={loggingIn} disabled={loading || loggingIn} variant="secondary" />
        <Text style={styles.hint}>Already verified? Log back into your account.</Text>
        {sessionNotice && <Text style={styles.hint}>{sessionNotice}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between', padding: spacing.lg },
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.md },
  title: { color: colors.text, fontSize: font.size.xl, fontWeight: font.weight.bold },
  subtitle: { color: colors.textMuted, fontSize: font.size.md, textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.md },
  actions: { gap: spacing.sm, paddingBottom: spacing.lg },
  hint: { color: colors.textFaint, fontSize: font.size.xs, textAlign: 'center', marginBottom: spacing.sm },
  label: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: font.weight.bold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: font.size.sm },
  chipTextSelected: { color: '#fff', fontWeight: font.weight.bold },
  photoRow: { alignItems: 'center', gap: spacing.sm },
  photoPreview: { width: 120, height: 120, borderRadius: radius.pill },
  photoPlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  photoPlaceholderText: { color: colors.textFaint, fontSize: font.size.xs },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: font.size.md },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: font.size.sm, textAlign: 'center' },
});
