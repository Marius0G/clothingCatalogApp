import Constants from 'expo-constants';

import i18n from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export async function submitFeedback(userId: string, message: string): Promise<void> {
  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    message,
    locale: i18n.language === 'ro' ? 'ro' : 'en',
    app_version: Constants.expoConfig?.version ?? null,
  });
  if (error) throw error;
}
