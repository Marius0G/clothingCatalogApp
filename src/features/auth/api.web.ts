import { supabase } from '@/lib/supabase';

// Metro resolves this file on web instead of api.ts (native SDKs).
export {
  authErrorKey,
  changePassword,
  deleteAccount,
  SignInCancelled,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '@/features/auth/api.shared';

/**
 * Browser OAuth redirect flow: navigates away to the provider and back;
 * the session is picked up from the URL (detectSessionInUrl) on return.
 */
async function signInWithOAuth(provider: 'google' | 'apple') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  await signInWithOAuth('google');
}

export async function signInWithApple() {
  await signInWithOAuth('apple');
}
