import { ProfileSchema, type Profile, type ProfileUpdate } from '@shared/types';

import { supabase } from '@/lib/supabase';

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return ProfileSchema.parse(data);
}

export async function updateProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return ProfileSchema.parse(data);
}
