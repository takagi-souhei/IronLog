export type ExerciseCategory = string;
export type ExerciseWeightUnit = "total" | "per-hand";

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  weightUnit: ExerciseWeightUnit;
  bodyweightRatio: number;
  isArchived: boolean;
}

export interface WorkoutSet {
  id: string;
  reps: number;
  /** External load in kg; assistance is represented as a negative value. */
  externalWeight: number;
}

export interface WorkoutExerciseSnapshot {
  name: string;
  category: ExerciseCategory;
  weightUnit: ExerciseWeightUnit;
  bodyweightRatio: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseSnapshot: WorkoutExerciseSnapshot;
  sets: WorkoutSet[];
  notes?: string;
}

export interface Workout {
  id: string;
  date: string;
  exercises: WorkoutExercise[];
  notes?: string;
}

export interface WorkoutDraft {
  date: string;
  workoutId?: string;
  exercises: WorkoutExercise[];
  bodyWeight: number;
}

export interface BodyWeightRecord {
  id: string;
  date: string;
  weight: number;
}

export type BackupJsonValue =
  | string
  | number
  | boolean
  | null
  | BackupJsonValue[]
  | { [key: string]: BackupJsonValue };

export interface TrainingBackup {
  format: "ironlog-backup";
  version: 1;
  exportedAt: string;
  exercises: Exercise[];
  workouts: Workout[];
  bodyWeightRecords: BodyWeightRecord[];
  settings: { [key: string]: BackupJsonValue };
}

export interface DateFilter {
  from?: string;
  to?: string;
}

export interface DailyWorkoutSummary {
  date: string;
  workoutCount: number;
  setCount: number;
  volume: number;
  estimatedOneRepMax: number | null;
}
