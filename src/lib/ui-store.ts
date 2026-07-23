/**
 * Device-local UI preferences (zustand persist → AsyncStorage — deliberately
 * not in the cloud `profiles` row): last-used wardrobe view, which outfits the
 * home check-in already prompted for, and the last generated outfit so the
 * home hero survives restarts (the TanStack cache is memory-only).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Outfit } from '@shared/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type WardrobeView = 'clothes' | 'outfits';

/** userId scopes the entry — the store is device-global, accounts are not. */
export type LastGenerated = { outfit: Outfit; occasion: string | null; at: number; userId: string };

const PROMPTED_KEEP = 20;

interface UiState {
  /** True once the persisted state has been rehydrated from AsyncStorage. */
  hydrated: boolean;
  wardrobeView: WardrobeView;
  /** outfitItemsKey → when it was prompted (ms); pruned to the newest few. */
  promptedOutfits: Record<string, number>;
  lastGenerated: LastGenerated | null;
  setWardrobeView: (view: WardrobeView) => void;
  markPrompted: (key: string) => void;
  setLastGenerated: (entry: LastGenerated) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      hydrated: false,
      wardrobeView: 'clothes',
      promptedOutfits: {},
      lastGenerated: null,
      setWardrobeView: (wardrobeView) => set({ wardrobeView }),
      markPrompted: (key) =>
        set((current) => {
          const next = { ...current.promptedOutfits, [key]: Date.now() };
          const kept = Object.keys(next)
            .sort((a, b) => next[b] - next[a])
            .slice(0, PROMPTED_KEEP);
          return { promptedOutfits: Object.fromEntries(kept.map((k) => [k, next[k]])) };
        }),
      setLastGenerated: (lastGenerated) => set({ lastGenerated }),
    }),
    {
      name: 'ui-prefs',
      // Guarded because expo-router prerenders in Node, where there's no
      // window/localStorage — persisting there must be a no-op, not a crash.
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? {
              getItem: async () => null,
              setItem: async () => {},
              removeItem: async () => {},
            }
          : AsyncStorage,
      ),
      partialize: (state) => ({
        wardrobeView: state.wardrobeView,
        promptedOutfits: state.promptedOutfits,
        lastGenerated: state.lastGenerated,
      }),
      onRehydrateStorage: () => () => {
        useUiStore.setState({ hydrated: true });
      },
    },
  ),
);
