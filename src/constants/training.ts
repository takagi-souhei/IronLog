export const WORKOUT_SET_LIMITS = {
  minWeight: -100,
  maxWeight: 300,
  weightStep: 1,
  minReps: 1,
  maxReps: 30,
} as const;

export const LOCAL_STORAGE_SCHEMA_VERSION = 2 as const;
