import type { Exercise, Workout } from "@/types";

export function prioritizeRecentlyUsedExercises(
  exercises: readonly Exercise[],
  workouts: readonly Workout[],
  includeArchived = false,
): Exercise[] {
  const lastUsed = new Map<string, { date: string; sequence: number }>();
  let sequence = 0;

  for (const workout of workouts) {
    for (const workoutExercise of workout.exercises) {
      const currentSequence = sequence++;
      const previous = lastUsed.get(workoutExercise.exerciseId);
      if (
        previous === undefined ||
        workout.date > previous.date ||
        (workout.date === previous.date && currentSequence > previous.sequence)
      ) {
        lastUsed.set(workoutExercise.exerciseId, {
          date: workout.date,
          sequence: currentSequence,
        });
      }
    }
  }

  return exercises
    .filter((exercise) => includeArchived || !exercise.isArchived)
    .map((exercise, originalIndex) => ({
      exercise,
      originalIndex,
      lastUsed: lastUsed.get(exercise.id),
    }))
    .sort((a, b) => {
      if (a.lastUsed === undefined && b.lastUsed !== undefined) return 1;
      if (a.lastUsed !== undefined && b.lastUsed === undefined) return -1;
      if (a.lastUsed && b.lastUsed) {
        const dateOrder = b.lastUsed.date.localeCompare(a.lastUsed.date);
        if (dateOrder !== 0) return dateOrder;
      }
      return a.originalIndex - b.originalIndex;
    })
    .map(({ exercise }) => exercise);
}

export function searchExercises(exercises: readonly Exercise[], query: string): Exercise[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return exercises.filter((exercise) => !exercise.isArchived);
  }

  return exercises.filter(
    (exercise) =>
      !exercise.isArchived &&
      `${exercise.name} ${exercise.category}`.toLocaleLowerCase().includes(normalizedQuery),
  );
}
