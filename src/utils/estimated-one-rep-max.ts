import { WORKOUT_SET_LIMITS } from "@/constants/training";

export function estimateOneRepMax(weight: number, reps: number): number | null {
  if (
    !Number.isFinite(weight) ||
    weight <= 0 ||
    !Number.isInteger(reps) ||
    reps < WORKOUT_SET_LIMITS.minReps ||
    reps > WORKOUT_SET_LIMITS.maxReps
  ) {
    return null;
  }

  return weight * (1 + reps / 30);
}
