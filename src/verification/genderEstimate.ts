export type GenderLabel = 'feminine' | 'masculine' | 'androgynous' | 'unknown';

export type GenderEstimate = {
  label: GenderLabel;
  confidence: number;
  source: 'vision-estimate' | 'ml-estimate';
  challenge?: string;
  estimatedAt: number;
};

export const GENDER_ESTIMATE_DISCLAIMER =
  'Estimated by a third-party vision model from a live selfie. Not verified by World and not identity data.';
