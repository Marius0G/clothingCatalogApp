/**
 * Local-AI state. `mode` + `activeModelId` are the user's device-specific
 * preference (AsyncStorage via zustand persist — deliberately NOT in the cloud
 * `profiles` row). Download/engine state is runtime-only and re-derived from
 * disk by downloads.syncDownloadStates() on first use.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LocalModelId } from './registry';

export type AiMode = 'cloud' | 'local';

export type DownloadState =
  | { status: 'unknown' }
  | { status: 'idle' }
  | { status: 'downloading'; receivedBytes: number; totalBytes: number }
  | { status: 'paused'; receivedBytes: number; totalBytes: number }
  | { status: 'done' }
  | { status: 'error' };

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

interface LocalAiState {
  mode: AiMode;
  activeModelId: LocalModelId | null;
  downloads: Record<string, DownloadState>;
  engineStatus: EngineStatus;
  /** Resumable snapshots (expo-file-system resumeData), persisted on pause. */
  resumeData: Record<string, string>;
  setMode: (mode: AiMode) => void;
  setActiveModel: (id: LocalModelId | null) => void;
  setDownload: (id: LocalModelId, state: DownloadState) => void;
  setEngineStatus: (status: EngineStatus) => void;
  setResumeData: (key: string, data: string | null) => void;
}

export const useLocalAiStore = create<LocalAiState>()(
  persist(
    (set) => ({
      mode: 'cloud',
      activeModelId: null,
      downloads: {},
      engineStatus: 'idle',
      resumeData: {},
      setMode: (mode) => set({ mode }),
      setActiveModel: (activeModelId) => set({ activeModelId }),
      setDownload: (id, state) =>
        set((current) => ({ downloads: { ...current.downloads, [id]: state } })),
      setEngineStatus: (engineStatus) => set({ engineStatus }),
      setResumeData: (key, data) =>
        set((current) => {
          const next = { ...current.resumeData };
          if (data === null) delete next[key];
          else next[key] = data;
          return { resumeData: next };
        }),
    }),
    {
      name: 'local-ai',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        mode: state.mode,
        activeModelId: state.activeModelId,
        resumeData: state.resumeData,
      }),
    },
  ),
);
