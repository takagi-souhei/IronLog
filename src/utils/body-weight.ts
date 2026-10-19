import type { BodyWeightRecord } from "@/types";
import { isISODate } from "./date";

export interface BodyWeightIndex {
  getOnOrBefore(date: string): BodyWeightRecord | undefined;
}

export function createBodyWeightIndex(
  records: readonly BodyWeightRecord[],
): BodyWeightIndex {
  const sortedRecords = records
    .filter((record) => isISODate(record.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const cache = new Map<string, BodyWeightRecord | undefined>();

  return {
    getOnOrBefore(date) {
      if (!isISODate(date)) {
        throw new RangeError("The date must be a valid YYYY-MM-DD date.");
      }
      if (cache.has(date)) return cache.get(date);

      let low = 0;
      let high = sortedRecords.length - 1;
      let match: BodyWeightRecord | undefined;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (sortedRecords[middle].date <= date) {
          match = sortedRecords[middle];
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      cache.set(date, match);
      return match;
    },
  };
}

export function getPreviousBodyWeight(
  records: readonly BodyWeightRecord[],
  date: string,
): BodyWeightRecord | undefined {
  return createBodyWeightIndex(records).getOnOrBefore(date);
}
