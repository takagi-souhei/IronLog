import type {
  BodyWeightRecord,
  DailyWorkoutSummary,
  DateFilter,
  Workout,
} from "@/types";
import { effectiveWeight } from "./effective-weight";
import { estimateOneRepMax } from "./estimated-one-rep-max";
import { filterWorkoutsByDate } from "./date-filter";

export function aggregateWorkoutMetrics(
  workouts: readonly Workout[],
  bodyWeightRecords: readonly BodyWeightRecord[] = [],
  dateFilter: DateFilter = {},
): DailyWorkoutSummary[] {
  const bodyWeightsByDate = [...bodyWeightRecords].sort((a, b) => a.date.localeCompare(b.date));
  const summaries = new Map<string, DailyWorkoutSummary>();

  for (const workout of filterWorkoutsByDate(workouts, dateFilter)) {
    let summary = summaries.get(workout.date);
    if (!summary) {
      summary = {
        date: workout.date,
        workoutCount: 0,
        setCount: 0,
        volume: 0,
        estimatedOneRepMax: null,
      };
      summaries.set(workout.date, summary);
    }
    summary.workoutCount += 1;

    let bodyWeight: number | undefined;
    for (const record of bodyWeightsByDate) {
      if (record.date > workout.date) {
        break;
      }
      bodyWeight = record.weight;
    }

    for (const workoutExercise of workout.exercises) {
      for (const set of workoutExercise.sets) {
        summary.setCount += 1;
        const load = effectiveWeight(set, workoutExercise.exerciseSnapshot, bodyWeight);
        if (load === null) {
          continue;
        }

        summary.volume += load * set.reps;
        const estimatedOneRepMax = estimateOneRepMax(load, set.reps);
        if (
          estimatedOneRepMax !== null &&
          (summary.estimatedOneRepMax === null ||
            estimatedOneRepMax > summary.estimatedOneRepMax)
        ) {
          summary.estimatedOneRepMax = estimatedOneRepMax;
        }
      }
    }
  }

  return [...summaries.values()].sort((a, b) => a.date.localeCompare(b.date));
}
