import { bodyWeightRepository, workoutRepository } from "@/repositories";
import type {
  BodyWeightRecord,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from "@/types";
import { effectiveWeight, estimateOneRepMax } from "@/utils";
import { createBodyWeightIndex } from "@/utils/body-weight";

export interface WorkoutSetHistoryItem {
  id: string;
  reps: number;
  externalWeight: number;
  effectiveWeight: number | null;
  estimatedOneRepMax: number | null;
}

export interface WorkoutExerciseHistoryItem {
  id: string;
  exerciseId: string;
  name: string;
  category: string;
  weightUnit: "total" | "per-hand";
  bodyweightRatio: number;
  sets: WorkoutSetHistoryItem[];
  maxWeight: number | null;
  estimatedOneRepMax: number | null;
}

export interface WorkoutDayHistory {
  date: string;
  exercises: WorkoutExerciseHistoryItem[];
}

function mapExerciseHistory(
  exercise: WorkoutExercise,
  sets: readonly WorkoutSet[],
  bodyWeight?: number,
): WorkoutExerciseHistoryItem {
  const historySets = sets.map((set) => {
    const load = effectiveWeight(set, exercise.exerciseSnapshot, bodyWeight);
    return {
      id: set.id,
      reps: set.reps,
      externalWeight: set.externalWeight,
      effectiveWeight: load,
      estimatedOneRepMax:
        load === null ? null : estimateOneRepMax(load, set.reps),
    };
  });

  return {
    id: exercise.id,
    exerciseId: exercise.exerciseId,
    name: exercise.exerciseSnapshot.name,
    category: exercise.exerciseSnapshot.category,
    weightUnit: exercise.exerciseSnapshot.weightUnit,
    bodyweightRatio: exercise.exerciseSnapshot.bodyweightRatio,
    sets: historySets,
    maxWeight: historySets.reduce<number | null>(
      (max, set) =>
        set.effectiveWeight !== null && (max === null || set.effectiveWeight > max)
          ? set.effectiveWeight
          : max,
      null,
    ),
    estimatedOneRepMax: historySets.reduce<number | null>(
      (max, set) =>
        set.estimatedOneRepMax !== null &&
        (max === null || set.estimatedOneRepMax > max)
          ? set.estimatedOneRepMax
          : max,
      null,
    ),
  };
}

export async function loadWorkoutHistory(): Promise<WorkoutDayHistory[]> {
  const [workouts, bodyWeightRecords] = await Promise.all([
    workoutRepository.getAll(),
    bodyWeightRepository.getAll(),
  ]);
  return buildWorkoutHistory(workouts, bodyWeightRecords);
}

export function buildWorkoutHistory(
  workouts: readonly Workout[],
  bodyWeightRecords: readonly BodyWeightRecord[],
): WorkoutDayHistory[] {
  const sortedWorkouts = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
  const bodyWeightIndex = createBodyWeightIndex(bodyWeightRecords);
  const grouped = new Map<string, WorkoutDayHistory>();

  for (const workout of sortedWorkouts) {
    let day = grouped.get(workout.date);
    if (!day) {
      day = { date: workout.date, exercises: [] };
      grouped.set(workout.date, day);
    }

    const bodyWeight = bodyWeightIndex.getOnOrBefore(workout.date)?.weight;
    for (const exercise of workout.exercises) {
      day.exercises.push(mapExerciseHistory(exercise, exercise.sets, bodyWeight));
    }
  }

  return [...grouped.values()];
}
