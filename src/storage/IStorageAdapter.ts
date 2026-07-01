/**
 * Low-level key-value persistence.
 * Swap AsyncStorageAdapter → SqliteStorageAdapter without changing repositories.
 */
export interface IStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
