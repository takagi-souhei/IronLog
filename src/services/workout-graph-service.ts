import {
  bodyWeightRepository,
  ensureInitialExercises,
  exerciseRepository,
  workoutRepository,
} from "@/repositories";
import type { BodyWeightRecord, Exercise, Workout } from "@/types";
import { effectiveWeight, estimateOneRepMax } from "@/utils";
import { createBodyWeightIndex } from "@/utils/body-weight";

export type GraphMetric = "maxWeight" | "estimatedOneRepMax";
export type GraphPeriod = "all" | "year" | "sixMonths" | "month" | "week";

export interface ExerciseGraphOption {
  id: string;
  name: string;
  category: string;
  bodyweightRatio: number;
  weightUnit: "total" | "per-hand";
}

export interface ExerciseGraphSet {
  id: string;
  externalWeight: number;
  reps: number;
  effectiveWeight: number | null;
  estimatedOneRepMax: number | null;
}

export interface ExerciseGraphPoint {
  date: string;
  value: number | null;
  estimatedOneRepMax: number | null;
  sets: ExerciseGraphSet[];
}

export interface WorkoutGraphData {
  exercises: ExerciseGraphOption[];
  pointsByExercise: Record<string, ExerciseGraphPoint[]>;
}

export async function loadWorkoutGraphData(): Promise<WorkoutGraphData> {
  await ensureInitialExercises();
  const [workouts, bodyWeightRecords, exercises] = await Promise.all([
    workoutRepository.getAll(),
    bodyWeightRepository.getAll(),
    exerciseRepository.getAll(),
  ]);
  return buildWorkoutGraphData(workouts, bodyWeightRecords, exercises);
}

export function buildWorkoutGraphData(
  workouts: readonly Workout[],
  bodyWeightRecords: readonly BodyWeightRecord[],
  exercises: readonly Exercise[] = [],
): WorkoutGraphData {
  const exerciseOptions = new Map<string, ExerciseGraphOption>(
    exercises.map(
      (exercise) =>
        [
          exercise.id,
          {
            id: exercise.id,
            name: exercise.name,
            category: exercise.category,
            bodyweightRatio: exercise.bodyweightRatio,
            weightUnit: exercise.weightUnit,
          },
        ] as const,
    ),
  );
  const pointsByExercise = new Map<string, Map<string, ExerciseGraphPoint>>();
  const bodyWeightIndex = createBodyWeightIndex(bodyWeightRecords);
  const sortedWorkouts = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  for (const workout of sortedWorkouts) {
    const bodyWeight = bodyWeightIndex.getOnOrBefore(workout.date)?.weight;

    for (const workoutExercise of workout.exercises) {
      const { exerciseId, exerciseSnapshot } = workoutExercise;
      exerciseOptions.set(exerciseId, {
        id: exerciseId,
        name: exerciseSnapshot.name,
        category: exerciseSnapshot.category,
        bodyweightRatio: exerciseSnapshot.bodyweightRatio,
        weightUnit: exerciseSnapshot.weightUnit,
      });

      let exercisePoints = pointsByExercise.get(exerciseId);
      if (!exercisePoints) {
        exercisePoints = new Map<string, ExerciseGraphPoint>();
        pointsByExercise.set(exerciseId, exercisePoints);
      }

      let point = exercisePoints.get(workout.date);
      if (!point) {
        point = {
          date: workout.date,
          value: null,
          estimatedOneRepMax: null,
          sets: [],
        };
        exercisePoints.set(workout.date, point);
      }

      for (const set of workoutExercise.sets) {
        const effective = effectiveWeight(set, exerciseSnapshot, bodyWeight);
        const estimated = effective === null ? null : estimateOneRepMax(effective, set.reps);
        point.sets.push({
          id: set.id,
          externalWeight: set.externalWeight,
          reps: set.reps,
          effectiveWeight: effective,
          estimatedOneRepMax: estimated,
        });

        const graphLoad =
          exerciseSnapshot.bodyweightRatio > 0 ? effective : set.externalWeight;
        if (graphLoad !== null && (point.value === null || graphLoad > point.value)) {
          point.value = graphLoad;
        }
        if (
          estimated !== null &&
          (point.estimatedOneRepMax === null || estimated > point.estimatedOneRepMax)
        ) {
          point.estimatedOneRepMax = estimated;
        }
      }
    }
  }

  const options = [...exerciseOptions.values()].sort(
    (a, b) =>
      a.category.localeCompare(b.category, "ja") || a.name.localeCompare(b.name, "ja"),
  );
  const serializedPoints: Record<string, ExerciseGraphPoint[]> = {};
  for (const [exerciseId, points] of pointsByExercise) {
    serializedPoints[exerciseId] = [...points.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  return { exercises: options, pointsByExercise: serializedPoints };
}

export function filterGraphPoints(
  points: readonly ExerciseGraphPoint[],
  period: GraphPeriod,
  now = new Date(),
): ExerciseGraphPoint[] {
  if (period === "all") return [...points];

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const originalDay = start.getDate();
  let monthsToSubtract = 0;
  switch (period) {
    case "year":
      monthsToSubtract = 12;
      break;
    case "sixMonths":
      monthsToSubtract = 6;
      break;
    case "month":
      monthsToSubtract = 1;
      break;
    case "week":
      start.setDate(start.getDate() - 6);
      break;
  }
  if (monthsToSubtract > 0) {
    const targetMonth = new Date(start.getFullYear(), start.getMonth() - monthsToSubtract, 1);
    const lastDayOfTargetMonth = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0,
    ).getDate();
    targetMonth.setDate(Math.min(originalDay, lastDayOfTargetMonth));
    start.setTime(targetMonth.getTime());
  }

  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return points.filter((point) => point.date >= from && point.date <= today);
}
