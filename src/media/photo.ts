import * as ImagePicker from 'expo-image-picker';
import { getToken } from '../auth/session';

const AGENT_API = process.env.EXPO_PUBLIC_AGENT_API ?? '';

export type PickedPhoto = { uri: string; mimeType: string };

export async function pickFromLibrary(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' };
}

export async function takePhoto(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' };
}

export async function uploadPhoto(photo: PickedPhoto): Promise<{ url: string; photos: string[] }> {
  const token = await getToken();
  const form = new FormData();
  const name = photo.mimeType.includes('png') ? 'photo.png' : 'photo.jpg';
  form.append('photo', { uri: photo.uri, name, type: photo.mimeType } as unknown as Blob);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${AGENT_API}/me/photo`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      let data: { url?: string; photos?: string[]; error?: string } = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        reject(new Error(`upload failed (${xhr.status})`));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300 || !data.url) {
        reject(new Error(data.error || `upload failed (${xhr.status})`));
        return;
      }
      resolve({ url: data.url, photos: data.photos ?? [data.url] });
    };
    xhr.onerror = () => reject(new Error('network error during upload'));
    xhr.ontimeout = () => reject(new Error('upload timed out'));
    xhr.timeout = 60_000;
    xhr.send(form);
  });
}
