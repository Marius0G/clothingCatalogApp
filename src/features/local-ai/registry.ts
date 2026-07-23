/**
 * Downloadable on-device models. URLs are pinned to immutable HF revisions so
 * a file can never change under a shipped app version; bump `version` together
 * with the revision to surface an "update available" state instead.
 */
export type LocalModelId = 'gemma4-e2b' | 'gemma4-e4b';

export interface LocalModel {
  id: LocalModelId;
  /** i18n key suffix under localAi.models.* */
  nameKey: string;
  ggufUrl: string;
  mmprojUrl: string;
  ggufBytes: number;
  mmprojBytes: number;
  /** Device.totalMemory below this hides the model as incompatible. */
  minRamBytes: number;
  recommended: boolean;
  version: number;
}

const HF = 'https://huggingface.co';
const E2B_REV = '675cff42a74c774d6cb76f76d8eacb49b48c9b93';
const E4B_REV = '4b4a2c1d584be7264f87aac328a1bc739ce81b6c';

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'gemma4-e2b',
    nameKey: 'e2b',
    ggufUrl: `${HF}/google/gemma-4-E2B-it-qat-q4_0-gguf/resolve/${E2B_REV}/gemma-4-E2B_q4_0-it.gguf`,
    mmprojUrl: `${HF}/google/gemma-4-E2B-it-qat-q4_0-gguf/resolve/${E2B_REV}/gemma-4-E2B-it-mmproj.gguf`,
    ggufBytes: 3_349_516_256,
    mmprojBytes: 986_833_664,
    minRamBytes: 5.5 * 1024 ** 3,
    recommended: true,
    version: 1,
  },
  {
    id: 'gemma4-e4b',
    nameKey: 'e4b',
    ggufUrl: `${HF}/google/gemma-4-E4B-it-qat-q4_0-gguf/resolve/${E4B_REV}/gemma-4-E4B_q4_0-it.gguf`,
    mmprojUrl: `${HF}/google/gemma-4-E4B-it-qat-q4_0-gguf/resolve/${E4B_REV}/gemma-4-E4B-it-mmproj.gguf`,
    ggufBytes: 5_154_941_280,
    mmprojBytes: 991_552_256,
    minRamBytes: 7.5 * 1024 ** 3,
    recommended: false,
    version: 1,
  },
];

export function getLocalModel(id: LocalModelId): LocalModel {
  const model = LOCAL_MODELS.find((entry) => entry.id === id);
  if (!model) throw new Error(`unknown local model: ${id}`);
  return model;
}

export function totalBytes(model: LocalModel): number {
  return model.ggufBytes + model.mmprojBytes;
}
