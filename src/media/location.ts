export type Coords = { lat: number; lng: number };

export async function captureLocation(): Promise<Coords | null> {
  let Location: any;
  try {
    Location = require('expo-location');
  } catch {
    return null;
  }
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({});
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
