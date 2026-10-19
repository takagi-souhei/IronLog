import type { DateFilter, Workout } from "@/types";
import { isISODate } from "./date";

export function filterWorkoutsByDate(
  workouts: readonly Workout[],
  filter: DateFilter = {},
): Workout[] {
  if (filter.from !== undefined && !isISODate(filter.from)) {
    throw new RangeError("The from date must be a valid YYYY-MM-DD date.");
  }
  if (filter.to !== undefined && !isISODate(filter.to)) {
    throw new RangeError("The to date must be a valid YYYY-MM-DD date.");
  }
  if (filter.from !== undefined && filter.to !== undefined && filter.from > filter.to) {
    throw new RangeError("The from date must not be later than the to date.");
  }

  return workouts.filter(
    ({ date }) =>
      isISODate(date) &&
      (filter.from === undefined || date >= filter.from) &&
      (filter.to === undefined || date <= filter.to),
  );
}
