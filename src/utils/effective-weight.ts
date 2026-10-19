import type { WorkoutExerciseSnapshot, WorkoutSet } from "@/types";

export function effectiveWeight(
  set: WorkoutSet,
  exercise: Pick<WorkoutExerciseSnapshot, "bodyweightRatio">,
  bodyWeight?: number,
): number | null {
  if (
    !Number.isFinite(set.externalWeight) ||
    !Number.isFinite(exercise.bodyweightRatio) ||
    exercise.bodyweightRatio < 0
  ) {
    throw new RangeError("Set weight and bodyweight ratio must be finite, with a non-negative ratio.");
  }

  if (exercise.bodyweightRatio === 0) {
    return set.externalWeight;
  }

  if (bodyWeight === undefined || !Number.isFinite(bodyWeight) || bodyWeight <= 0) {
    return null;
  }

  return set.externalWeight + bodyWeight * exercise.bodyweightRatio;
}
