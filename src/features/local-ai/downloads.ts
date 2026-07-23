/**
 * Model download manager. Files land under documentDirectory/local-ai/<id>/
 * (model.gguf + mmproj.gguf + manifest.json). Downloads are resumable within
 * a session and across restarts when they were paused (resumeData persisted);
 * a hard kill mid-transfer restarts that file from zero.
 */
import * as FileSystem from 'expo-file-system/legacy';

import { getLocalModel, totalBytes, type LocalModel, type LocalModelId } from './registry';
import { useLocalAiStore } from './store';

const ROOT = `${FileSystem.documentDirectory}local-ai/`;

export const modelDir = (id: LocalModelId) => `${ROOT}${id}/`;
export const modelPath = (id: LocalModelId) => `${modelDir(id)}model.gguf`;
export const mmprojPath = (id: LocalModelId) => `${modelDir(id)}mmproj.gguf`;
const manifestPath = (id: LocalModelId) => `${modelDir(id)}manifest.json`;

const active = new Map<string, FileSystem.DownloadResumable>();

async function fileSize(uri: string): Promise<number | null> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && !info.isDirectory ? (info.size ?? 0) : null;
}

async function isComplete(model: LocalModel): Promise<boolean> {
  const manifest = await FileSystem.getInfoAsync(manifestPath(model.id));
  if (!manifest.exists) return false;
  return (
    (await fileSize(modelPath(model.id))) === model.ggufBytes &&
    (await fileSize(mmprojPath(model.id))) === model.mmprojBytes
  );
}

let syncPromise: Promise<void> | null = null;

/** Re-derives per-model download state from disk; memoized per app launch. */
export function syncDownloadStates(): Promise<void> {
  syncPromise ??= (async () => {
    const { setDownload } = useLocalAiStore.getState();
    const { LOCAL_MODELS } = await import('./registry');
    for (const model of LOCAL_MODELS) {
      setDownload(model.id, (await isComplete(model)) ? { status: 'done' } : { status: 'idle' });
    }
  })();
  return syncPromise;
}

export async function hasFreeSpaceFor(model: LocalModel): Promise<boolean> {
  const free = await FileSystem.getFreeDiskStorageAsync();
  return free > totalBytes(model) * 1.1;
}

/**
 * Downloads model + mmproj sequentially with progress into the store.
 * Resolves true when both files are complete and verified.
 */
export async function downloadModel(id: LocalModelId): Promise<boolean> {
  const model = getLocalModel(id);
  const store = useLocalAiStore.getState();
  const total = totalBytes(model);

  await FileSystem.makeDirectoryAsync(modelDir(id), { intermediates: true }).catch(() => {});

  const parts: { url: string; file: string; bytes: number }[] = [
    { url: model.ggufUrl, file: modelPath(id), bytes: model.ggufBytes },
    { url: model.mmprojUrl, file: mmprojPath(id), bytes: model.mmprojBytes },
  ];

  try {
    let doneBytes = 0;
    for (const part of parts) {
      const existing = await fileSize(part.file);
      if (existing === part.bytes) {
        doneBytes += part.bytes;
        continue;
      }
      const resumeKey = `${id}:${part.file}`;
      const saved = useLocalAiStore.getState().resumeData[resumeKey];
      const task = FileSystem.createDownloadResumable(
        part.url,
        part.file,
        {},
        (progress) => {
          useLocalAiStore.getState().setDownload(id, {
            status: 'downloading',
            receivedBytes: doneBytes + progress.totalBytesWritten,
            totalBytes: total,
          });
        },
        saved,
      );
      active.set(id, task);
      store.setDownload(id, { status: 'downloading', receivedBytes: doneBytes, totalBytes: total });
      const result = saved ? await task.resumeAsync() : await task.downloadAsync();
      active.delete(id);
      store.setResumeData(resumeKey, null);
      if (!result) return false; // cancelled/paused
      const written = await fileSize(part.file);
      if (written !== part.bytes) {
        // Truncated or corrupted transfer: drop it so the next try starts clean.
        await FileSystem.deleteAsync(part.file, { idempotent: true });
        store.setDownload(id, { status: 'error' });
        return false;
      }
      doneBytes += part.bytes;
    }
    await FileSystem.writeAsStringAsync(
      manifestPath(id),
      JSON.stringify({ version: model.version, bytes: total }),
    );
    store.setDownload(id, { status: 'done' });
    return true;
  } catch {
    active.delete(id);
    useLocalAiStore.getState().setDownload(id, { status: 'error' });
    return false;
  }
}

/** Pauses an in-flight download, persisting the resumable snapshot. */
export async function pauseDownload(id: LocalModelId): Promise<void> {
  const task = active.get(id);
  if (!task) return;
  try {
    await task.pauseAsync();
    const snapshot = task.savable();
    const store = useLocalAiStore.getState();
    store.setResumeData(`${id}:${snapshot.fileUri}`, snapshot.resumeData ?? '');
    const current = store.downloads[id];
    if (current?.status === 'downloading') {
      store.setDownload(id, { ...current, status: 'paused' });
    }
  } catch {
    // pause raced completion — harmless
  }
  active.delete(id);
}

/** Cancels an in-flight download and removes all partial files. */
export async function cancelDownload(id: LocalModelId): Promise<void> {
  const task = active.get(id);
  if (task) await task.cancelAsync().catch(() => {});
  active.delete(id);
  await deleteModel(id);
}

export async function deleteModel(id: LocalModelId): Promise<void> {
  await FileSystem.deleteAsync(modelDir(id), { idempotent: true });
  const store = useLocalAiStore.getState();
  store.setResumeData(`${id}:${modelPath(id)}`, null);
  store.setResumeData(`${id}:${mmprojPath(id)}`, null);
  store.setDownload(id, { status: 'idle' });
  if (store.activeModelId === id) {
    store.setActiveModel(null);
    store.setMode('cloud');
  }
}

/** Bytes on disk for a model dir (Settings "storage used" row). */
export async function modelBytesOnDisk(id: LocalModelId): Promise<number> {
  return ((await fileSize(modelPath(id))) ?? 0) + ((await fileSize(mmprojPath(id))) ?? 0);
}
