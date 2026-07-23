import { supabase } from '@/lib/supabase';

/** Thrown when the user dismissed a social sign-in dialog — not an error to display. */
export class SignInCancelled extends Error {}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // With email confirmation enabled, no session is returned until the link is opened.
  return { needsEmailConfirmation: !data.session };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Requires a recent session; only offered to email-provider accounts. */
export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  // The server already deleted the user; drop the local session.
  await supabase.auth.signOut().catch(() => {});
}

/** Maps Supabase auth errors to i18n keys under auth.errors.* */
export function authErrorKey(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) return 'auth.errors.invalidCredentials';
  if (message.includes('already registered')) return 'auth.errors.emailInUse';
  if (message.includes('password')) return 'auth.errors.weakPassword';
  if (message.includes('email not confirmed')) return 'auth.errors.emailNotConfirmed';
  return 'auth.errors.generic';
}
