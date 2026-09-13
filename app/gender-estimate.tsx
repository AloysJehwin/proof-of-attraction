import { View, StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GenderEstimateCapture } from '../src/verification/GenderEstimateCapture';
import { useApp } from '../src/lib/store';
import { colors, spacing } from '../src/theme';

export default function GenderEstimateScreen() {
  const { setGenderEstimate, refreshProfile } = useApp();
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Live selfie estimate' }} />
      <View style={styles.body}>
        <GenderEstimateCapture
          onDone={async (estimate) => {
            setGenderEstimate(estimate);
            await refreshProfile();
            router.back();
          }}
          onSkip={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: spacing.md },
});
