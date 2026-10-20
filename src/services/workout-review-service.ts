import {
  bodyWeightRepository,
  ensureInitialExercises,
  exerciseRepository,
  workoutRepository,
} from "@/repositories";
import type { BodyWeightRecord } from "@/types";
import { buildWorkoutGraphData, type WorkoutGraphData } from "./workout-graph-service";
import {
  buildWorkoutHistory,
  type WorkoutDayHistory,
} from "./workout-history-service";

export interface BodyWeightGraphPoint {
  date: string;
  value: number;
}

export interface WorkoutReviewData {
  history: WorkoutDayHistory[];
  graphData: WorkoutGraphData;
  bodyWeightPoints: BodyWeightGraphPoint[];
}

export async function loadWorkoutReviewData(): Promise<WorkoutReviewData> {
  await ensureInitialExercises();
  const [workouts, bodyWeightRecords, exercises] = await Promise.all([
    workoutRepository.getAll(),
    bodyWeightRepository.getAll(),
    exerciseRepository.getAll(),
  ]);

  return buildWorkoutReviewData(workouts, bodyWeightRecords, exercises);
}

export function buildWorkoutReviewData(
  workouts: Parameters<typeof buildWorkoutHistory>[0],
  bodyWeightRecords: readonly BodyWeightRecord[],
  exercises: Parameters<typeof buildWorkoutGraphData>[2] = [],
): WorkoutReviewData {
  return {
    history: buildWorkoutHistory(workouts, bodyWeightRecords),
    graphData: buildWorkoutGraphData(workouts, bodyWeightRecords, exercises),
    bodyWeightPoints: [...bodyWeightRecords]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ date, weight }) => ({ date, value: weight })),
  };
}
