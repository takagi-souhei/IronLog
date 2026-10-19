import { LOCAL_STORAGE_SCHEMA_VERSION } from "@/constants/training";
import type {
  BodyWeightRecord,
  Exercise,
  TrainingBackup,
  Workout,
  WorkoutExercise,
} from "@/types";
import {
  bodyWeightRepository,
  exerciseRepository,
  isBodyWeightRecord,
  isExerciseRecord,
  isWorkoutRecord,
  STORAGE_KEYS,
  workoutRepository,
} from "./local-storage-repositories";
import type { StorageLike } from "./local-storage-repository";

const BACKUP_KEYS = [
  STORAGE_KEYS.exercises,
  STORAGE_KEYS.workouts,
  STORAGE_KEYS.bodyWeightRecords,
  STORAGE_KEYS.settings,
] as const;

interface StoredCollection<T> {
  schemaVersion: typeof LOCAL_STORAGE_SCHEMA_VERSION;
  records: T[];
}

function getStorage(): StorageLike {
  if (typeof window === "undefined") {
    throw new Error("バックアップ機能はブラウザーでのみ利用できます。");
  }
  return window.localStorage;
}

function getObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isArrayOf<T>(
  value: unknown,
  predicate: (entry: unknown) => entry is T,
): value is T[] {
  return Array.isArray(value) && value.every(predicate);
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry, depth + 1));

  const object = getObject(value);
  if (!object) return false;
  return Object.entries(object).every(
    ([key, entry]) =>
      key !== "__proto__" &&
      key !== "prototype" &&
      key !== "constructor" &&
      isJsonValue(entry, depth + 1),
  );
}

function isSettings(value: unknown): value is TrainingBackup["settings"] {
  const settings = getObject(value);
  return settings !== undefined && isJsonValue(settings);
}

