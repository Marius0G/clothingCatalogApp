import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Best-effort push registration. Requires an EAS projectId + FCM credentials
 * (see SETUP.md); until those exist this quietly no-ops so the rest of the
 * alerts pipeline (outbox + in-app) still works.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (!Device.isDevice && Platform.OS === 'ios') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return; // no EAS project yet — skip silently

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from('push_tokens').upsert({
      user_id: userId,
      expo_token: token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      device_name: Device.modelName,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // push is optional in dev — never block the app on it
  }
}
