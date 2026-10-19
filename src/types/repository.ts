export interface Identifiable {
  id: string;
}

export interface Repository<T extends Identifiable> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  save(record: T): Promise<void>;
  delete(id: string): Promise<void>;
}
