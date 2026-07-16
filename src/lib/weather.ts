/**
 * Auto-weather for outfit recommendations: coarse GPS position → Open-Meteo
 * (free, keyless) → one of the engine's weather buckets. Location is optional
 * and used only here; everything degrades to the manual weather chips.
 */
import type { Weather } from '@shared/types';

export function weatherFromTemperature(tempC: number): Weather {
  if (tempC >= 24) return 'hot';
  if (tempC >= 15) return 'mild';
  if (tempC >= 8) return 'cool';
  return 'cold';
}

async function fetchWeatherAt(latitude: number, longitude: number): Promise<Weather | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(2)}&longitude=${longitude.toFixed(2)}&current=temperature_2m`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const temp = json?.current?.temperature_2m;
    return typeof temp === 'number' ? weatherFromTemperature(temp) : null;
  } catch {
    return null;
  }
}

/** True when location permission is already granted (never prompts). */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    // Lazy import: dev clients built before expo-location was added would
    // crash on a top-level import of the native module.
    const Location = await import('expo-location');
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Prompts the OS permission dialog. Returns whether it was granted. */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const Location = await import('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Current weather bucket at the device's coarse position, or null when
 * location/network is unavailable. Assumes permission was already granted.
 */
export async function detectCurrentWeather(): Promise<Weather | null> {
  try {
    const Location = await import('expo-location');
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!position) return null;
    return fetchWeatherAt(position.coords.latitude, position.coords.longitude);
  } catch {
    return null;
  }
}
