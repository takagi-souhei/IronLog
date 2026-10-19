import { localStorageBackupRepository, validateTrainingBackup } from "@/repositories/local-storage-backup-repository";
import type { TrainingBackup } from "@/types";

export async function exportTrainingBackup(): Promise<string> {
  const backup = await localStorageBackupRepository.createBackup();
  return JSON.stringify(backup, null, 2);
}

export function parseTrainingBackup(json: string): TrainingBackup {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new TypeError("有効なJSONファイルではありません。");
  }
  return validateTrainingBackup(value);
}

export async function restoreTrainingBackup(backup: TrainingBackup): Promise<void> {
  await localStorageBackupRepository.restoreBackup(backup);
}
