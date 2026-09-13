import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = process.env.S3_BUCKET ?? '';
const REGION = process.env.S3_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? '';
const SECRET = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const MARKER = 's3://';
const GET_TTL_SECONDS = 60 * 60 * 12;

export const s3Enabled = Boolean(BUCKET && KEY_ID && SECRET);

const client = s3Enabled
  ? new S3Client({ region: REGION, credentials: { accessKeyId: KEY_ID, secretAccessKey: SECRET } })
  : null;

export function isS3Ref(value: string): boolean {
  return value.startsWith(MARKER);
}

export async function uploadPhoto(userId: string, data: Buffer, contentType: string): Promise<string> {
  if (!client) throw new Error('s3 not configured');
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const key = `avatars/${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: data, ContentType: contentType }));
  return `${MARKER}${key}`;
}

export async function presignRef(ref: string): Promise<string> {
  if (!client || !isS3Ref(ref)) return ref;
  const key = ref.slice(MARKER.length);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: GET_TTL_SECONDS });
}

export async function presignAll(photos: string[]): Promise<string[]> {
  if (!client) return photos;
  return Promise.all(photos.map((p) => presignRef(p)));
}
