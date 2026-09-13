import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '../components/Button';
import { colors, spacing, font, radius } from '../theme';
import { getGenderChallenge, submitGenderEstimate } from '../api';
import { GenderEstimate, GENDER_ESTIMATE_DISCLAIMER } from './genderEstimate';

type Phase = 'permission' | 'neutral' | 'challenge' | 'submitting' | 'done' | 'failed';

type Props = {
  onDone: (estimate: GenderEstimate) => void;
  onSkip?: () => void;
};

export function GenderEstimateCapture({ onDone, onSkip }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView | null>(null);
  const [phase, setPhase] = useState<Phase>('permission');
  const [challenge, setChallenge] = useState<string>('');
  const [frames, setFrames] = useState<string[]>([]);
  const [result, setResult] = useState<GenderEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (permission?.granted) setPhase((p) => (p === 'permission' ? 'neutral' : p));
  }, [permission]);

  useEffect(() => {
    getGenderChallenge().then(setChallenge).catch(() => setChallenge('turn your head to the left'));
  }, []);

  async function pickSmallPictureSize() {
    if (pictureSize) return;
    try {
      const sizes = await camera.current?.getAvailablePictureSizesAsync();
      if (!sizes?.length) return;
      const parsed = sizes
        .map((label) => {
          const nums = label.match(/\d+/g)?.map(Number) ?? [];
          return { label, area: nums.length >= 2 ? nums[0] * nums[1] : Number.MAX_SAFE_INTEGER, min: nums.length >= 2 ? Math.min(nums[0], nums[1]) : 0 };
        })
        .filter((x) => x.min >= 480)
        .sort((a, b) => a.area - b.area);
      if (parsed[0]) setPictureSize(parsed[0].label);
    } catch {}
  }

  async function capture() {
    if (!camera.current || capturing) return;
    setCapturing(true);
    setError(null);
    try {
      let quality = 0.3;
      let shot = await camera.current.takePictureAsync({ base64: true, quality, imageType: 'jpg', skipProcessing: true });
      // shrink until the base64 frame is comfortably under Vercel's ~4.5MB request cap (two frames + overhead)
      while (shot?.base64 && shot.base64.length > 900_000 && quality > 0.05) {
        quality = Math.max(0.05, quality - 0.1);
        shot = await camera.current.takePictureAsync({ base64: true, quality, imageType: 'jpg', skipProcessing: true });
      }
      if (!shot?.base64) throw new Error('no image captured');
      if (shot.base64.length > 1_600_000) throw new Error('camera frames are too large on this device; tap Skip and set it later');
      const frame = `data:image/jpeg;base64,${shot.base64}`;
      const next = [...frames, frame];
      setFrames(next);
      if (next.length === 1) {
        setPhase('challenge');
      } else {
        setPhase('submitting');
        const res = await submitGenderEstimate(next, challenge);
        if (res.ok) {
          setResult(res.estimate);
          setPhase('done');
        } else {
          setError(res.reason);
          setPhase('failed');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'capture failed');
      setPhase('failed');
    } finally {
      setCapturing(false);
    }
  }

  function retry() {
    setFrames([]);
    setResult(null);
    setError(null);
    setPhase('neutral');
    getGenderChallenge().then(setChallenge).catch(() => undefined);
  }

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Live selfie estimate</Text>
        <Text style={styles.sub}>
          We take two quick front-camera frames to confirm a live person and estimate gender presentation. Gallery photos are not accepted.
        </Text>
        <Button label="Allow camera" onPress={() => requestPermission()} />
        {onSkip && <Button label="Skip for now" onPress={onSkip} variant="ghost" />}
      </View>
    );
  }

  if (phase === 'done' && result) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Estimate recorded</Text>
        <Text style={styles.big}>{result.label}</Text>
        <Text style={styles.sub}>Confidence {Math.round(result.confidence * 100)}%. {GENDER_ESTIMATE_DISCLAIMER}</Text>
        <Button label="Continue" onPress={() => onDone(result)} />
        <Button label="Redo" onPress={retry} variant="ghost" />
      </View>
    );
  }

  if (phase === 'failed') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Could not complete the check</Text>
        <Text style={styles.error}>{error}</Text>
        <Button label="Try again" onPress={retry} />
        {onSkip && <Button label="Skip for now" onPress={onSkip} variant="ghost" />}
      </View>
    );
  }

  const instruction = phase === 'neutral' ? 'Look straight at the camera' : `Now ${challenge}`;

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrap}>
        <CameraView ref={camera} style={styles.camera} facing="front" mirror pictureSize={pictureSize} onCameraReady={pickSmallPictureSize} />
        <View style={styles.overlay}>
          <Text style={styles.step}>Frame {Math.min(frames.length + 1, 2)} of 2</Text>
          <Text style={styles.instruction}>{instruction}</Text>
        </View>
      </View>
      {phase === 'submitting' ? (
        <View style={styles.row}><ActivityIndicator color={colors.accent} /><Text style={styles.sub}>Checking liveness and estimating...</Text></View>
      ) : (
        <Button label={phase === 'neutral' ? 'Capture' : 'Capture challenge frame'} onPress={capture} loading={capturing} disabled={capturing} />
      )}
      <Text style={styles.disclaimer}>{GENDER_ESTIMATE_DISCLAIMER}</Text>
      {onSkip && phase !== 'submitting' && <Button label="Skip for now" onPress={onSkip} variant="ghost" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.md },
  center: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.md },
  cameraWrap: { flex: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt, minHeight: 360 },
  camera: { flex: 1 },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, backgroundColor: 'rgba(0,0,0,0.55)', gap: 4 },
  step: { color: colors.textFaint, fontSize: font.size.xs },
  instruction: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.bold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
  title: { color: colors.text, fontSize: font.size.xl, fontWeight: font.weight.bold, textAlign: 'center' },
  big: { color: colors.accent, fontSize: font.size.xl, fontWeight: font.weight.bold, textAlign: 'center', textTransform: 'capitalize' },
  sub: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20, textAlign: 'center' },
  disclaimer: { color: colors.textFaint, fontSize: font.size.xs, lineHeight: 16, textAlign: 'center' },
  error: { color: colors.danger, fontSize: font.size.sm, textAlign: 'center' },
});
