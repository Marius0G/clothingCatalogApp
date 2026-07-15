import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

import { supabase } from '@/lib/supabase';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

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

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();
  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new SignInCancelled();
    }
    throw error;
  }
  if (!isSuccessResponse(response) || !response.data.idToken) {
    throw new SignInCancelled();
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: response.data.idToken,
  });
  if (error) throw error;
}

export async function signInWithApple() {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
      throw new SignInCancelled();
    }
    throw error;
  }
  if (!credential.identityToken) {
    throw new SignInCancelled();
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
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
