import { useMemo } from 'react';

import { useAuth } from '@/features/auth/provider';
import { useUiStore } from '@/lib/ui-store';

import { outfitItemsKey, useItemLookup, useOutfitVotes, useSavedOutfits } from './hooks';

/** How long after saving/generating an outfit the check-in stays relevant. */
const CHECKIN_WINDOW_MS = 48 * 60 * 60 * 1000;

// Render-pure "now" (react-compiler forbids Date.now() in render). App-launch
// time is precise enough against a 48h window.
const SESSION_START_MS = Date.now();

export type CheckinCandidate = {
  /** outfitItemsKey — the prompted/vote bookkeeping id. */
  key: string;
  source: 'saved' | 'generated';
  item_ids: string[];
  title: string;
  occasion: string | null;
  rationale: string | null;
  /** Saved-outfit row id when source === 'saved'. */
  savedId: string | null;
  at: number;
};

/**
 * The outfit the home hero should ask "did you wear this?" about: the newest
 * saved or generated outfit from the last 48h that has no vote, no recorded
 * wear and hasn't been prompted before. Null when there's nothing to ask.
 */
export function useCheckinCandidate(): CheckinCandidate | null {
  const { session } = useAuth();
  const { data: savedOutfits } = useSavedOutfits();
  const { data: votes } = useOutfitVotes();
  const itemsById = useItemLookup();
  const hydrated = useUiStore((state) => state.hydrated);
  const stored = useUiStore((state) => state.lastGenerated);
  const prompted = useUiStore((state) => state.promptedOutfits);

  // The persisted store is device-global; another account's entry is not ours.
  const lastGenerated = stored && stored.userId === session?.user.id ? stored : null;

  return useMemo(() => {
    if (!hydrated) return null;

    const saved = savedOutfits?.[0];
    const savedAt = saved ? new Date(saved.created_at).getTime() : 0;
    const generatedAt = lastGenerated?.at ?? 0;

    const candidate: CheckinCandidate | null =
      saved && savedAt >= generatedAt
        ? {
            key: outfitItemsKey(saved.item_ids),
            source: 'saved',
            item_ids: saved.item_ids,
            title: saved.title,
            occasion: saved.occasion,
            rationale: saved.rationale,
            savedId: saved.id,
            at: savedAt,
          }
        : lastGenerated
          ? {
              key: outfitItemsKey(lastGenerated.outfit.item_ids),
              source: 'generated',
              item_ids: lastGenerated.outfit.item_ids,
              title: lastGenerated.outfit.occasion,
              occasion: lastGenerated.occasion,
              rationale: lastGenerated.outfit.rationale,
              savedId: null,
              at: generatedAt,
            }
          : null;

    if (!candidate || candidate.at <= 0) return null;
    if (SESSION_START_MS - candidate.at > CHECKIN_WINDOW_MS) return null;
    if (prompted[candidate.key]) return null;
    if (votes?.get(candidate.key)) return null;

    // Deleted-items guard: an outfit that mostly no longer resolves is stale.
    const resolved = candidate.item_ids
      .map((id) => itemsById.get(id))
      .filter((item) => item !== undefined);
    if (resolved.length < 2) return null;

    // Wear already recorded (approximation — there's no per-outfit wear table):
    // every surviving item worn since the outfit appeared → nothing to ask.
    const allWorn = resolved.every(
      (item) => item.last_worn_at && new Date(item.last_worn_at).getTime() >= candidate.at,
    );
    if (allWorn) return null;

    return candidate;
  }, [hydrated, savedOutfits, lastGenerated, prompted, votes, itemsById]);
}
