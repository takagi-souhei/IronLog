import type { WorkoutDraft } from "@/types";
import { isISODate } from "@/utils/date";
import { isWorkoutExerciseRecord, STORAGE_KEYS } from "./local-storage-repositories";
import { getBrowserStorage } from "./local-storage-repository";

function isWorkoutDraft(value: unknown): value is WorkoutDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const draft = value as Partial<WorkoutDraft>;
  return (
    isISODate(draft.date) &&
    (draft.workoutId === undefined ||
      (typeof draft.workoutId === "string" && draft.workoutId.length > 0)) &&
    Array.isArray(draft.exercises) &&
    draft.exercises.every(isWorkoutExerciseRecord) &&
    typeof draft.bodyWeight === "number" &&
    Number.isFinite(draft.bodyWeight) &&
    draft.bodyWeight > 0
  );
}

export class WorkoutDraftRepository {
  load(): WorkoutDraft | undefined {
    const raw = getBrowserStorage().getItem(STORAGE_KEYS.workoutDraft);
    if (raw === null) return undefined;

    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error("入力途中の記録データを読み取れません。");
    }
    if (!isWorkoutDraft(value)) {
      throw new Error("入力途中の記録データが不正です。");
    }
    return value;
  }

  save(draft: WorkoutDraft): void {
    if (!isWorkoutDraft(draft)) {
      throw new TypeError("Cannot save an invalid workout draft.");
    }
    getBrowserStorage().setItem(STORAGE_KEYS.workoutDraft, JSON.stringify(draft));
  }

  clear(): void {
    getBrowserStorage().removeItem(STORAGE_KEYS.workoutDraft);
  }
}

export const workoutDraftRepository = new WorkoutDraftRepository();