function isIsoDateTime(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isStrictExercise(value: unknown): value is Exercise {
  const exercise = getObject(value);
  return (
    exercise !== undefined &&
    hasOnlyKeys(exercise, [
      "id",
      "name",
      "category",
      "weightUnit",
      "bodyweightRatio",
      "isArchived",
    ]) &&
    isExerciseRecord(value)
  );
}

function isStrictWorkout(value: unknown, exerciseIds: ReadonlySet<string>): value is Workout {
  const workout = getObject(value);
  if (
    workout === undefined ||
    !hasOnlyKeys(workout, ["id", "date", "exercises", "notes"]) ||
    !isWorkoutRecord(value)
  ) {
    return false;
  }

  const typedWorkout = value;
  if (typedWorkout.id.length === 0) return false;
  const workoutExerciseIds = new Set<string>();
  return typedWorkout.exercises.every((entry: WorkoutExercise) => {
    const workoutExercise = getObject(entry);
    if (
      workoutExercise === undefined ||
      !hasOnlyKeys(workoutExercise, [
        "id",
        "exerciseId",
        "exerciseSnapshot",
        "sets",
        "notes",
      ]) ||
      !exerciseIds.has(entry.exerciseId) ||
      workoutExerciseIds.has(entry.id)
    ) {
      return false;
    }
    workoutExerciseIds.add(entry.id);

    const snapshot = getObject(entry.exerciseSnapshot);
    if (
      snapshot === undefined ||
      !hasOnlyKeys(snapshot, ["name", "category", "weightUnit", "bodyweightRatio"])
    ) {
      return false;
    }

    const setIds = new Set<string>();
    return entry.sets.every((set) => {
      const workoutSet = getObject(set);
      if (
        workoutSet === undefined ||
        !hasOnlyKeys(workoutSet, ["id", "reps", "externalWeight"]) ||
        setIds.has(set.id)
      ) {
        return false;
      }
      setIds.add(set.id);
      return true;
    });
  });
}

function isStrictBodyWeightRecord(value: unknown): value is BodyWeightRecord {
  const record = getObject(value);
  return (
    record !== undefined &&
    hasOnlyKeys(record, ["id", "date", "weight"]) &&
    typeof record.id === "string" &&
    record.id.length > 0 &&
    isBodyWeightRecord(value)
  );
}

export function validateTrainingBackup(value: unknown): TrainingBackup {
  const backup = getObject(value);
  if (
    backup === undefined ||
    !hasOnlyKeys(backup, [
      "format",
      "version",
      "exportedAt",
      "exercises",
      "workouts",
      "bodyWeightRecords",
      "settings",
    ]) ||
    backup.format !== "ironlog-backup" ||
    backup.version !== 1 ||
    typeof backup.exportedAt !== "string" ||
    !isIsoDateTime(backup.exportedAt)
  ) {
    throw new TypeError("バックアップの形式が正しくありません。");
  }

  const settings = backup.settings;
  if (!isSettings(settings)) {
    throw new TypeError("バックアップに不正な設定情報があります。");
  }

  const exercisesValue = backup.exercises;
  if (!isArrayOf(exercisesValue, isStrictExercise)) {
    throw new TypeError("バックアップに不正な種目データがあります。");
  }
  const exercises = exercisesValue;
  const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
  if (exerciseIds.size !== exercises.length) {
    throw new TypeError("バックアップ内の種目IDが重複しています。");
  }

  const workoutsValue = backup.workouts;
  if (!isArrayOf(workoutsValue, (workout): workout is Workout =>
    isStrictWorkout(workout, exerciseIds))) {
    throw new TypeError("バックアップに不正なトレーニング履歴があります。");
  }
  const workouts = workoutsValue;
  if (new Set(workouts.map((workout) => workout.id)).size !== workouts.length) {
    throw new TypeError("バックアップ内のトレーニングIDが重複しています。");
  }

  const bodyWeightRecordsValue = backup.bodyWeightRecords;
  if (!isArrayOf(bodyWeightRecordsValue, isStrictBodyWeightRecord)) {
    throw new TypeError("バックアップに不正な体重履歴があります。");
  }
  const bodyWeightRecords = bodyWeightRecordsValue;
  if (new Set(bodyWeightRecords.map((record) => record.date)).size !== bodyWeightRecords.length) {
    throw new TypeError("バックアップ内の体重記録日が重複しています。");
  }

  return {
    format: "ironlog-backup",
    version: 1,
    exportedAt: backup.exportedAt,
    exercises,
    workouts,
    bodyWeightRecords,
    settings,
  };
}

export class LocalStorageBackupRepository {
  async createBackup(): Promise<TrainingBackup> {
    const storage = getStorage();
    const [exercises, workouts, bodyWeightRecords] = await Promise.all([
      exerciseRepository.getAll(),
      workoutRepository.getAll(),
      bodyWeightRepository.getAll(),
    ]);
    const settingsRaw = storage.getItem(STORAGE_KEYS.settings);
    let settings: unknown = {};
    if (settingsRaw !== null) {
      try {
        settings = JSON.parse(settingsRaw);
      } catch {
        throw new Error("保存済みの設定情報を読み取れません。");
      }
    }
    if (!isSettings(settings)) {
      throw new Error("保存済みの設定情報が不正です。");
    }

    return validateTrainingBackup({
      format: "ironlog-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises,
      workouts,
      bodyWeightRecords,
      settings,
    });
  }

  async restoreBackup(value: unknown): Promise<void> {
    const backup = validateTrainingBackup(value);
    const storage = getStorage();
    const previousValues = new Map(
      BACKUP_KEYS.map((key) => [key, storage.getItem(key)] as const),
    );
    const collections: readonly [string, string][] = [
      [
        STORAGE_KEYS.exercises,
        JSON.stringify({
          schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
          records: backup.exercises,
        } satisfies StoredCollection<Exercise>),
      ],
      [
        STORAGE_KEYS.workouts,
        JSON.stringify({
          schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
          records: backup.workouts,
        } satisfies StoredCollection<Workout>),
      ],
      [
        STORAGE_KEYS.bodyWeightRecords,
        JSON.stringify({
          schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
          records: backup.bodyWeightRecords,
        } satisfies StoredCollection<BodyWeightRecord>),
      ],
      [STORAGE_KEYS.settings, JSON.stringify(backup.settings)],
    ];

    try {
      for (const [key, collection] of collections) {
        storage.setItem(key, collection);
      }
    } catch (cause) {
      const rollbackErrors: string[] = [];
      for (const [key, previousValue] of previousValues) {
        try {
          if (previousValue === null) {
            storage.removeItem(key);
          } else {
            storage.setItem(key, previousValue);
          }
        } catch (rollbackCause) {
          rollbackErrors.push(
            rollbackCause instanceof Error ? rollbackCause.message : String(rollbackCause),
          );
        }
      }

      const originalError = cause instanceof Error ? cause.message : String(cause);
      if (rollbackErrors.length > 0) {
        throw new Error(
          `バックアップの復元に失敗しました（${originalError}）。元データの復元にも失敗しました（${rollbackErrors.join(" / ")}）。`,
        );
      }
      throw new Error(`バックアップの復元に失敗しました。元のデータは保持されています（${originalError}）。`);
    }
  }
}

export const localStorageBackupRepository = new LocalStorageBackupRepository();
