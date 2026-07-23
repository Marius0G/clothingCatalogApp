// Re-export of the shared outfit engine (prefilter, prompt, rule scorer).
// The real file lives under supabase/functions/_shared/ so edge deploys
// bundle it.
export * from '../supabase/functions/_shared/outfitEngine';
