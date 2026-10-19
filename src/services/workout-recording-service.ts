import {
  bodyWeightRepository,
  deleteWorkoutSession,
  ensureInitialExercises,
  exerciseRepository,
  saveWorkoutSession,
  workoutDraftRepository,
  workoutRepository,
} from "@/repositories";
import type { BodyWeightRecord, Exercise, Workout, WorkoutDraft } from "@/types";
import { getPreviousBodyWeight } from "@/utils";
import { WORKOUT_SET_LIMITS } from "@/constants/training";

export interface WorkoutRecordingData {
  exercises: Exercise[];
  workouts: Workout[];
  bodyWeightRecords: BodyWeightRecord[];
  workoutForDate?: Workout;
  previousBodyWeight?: BodyWeightRecord;
}

export async function loadWorkoutRecordingData(date: string): Promise<WorkoutRecordingData> {
  await ensureInitialExercises();
  const [exercises, workouts, bodyWeightRecords] = await Promise.all([
    exerciseRepository.getAll(),
    workoutRepository.getAll(),
    bodyWeightRepository.getAll(),
  ]);

  return {
    exercises,
    workouts,
    bodyWeightRecords,
    workoutForDate: workouts.find((workout) => workout.date === date),
    previousBodyWeight: getPreviousBodyWeight(
      bodyWeightRecords.filter((record) => record.date < date),
      date,
    ),
  };
}

export async function saveWorkoutRecording(
  workout: Workout | undefined,
  bodyWeight: number,
  date: string,
  workoutIdToDelete?: string,
): Promise<void> {
  if (!Number.isFinite(bodyWeight) || bodyWeight <= 0) {
    throw new RangeError("体重は0より大きい数値を入力してください。");
  }
  if (
    workout?.exercises.some(
      (exercise) =>
        exercise.sets.length === 0 ||
        exercise.sets.some(
          (set) =>
            !Number.isInteger(set.reps) ||
            set.reps < WORKOUT_SET_LIMITS.minReps ||
            set.reps > WORKOUT_SET_LIMITS.maxReps ||
            !Number.isInteger(set.externalWeight) ||
            set.externalWeight < WORKOUT_SET_LIMITS.minWeight ||
            set.externalWeight > WORKOUT_SET_LIMITS.maxWeight,
        ),
    )
  ) {
    throw new RangeError("各種目に有効なセット（重量 −100〜300 kg、回数1〜30）を設定してください。");
  }

  await saveWorkoutSession(
    workout,
    {
      id: `bodyweight-${date}`,
      date,
      weight: bodyWeight,
    },
    workoutIdToDelete,
  );
}

export async function addExercise(exercise: Exercise): Promise<void> {
  await exerciseRepository.save(exercise);
}

export async function deleteWorkoutRecording(workoutId: string): Promise<void> {
  await deleteWorkoutSession(workoutId);
}

export function loadWorkoutDraft(): WorkoutDraft | undefined {
  return workoutDraftRepository.load();
}

export function saveWorkoutDraft(draft: WorkoutDraft): void {
  workoutDraftRepository.save(draft);
}

export function clearWorkoutDraft(): void {
  workoutDraftRepository.clear();
}
