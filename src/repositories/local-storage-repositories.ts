import type {
  BodyWeightRecord,
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutExerciseSnapshot,
  WorkoutSet,
} from "@/types";
import { isISODate } from "@/utils/date";
import { INITIAL_EXERCISES } from "@/constants/initial-exercises";
import { LOCAL_STORAGE_SCHEMA_VERSION, WORKOUT_SET_LIMITS } from "@/constants/training";
import {
  commitStorageWrites,
  getBrowserStorage,
  LocalStorageRepository,
  type StorageLike,
} from "./local-storage-repository";

const isString = (value: unknown): value is string => typeof value === "string";
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function isExerciseRecord(value: unknown): value is Exercise {
  if (typeof value !== "object" || value === null) return false;
  const exercise = value as Partial<Exercise>;
  return (
    isString(exercise.id) &&
    exercise.id.length > 0 &&
    isString(exercise.name) &&
    exercise.name.trim().length > 0 &&
    isString(exercise.category) &&
    (exercise.weightUnit === "total" || exercise.weightUnit === "per-hand") &&
    isFiniteNumber(exercise.bodyweightRatio) &&
    exercise.bodyweightRatio >= 0 &&
    typeof exercise.isArchived === "boolean"
  );
}

function isWorkoutSet(value: unknown): value is WorkoutSet {
  if (typeof value !== "object" || value === null) return false;
  const set = value as Partial<WorkoutSet>;
  return (
    isString(set.id) &&
    set.id.length > 0 &&
    typeof set.reps === "number" &&
    Number.isInteger(set.reps) &&
    set.reps >= WORKOUT_SET_LIMITS.minReps &&
    set.reps <= WORKOUT_SET_LIMITS.maxReps &&
    isFiniteNumber(set.externalWeight) &&
    Number.isInteger(set.externalWeight) &&
    set.externalWeight >= WORKOUT_SET_LIMITS.minWeight &&
    set.externalWeight <= WORKOUT_SET_LIMITS.maxWeight
  );
}

function isWorkoutExerciseSnapshot(value: unknown): value is WorkoutExerciseSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Partial<WorkoutExerciseSnapshot>;
  return (
    isString(snapshot.name) &&
    isString(snapshot.category) &&
    (snapshot.weightUnit === "total" || snapshot.weightUnit === "per-hand") &&
    isFiniteNumber(snapshot.bodyweightRatio) &&
    snapshot.bodyweightRatio >= 0
  );
}

export function isWorkoutExerciseRecord(value: unknown): value is WorkoutExercise {
  if (typeof value !== "object" || value === null) return false;
  const workoutExercise = value as Partial<WorkoutExercise>;
  return (
    isString(workoutExercise.id) &&
    isString(workoutExercise.exerciseId) &&
    isWorkoutExerciseSnapshot(workoutExercise.exerciseSnapshot) &&
    Array.isArray(workoutExercise.sets) &&
    workoutExercise.sets.every(isWorkoutSet) &&
    (workoutExercise.notes === undefined || isString(workoutExercise.notes))
  );
}

export function isWorkoutRecord(value: unknown): value is Workout {
  if (typeof value !== "object" || value === null) return false;
  const workout = value as Partial<Workout>;
  return (
    isString(workout.id) &&
    isISODate(workout.date) &&
    Array.isArray(workout.exercises) &&
    workout.exercises.every(isWorkoutExerciseRecord) &&
    (workout.notes === undefined || isString(workout.notes))
  );
}

export function isBodyWeightRecord(value: unknown): value is BodyWeightRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<BodyWeightRecord>;
  return (
    isString(record.id) &&
    isISODate(record.date) &&
    isFiniteNumber(record.weight) &&
    record.weight > 0
  );
}

