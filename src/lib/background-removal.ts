/**
 * On-device background removal (iOS 17+ Vision / Android ML Kit).
 * Removal is an enhancement, never a gate: any failure returns null and the
 * caller keeps the original photo.
 */
export async function tryRemoveBackground(uri: string): Promise<string | null> {
  try {
    const { removeBackground } = await import('@six33/react-native-bg-removal');
    const result = await removeBackground(uri);
    return result || null;
  } catch {
    return null;
  }
}
