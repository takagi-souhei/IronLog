import type { Identifiable, Repository } from "@/types";
import { LOCAL_STORAGE_SCHEMA_VERSION } from "@/constants/training";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StorageWrite {
  key: string;
  value: string | null;
}

export function getBrowserStorage(): StorageLike {
  if (typeof window === "undefined") {
    throw new Error("LocalStorage is only available in a browser environment.");
  }
  return window.localStorage;
}

export function commitStorageWrites(
  writes: readonly StorageWrite[],
  storage: StorageLike = getBrowserStorage(),
): void {
  const previousValues = new Map(
    writes.map(({ key }) => [key, storage.getItem(key)] as const),
  );

  try {
    for (const { key, value } of writes) {
      if (value === null) {
        storage.removeItem(key);
      } else {
        storage.setItem(key, value);
      }
    }
  } catch (cause) {
    const rollbackErrors: string[] = [];
    for (const [key, previousValue] of previousValues) {
      try {
        if (previousValue === null) {
          storage.removeItem(key);
        } else {
          storage.setItem(key, previousValue);
        }
      } catch (rollbackCause) {
        rollbackErrors.push(
          rollbackCause instanceof Error ? rollbackCause.message : String(rollbackCause),
        );
      }
    }

    const originalError = cause instanceof Error ? cause.message : String(cause);
    if (rollbackErrors.length > 0) {
      throw new Error(
        `Storage write failed (${originalError}); rollback also failed (${rollbackErrors.join(" / ")}).`,
      );
    }
    throw new Error(`Storage write failed; previous values were restored (${originalError}).`);
  }
}

type RecordValidator<T> = (value: unknown) => value is T;
type LegacyRecordMigrator<T> = (
  records: readonly unknown[],
  storage: StorageLike,
) => T[];

interface StoredCollection<T> {
  schemaVersion: typeof LOCAL_STORAGE_SCHEMA_VERSION;
  records: T[];
}

export class LocalStorageRepository<T extends Identifiable> implements Repository<T> {
  constructor(
    private readonly key: string,
    private readonly isRecord: RecordValidator<T>,
    private readonly storage?: StorageLike,
    private readonly uniqueKey?: (record: T) => string,
    private readonly legacyKey?: string,
    private readonly migrateLegacyRecords?: LegacyRecordMigrator<T>,
  ) {}

  async getAll(): Promise<T[]> {
    const storage = this.getStorage();
    const raw = storage.getItem(this.key);
    if (raw === null) {
      if (this.legacyKey !== undefined && this.migrateLegacyRecords !== undefined) {
        const legacyRaw = storage.getItem(this.legacyKey);
        if (legacyRaw !== null) {
          const legacyValue = this.parse(legacyRaw, this.legacyKey);
          if (!this.isLegacyCollection(legacyValue)) {
            throw new Error(`Stored data for "${this.legacyKey}" has an unsupported or invalid format.`);
          }

          const records = this.migrateLegacyRecords(legacyValue.records, storage);
          if (!records.every(this.isRecord) || !this.hasUniqueKeys(records)) {
            throw new Error(`Legacy data for "${this.key}" could not be migrated safely.`);
          }
          this.writeCollection(records, storage);
          return records;
        }
      }
      return [];
    }

    const value = this.parse(raw, this.key);

    if (!this.isCollection(value)) {
      throw new Error(`Stored data for "${this.key}" has an unsupported or invalid format.`);
    }
    return value.records;
  }

  async getById(id: string): Promise<T | undefined> {
    return (await this.getAll()).find((record) => record.id === id);
  }

  async save(record: T): Promise<void> {
    if (!this.isRecord(record)) {
      throw new TypeError(`Cannot save an invalid record to "${this.key}".`);
    }

    const records = await this.getAll();
    const index = records.findIndex(
      (existing) =>
        existing.id === record.id ||
        (this.uniqueKey !== undefined && this.uniqueKey(existing) === this.uniqueKey(record)),
    );
    if (index === -1) {
      records.push(record);
    } else {
      records[index] = record;
    }

    this.writeCollection(records, this.getStorage());
  }

  async delete(id: string): Promise<void> {
    const records = await this.getAll();
    const remaining = records.filter((record) => record.id !== id);
    if (remaining.length !== records.length) {
      this.writeCollection(remaining, this.getStorage());
    }
  }

  private isCollection(value: unknown): value is StoredCollection<T> {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const collection = value as { schemaVersion?: unknown; records?: unknown };
    if (
      collection.schemaVersion !== LOCAL_STORAGE_SCHEMA_VERSION ||
      !Array.isArray(collection.records) ||
      !collection.records.every(this.isRecord)
    ) {
      return false;
    }

    return this.hasUniqueKeys(collection.records);
  }

  private getStorage(): StorageLike {
    if (this.storage) {
      return this.storage;
    }
    return getBrowserStorage();
  }

  private parse(raw: string, key: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`Stored data for "${key}" is not valid JSON.`);
    }
  }

  private isLegacyCollection(value: unknown): value is { version: 1; records: unknown[] } {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    const collection = value as { version?: unknown; records?: unknown };
    return collection.version === 1 && Array.isArray(collection.records);
  }

  private writeCollection(records: T[], storage: StorageLike): void {
    const collection: StoredCollection<T> = {
      schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
      records,
    };
    storage.setItem(this.key, JSON.stringify(collection));
  }

  private hasUniqueKeys(records: readonly T[]): boolean {
    if (new Set(records.map((record) => record.id)).size !== records.length) {
      return false;
    }
    if (this.uniqueKey === undefined) {
      return true;
    }
    const uniqueKeys = records.map(this.uniqueKey);
    return new Set(uniqueKeys).size === uniqueKeys.length;
  }
}
