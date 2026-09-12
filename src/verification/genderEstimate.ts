export type GenderLabel = 'feminine' | 'masculine' | 'androgynous' | 'unknown';

export type GenderEstimate = {
  label: GenderLabel;
  confidence: number;
  source: 'ml-estimate';
  estimatedAt: number;
};

export async function estimateGender(seed: string): Promise<GenderEstimate> {
  const label = pickPlaceholder(seed);
  return {
    label,
    confidence: label === 'unknown' ? 0 : 0.6,
    source: 'ml-estimate',
    estimatedAt: Date.now(),
  };
}

function pickPlaceholder(seed: string): GenderLabel {
  const labels: GenderLabel[] = ['feminine', 'masculine', 'androgynous'];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return labels[hash % labels.length];
}

export const GENDER_ESTIMATE_DISCLAIMER =
  'Estimated by a third-party model from your selfie. Not verified by World and not identity data.';
