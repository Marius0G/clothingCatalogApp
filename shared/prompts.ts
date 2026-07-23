// Re-export of the shared AI prompt builders. The real file lives under
// supabase/functions/_shared/ so edge function deploys can bundle it.
export * from '../supabase/functions/_shared/prompts';
