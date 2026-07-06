import { LooperDataV3 } from '../types/looperData';

/**
 * Pure parse for persisted looper-data payloads. Kept free of React Native
 * imports so jest can cover the corrupt-data path (same pattern as
 * looperBackupCore).
 *
 * Returns null instead of throwing: a corrupt payload must degrade to
 * migration/empty data, never brick every subsequent load().
 */
export function parseLooperDataRaw(raw: string): Partial<LooperDataV3> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Partial<LooperDataV3>;
  } catch {
    return null;
  }
}
