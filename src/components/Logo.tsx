import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { colors, brand, font, spacing } from '../theme';

export function Logo({ size = 96, withWordmark = false }: { size?: number; withWordmark?: boolean }) {
  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Defs>
          <LinearGradient id="poaRing" x1="160" y1="160" x2="864" y2="864" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={brand.gradientFrom} />
            <Stop offset="1" stopColor={brand.gradientTo} />
          </LinearGradient>
          <RadialGradient id="poaSpark" cx="512" cy="512" r="230" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={brand.sparkCore} />
            <Stop offset="0.35" stopColor={brand.sparkMid} />
            <Stop offset="1" stopColor={brand.sparkEdge} />
          </RadialGradient>
          <RadialGradient id="poaGlow" cx="512" cy="512" r="300" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={brand.gradientFrom} stopOpacity="0.35" />
            <Stop offset="1" stopColor={brand.gradientFrom} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="512" cy="512" r="300" fill="url(#poaGlow)" />
        <Circle
          cx="512"
          cy="512"
          r="360"
          fill="none"
          stroke="url(#poaRing)"
          strokeWidth="34"
          strokeLinecap="round"
          strokeDasharray="1035 66"
          transform="rotate(-90 512 512)"
        />
        <Circle
          cx="512"
          cy="512"
          r="292"
          fill="none"
          stroke="url(#poaRing)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray="360 130"
          strokeOpacity="0.55"
          transform="rotate(60 512 512)"
        />
        <Path
          d="M512 300 C540 452 572 484 724 512 C572 540 540 572 512 724 C484 572 452 540 300 512 C452 484 484 452 512 300 Z"
          fill="url(#poaSpark)"
        />
      </Svg>
      {withWordmark && (
        <View style={styles.wordmark}>
          <Text style={styles.name}>Proof of Attraction</Text>
          <Text style={styles.tagline}>Verified humans only</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm },
  wordmark: { alignItems: 'center', gap: 2 },
  name: { color: colors.text, fontSize: font.size.xl, fontWeight: font.weight.bold, letterSpacing: 0.3 },
  tagline: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: font.weight.medium },
});
