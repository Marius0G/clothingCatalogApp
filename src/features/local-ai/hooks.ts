/**
 * Hooks for the Settings AI screen. All logic lives in downloads.ts/store.ts;
 * these are thin selectors + actions per the feature-module convention.
 */
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import { useEffect } from 'react';

import {
  cancelDownload,
  deleteModel,
  downloadModel,
  hasFreeSpaceFor,
  pauseDownload,
  syncDownloadStates,
} from './downloads';
import { getLocalModel, LOCAL_MODELS, type LocalModel, type LocalModelId } from './registry';
import { useLocalAiStore, type DownloadState } from './store';

export { LOCAL_MODELS };
export type { LocalModel, LocalModelId };

export function useLocalAi() {
  const mode = useLocalAiStore((state) => state.mode);
  const activeModelId = useLocalAiStore((state) => state.activeModelId);
  const setMode = useLocalAiStore((state) => state.setMode);
  const setActiveModel = useLocalAiStore((state) => state.setActiveModel);
  useEffect(() => {
    void syncDownloadStates();
  }, []);
  return { mode, activeModelId, setMode, setActiveModel };
}

// Stable fallback: an inline object literal here would be a fresh snapshot
// every render and send useSyncExternalStore into an infinite loop.
const UNKNOWN_STATE: DownloadState = { status: 'unknown' };

export function useModelDownload(id: LocalModelId): DownloadState {
  return useLocalAiStore((state) => state.downloads[id] ?? UNKNOWN_STATE);
}

/** Device has enough RAM for this model (per registry gate). */
export function isModelSupported(model: LocalModel): boolean {
  const total = Device.totalMemory;
  return total !== null && total >= model.minRamBytes;
}

export interface StartDownloadResult {
  ok: boolean;
  blocked?: 'storage' | 'cellular';
}

/**
 * Pre-flights storage + network, then starts (or resumes) the download.
 * `allowCellular` comes from the UI after the user confirmed the warning.
 */
export async function startModelDownload(
  id: LocalModelId,
  options?: { allowCellular?: boolean },
): Promise<StartDownloadResult> {
  const model = getLocalModel(id);
  if (!(await hasFreeSpaceFor(model))) return { ok: false, blocked: 'storage' };
  if (!options?.allowCellular) {
    const network = await Network.getNetworkStateAsync();
    if (network.type === Network.NetworkStateType.CELLULAR) {
      return { ok: false, blocked: 'cellular' };
    }
  }
  void downloadModel(id);
  return { ok: true };
}

export { cancelDownload, deleteModel, pauseDownload };
