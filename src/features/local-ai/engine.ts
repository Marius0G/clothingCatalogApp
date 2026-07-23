/**
 * llama.cpp context lifecycle. The only file that touches llama.rn, always via
 * dynamic import so web/Expo Go bundles never pull the native module. A single
 * context is shared and all inference is serialized through withEngine(); the
 * context is released when the app backgrounds (a multi-GB resident model is
 * the first thing Android's low-memory killer would target) and lazily
 * re-initialized on next use.
 */
import { AppState } from 'react-native';
import type { LlamaContext } from 'llama.rn';

import { mmprojPath, modelPath } from './downloads';
import type { LocalModelId } from './registry';
import { useLocalAiStore } from './store';

let context: LlamaContext | null = null;
let contextModelId: LocalModelId | null = null;
let queue: Promise<unknown> = Promise.resolve();

AppState.addEventListener('change', (state) => {
  if (state !== 'active') void releaseEngine();
});

async function ensureReady(modelId: LocalModelId): Promise<LlamaContext> {
  if (context && contextModelId === modelId) return context;
  const store = useLocalAiStore.getState();
  store.setEngineStatus('loading');
  try {
    if (context) await releaseEngine();
    const { initLlama } = await import('llama.rn');
    const created = await initLlama({
      model: modelPath(modelId),
      // Sized for the outfit-compose prompt (40-item wardrobe ≈ 6k tokens);
      // tagging uses far less.
      n_ctx: 8192,
      n_gpu_layers: 99,
      // Context shifting corrupts multimodal caches; required off for vision.
      ctx_shift: false,
    });
    const multimodal = await created.initMultimodal({ path: mmprojPath(modelId), use_gpu: true });
    if (!multimodal) {
      await created.release();
      throw new Error('mmproj init failed');
    }
    context = created;
    contextModelId = modelId;
    store.setEngineStatus('ready');
    return created;
  } catch (error) {
    store.setEngineStatus('error');
    throw error;
  }
}

/** Runs `task` with a ready context, serialized against other engine work. */
export function withEngine<T>(
  modelId: LocalModelId,
  task: (context: LlamaContext) => Promise<T>,
): Promise<T> {
  const run = queue.then(async () => task(await ensureReady(modelId)));
  queue = run.catch(() => {});
  return run;
}

export async function releaseEngine(): Promise<void> {
  const current = context;
  context = null;
  contextModelId = null;
  if (current) {
    await current.release().catch(() => {});
    useLocalAiStore.getState().setEngineStatus('idle');
  }
}
