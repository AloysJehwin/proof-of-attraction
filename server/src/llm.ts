import OpenAI from 'openai';
import type { ProfileRow } from './repo/types.js';

const API_KEY = process.env.LLM_API_KEY ?? '';
const BASE_URL = process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1';
const MODEL = process.env.LLM_MODEL ?? 'openai/gpt-oss-20b';
const VISION_MODEL = process.env.LLM_VISION_MODEL ?? 'qwen/qwen3.6-27b';

export const llmEnabled = API_KEY.length > 0;

const client = llmEnabled ? new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL }) : null;

export type MiniProfile = Pick<ProfileRow, 'name' | 'age' | 'bio' | 'interests'>;

export function sharedInterests(a: string[], b: string[]): string[] {
  const sb = new Set(b.map((x) => x.toLowerCase().trim()));
  return a.filter((x) => sb.has(x.toLowerCase().trim()));
}

async function complete(system: string, user: string, maxTokens: number): Promise<string | null> {
  if (!client) return null;
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.8,
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    } as Parameters<typeof client.chat.completions.create>[0]);
    const text = (res as { choices: Array<{ message?: { content?: string | null } }> }).choices[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

export async function generateIcebreaker(self: MiniProfile, other: MiniProfile, style: string): Promise<string | null> {
  const shared = sharedInterests(self.interests ?? [], other.interests ?? []);
  const system = 'You write a single short first message for a dating app. One sentence, no emojis, no quotes, under 160 characters. Be warm and specific.';
  const user = `My interests: ${(self.interests ?? []).join(', ') || 'none listed'}. Their name: ${other.name}. Their bio: ${other.bio || 'none'}. Their interests: ${(other.interests ?? []).join(', ') || 'none listed'}. Shared interests: ${shared.join(', ') || 'none'}. Style: ${style}.`;
  return complete(system, user, 512);
}

export async function generateContext(self: MiniProfile, other: MiniProfile): Promise<string | null> {
  const shared = sharedInterests(self.interests ?? [], other.interests ?? []);
  const system = 'You summarize why two dating app users might connect. One sentence, no emojis, no quotes, under 160 characters.';
  const user = `User A interests: ${(self.interests ?? []).join(', ') || 'none'}. User B name: ${other.name}, interests: ${(other.interests ?? []).join(', ') || 'none'}. Shared: ${shared.join(', ') || 'none'}.`;
  return complete(system, user, 512);
}

export type MiniMessage = { fromSelf: boolean; body: string };

export async function generateReply(self: MiniProfile, other: MiniProfile, history: MiniMessage[], style: string): Promise<string | null> {
  const transcript = history.slice(-8).map((m) => `${m.fromSelf ? 'Me' : other.name}: ${m.body}`).join('\n');
  const system = 'You draft the next message in a dating app chat on behalf of "Me". One or two sentences, no emojis, no quotes, under 200 characters. Continue the conversation naturally and ask something back.';
  const user = `My interests: ${(self.interests ?? []).join(', ') || 'none'}. Their name: ${other.name}, bio: ${other.bio || 'none'}, interests: ${(other.interests ?? []).join(', ') || 'none'}. Style: ${style}.\n\nConversation so far:\n${transcript}`;
  return complete(system, user, 512);
}

export type MatchSignals = { matchScore?: number; distanceKm?: number | null };

export async function generateTake(self: MiniProfile, other: MiniProfile, signals: MatchSignals): Promise<string | null> {
  const shared = sharedInterests(self.interests ?? [], other.interests ?? []);
  const system = 'You are a dating assistant pre-screening a profile for your user. Give a one-sentence verdict on compatibility and one concrete thing to ask about. No emojis, no quotes, under 200 characters.';
  const user = `My interests: ${(self.interests ?? []).join(', ') || 'none'}. Candidate: ${other.name}, ${other.age}, bio: ${other.bio || 'none'}, interests: ${(other.interests ?? []).join(', ') || 'none'}. Shared: ${shared.join(', ') || 'none'}. Computed match score: ${signals.matchScore != null ? Math.round(signals.matchScore * 100) + '%' : 'unknown'}.`;
  return complete(system, user, 512);
}

export type GenderLabel = 'feminine' | 'masculine' | 'androgynous' | 'unknown';

export type LiveGenderResult = {
  live: boolean;
  samePerson: boolean;
  challengePassed: boolean;
  label: GenderLabel;
  confidence: number;
  reason: string;
};

const LABELS: GenderLabel[] = ['feminine', 'masculine', 'androgynous', 'unknown'];

export async function estimateGenderFromFrames(frames: string[], challenge: string): Promise<LiveGenderResult | null> {
  if (!client) return null;
  const system =
    'You are a liveness and presentation-estimate checker for a dating app. You receive two selfie frames taken seconds apart from a live front camera. ' +
    'Frame 1 is the neutral pose; frame 2 should show the requested challenge. Decide: (1) live: are these real live camera captures of a person, not a photo of a screen, printout, or a picture of a picture; ' +
    '(2) samePerson: same individual in both frames; (3) challengePassed: frame 2 performs the challenge; (4) label: apparent gender presentation as one of feminine, masculine, androgynous, unknown, with confidence 0-1. ' +
    'This is an appearance estimate only, never identity. Respond with JSON only: {"live":bool,"samePerson":bool,"challengePassed":bool,"label":string,"confidence":number,"reason":string}.';
  try {
    const res = await client.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: 300,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Challenge requested for frame 2: ${challenge}.` },
            ...frames.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          ],
        },
      ],
    } as Parameters<typeof client.chat.completions.create>[0]);
    const text = (res as { choices: Array<{ message?: { content?: string | null } }> }).choices[0]?.message?.content?.trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as Partial<LiveGenderResult>;
    const label = LABELS.includes(parsed.label as GenderLabel) ? (parsed.label as GenderLabel) : 'unknown';
    return {
      live: Boolean(parsed.live),
      samePerson: Boolean(parsed.samePerson),
      challengePassed: Boolean(parsed.challengePassed),
      label,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : '',
    };
  } catch {
    return null;
  }
}