function migrateLegacyExercises(records: readonly unknown[]): Exercise[] {
  return records.map((value) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Legacy exercise record is invalid.");
    }
    const exercise = value as {
      id?: unknown;
      name?: unknown;
      category?: unknown;
      loadType?: unknown;
    };
    if (
      !isString(exercise.id) ||
      !isString(exercise.name) ||
      (exercise.loadType !== "external" && exercise.loadType !== "bodyweight")
    ) {
      throw new Error("Legacy exercise record is invalid.");
    }

    const name = exercise.name;
    const isDip = name.includes("ディップス");
    const isPullUp = name.includes("懸垂");
    const isDumbbell = ["ダンベル", "サイドレイズ", "リアレイズ"].some((keyword) =>
      name.includes(keyword),
    );
    return {
      id: exercise.id,
      name,
      category: isString(exercise.category) ? exercise.category : "その他",
      weightUnit: isDumbbell ? "per-hand" : "total",
      bodyweightRatio: isDip
        ? 0.9
        : isPullUp || exercise.loadType === "bodyweight"
          ? 1
          : 0,
      isArchived: false,
    };
  });
}

function getLegacyExercises(storage: StorageLike): Map<string, Exercise> {
  const raw = storage.getItem("ironlog:v1:exercises");
  if (raw === null) {
    throw new Error("Legacy workout data exists, but its exercise records are missing.");
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Legacy exercise data is not valid JSON.");
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 1 ||
    !("records" in value) ||
    !Array.isArray(value.records)
  ) {
    throw new Error("Legacy exercise data has an unsupported or invalid format.");
  }

  return new Map(
    migrateLegacyExercises(value.records).map((exercise) => [exercise.id, exercise] as const),
  );
}

function migrateLegacyWorkouts(
  records: readonly unknown[],
  storage: StorageLike,
): Workout[] {
  const exercises = getLegacyExercises(storage);

  return records.map((value) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Legacy workout record is invalid.");
    }
    const workout = value as Partial<Workout> & { exercises?: unknown };
    if (
      !isString(workout.id) ||
      !isISODate(workout.date) ||
      !Array.isArray(workout.exercises)
    ) {
      throw new Error("Legacy workout record is invalid.");
    }

    return {
      id: workout.id,
      date: workout.date,
      exercises: workout.exercises.map((entry) => {
        if (typeof entry !== "object" || entry === null) {
          throw new Error("Legacy workout exercise record is invalid.");
        }
        const workoutExercise = entry as {
          id?: unknown;
          exerciseId?: unknown;
          sets?: unknown;
          notes?: unknown;
        };
        const exercise =
          typeof workoutExercise.exerciseId === "string"
            ? exercises.get(workoutExercise.exerciseId)
            : undefined;
        if (
          !isString(workoutExercise.id) ||
          !isString(workoutExercise.exerciseId) ||
          exercise === undefined ||
          !Array.isArray(workoutExercise.sets)
        ) {
          throw new Error("Legacy workout exercise cannot be linked to an exercise.");
        }

        return {
          id: workoutExercise.id,
          exerciseId: workoutExercise.exerciseId,
          exerciseSnapshot: {
            name: exercise.name,
            category: exercise.category,
            weightUnit: exercise.weightUnit,
            bodyweightRatio: exercise.bodyweightRatio,
          },
          sets: workoutExercise.sets.map((setValue) => {
            if (typeof setValue !== "object" || setValue === null) {
              throw new Error("Legacy workout set is invalid.");
            }
            const set = setValue as { id?: unknown; reps?: unknown; weight?: unknown };
            if (
              !isString(set.id) ||
              typeof set.reps !== "number" ||
              !Number.isInteger(set.reps) ||
              !isFiniteNumber(set.weight)
            ) {
              throw new Error("Legacy workout set is invalid.");
            }
            return { id: set.id, reps: set.reps, externalWeight: set.weight };
          }),
          ...(isString(workoutExercise.notes) ? { notes: workoutExercise.notes } : {}),
        };
      }),
      ...(isString(workout.notes) ? { notes: workout.notes } : {}),
    };
  });
}

