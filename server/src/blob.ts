import { put } from '@vercel/blob';
import { s3Enabled, uploadPhoto as uploadToS3 } from './s3.js';

export const blobEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function storePhoto(userId: string, data: Buffer, contentType: string): Promise<string> {
  if (s3Enabled) {
    return uploadToS3(userId, data, contentType);
  }
  if (!blobEnabled) {
    const b64 = data.toString('base64');
    return `data:${contentType};base64,${b64}`;
  }
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const blob = await put(`avatars/${userId}-${Date.now()}.${ext}`, data, {
    access: 'public',
    addRandomSuffix: true,
    contentType,
  });
  return blob.url;
}