function migrateLegacyBodyWeightRecords(records: readonly unknown[]): BodyWeightRecord[] {
  return records.map((value) => {
    if (!isBodyWeightRecord(value)) {
      throw new Error("Legacy body-weight record is invalid.");
    }
    return value;
  });
}

export const STORAGE_KEYS = {
  exercises: "ironlog:v2:exercises",
  workouts: "ironlog:v2:workouts",
  bodyWeightRecords: "ironlog:v2:body-weight-records",
  settings: "ironlog:v2:settings",
  workoutDraft: "ironlog:v2:workout-draft",
} as const;

function storedCollection<T>(records: T[]): string {
  return JSON.stringify({
    schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
    records,
  });
}

export async function saveWorkoutSession(
  workout: Workout | undefined,
  bodyWeightRecord: BodyWeightRecord,
  workoutIdToDelete?: string,
): Promise<void> {
  if (!isBodyWeightRecord(bodyWeightRecord) || (workout && !isWorkoutRecord(workout))) {
    throw new TypeError("Cannot save an invalid workout session.");
  }

  const [workouts, bodyWeightRecords] = await Promise.all([
    workout !== undefined || workoutIdToDelete !== undefined
      ? workoutRepository.getAll()
      : Promise.resolve<Workout[]>([]),
    bodyWeightRepository.getAll(),
  ]);

  let nextWorkouts = workouts;
  if (workoutIdToDelete !== undefined) {
    nextWorkouts = nextWorkouts.filter((record) => record.id !== workoutIdToDelete);
  }
  if (workout !== undefined) {
    const index = nextWorkouts.findIndex((record) => record.id === workout.id);
    nextWorkouts =
      index === -1
        ? [...nextWorkouts, workout]
        : nextWorkouts.map((record, recordIndex) =>
            recordIndex === index ? workout : record,
          );
  }

  const nextBodyWeightRecords = [
    ...bodyWeightRecords.filter((record) => record.date !== bodyWeightRecord.date),
    bodyWeightRecord,
  ];
  const writes = [];
  if (workout !== undefined || workoutIdToDelete !== undefined) {
    writes.push({ key: STORAGE_KEYS.workouts, value: storedCollection(nextWorkouts) });
  }
  writes.push({
    key: STORAGE_KEYS.bodyWeightRecords,
    value: storedCollection(nextBodyWeightRecords),
  });
  writes.push({ key: STORAGE_KEYS.workoutDraft, value: null });
  commitStorageWrites(writes, getBrowserStorage());
}

export async function deleteWorkoutSession(workoutId: string): Promise<void> {
  const workouts = await workoutRepository.getAll();
  commitStorageWrites(
    [
      {
        key: STORAGE_KEYS.workouts,
        value: storedCollection(workouts.filter((workout) => workout.id !== workoutId)),
      },
      { key: STORAGE_KEYS.workoutDraft, value: null },
    ],
    getBrowserStorage(),
  );
}

export const exerciseRepository = new LocalStorageRepository(
  STORAGE_KEYS.exercises,
  isExerciseRecord,
  undefined,
  undefined,
  "ironlog:v1:exercises",
  migrateLegacyExercises,
);
export const workoutRepository = new LocalStorageRepository(
  STORAGE_KEYS.workouts,
  isWorkoutRecord,
  undefined,
  undefined,
  "ironlog:v1:workouts",
  migrateLegacyWorkouts,
);
export const bodyWeightRepository = new LocalStorageRepository(
  STORAGE_KEYS.bodyWeightRecords,
  isBodyWeightRecord,
  undefined,
  (record) => record.date,
  "ironlog:v1:body-weight-records",
  migrateLegacyBodyWeightRecords,
);

export async function ensureInitialExercises(): Promise<void> {
  const savedExercises = await exerciseRepository.getAll();
  const savedIds = new Set(savedExercises.map((exercise) => exercise.id));

  for (const exercise of INITIAL_EXERCISES) {
    if (!savedIds.has(exercise.id)) {
      await exerciseRepository.save(exercise);
    }
  }
}
