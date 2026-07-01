import { DecisionLog } from '../types/decisionLog';
import { LooperDecisionsV3 } from '../types/looperData';
import { DECISION_LOG_RETENTION_DAYS, STORAGE_KEYS } from './keys';
import { IStorageAdapter } from './IStorageAdapter';
import { defaultStorageAdapter } from './AsyncStorageAdapter';

function createEmptyDecisions(): LooperDecisionsV3 {
  return { version: 3, decisionLogs: [] };
}

function purgeOldLogs(logs: DecisionLog[]): DecisionLog[] {
  const cutoff = Date.now() - DECISION_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return logs.filter((log) => new Date(log.createdAt).getTime() >= cutoff);
}

/**
 * Internal store for looper-decisions key. Immediate persist (no debounce).
 */
export class LooperDecisionsStore {
  private cache: LooperDecisionsV3 | null = null;

  constructor(private readonly adapter: IStorageAdapter = defaultStorageAdapter) {}

  async load(): Promise<LooperDecisionsV3> {
    if (this.cache) return JSON.parse(JSON.stringify(this.cache)) as LooperDecisionsV3;

    const raw = await this.adapter.getItem(STORAGE_KEYS.looperDecisions);
    if (raw) {
      return this.parseAndCache(raw);
    }

    const legacyOrbitRaw = await this.adapter.getItem(STORAGE_KEYS.legacyOrbitDecisions);
    if (legacyOrbitRaw) {
      const parsed = this.parseAndCache(legacyOrbitRaw);
      await this.adapter.setItem(STORAGE_KEYS.looperDecisions, JSON.stringify(this.cache));
      return parsed;
    }

    this.cache = createEmptyDecisions();
    return JSON.parse(JSON.stringify(this.cache)) as LooperDecisionsV3;
  }

  async mutate(mutator: (data: LooperDecisionsV3) => void): Promise<LooperDecisionsV3> {
    const data = this.cache ?? (await this.load());
    mutator(data);
    data.decisionLogs = purgeOldLogs(data.decisionLogs);
    this.cache = data;
    await this.adapter.setItem(STORAGE_KEYS.looperDecisions, JSON.stringify(data));
    return JSON.parse(JSON.stringify(data)) as LooperDecisionsV3;
  }

  async reset(): Promise<LooperDecisionsV3> {
    const empty = createEmptyDecisions();
    this.cache = empty;
    await this.adapter.setItem(STORAGE_KEYS.looperDecisions, JSON.stringify(empty));
    return JSON.parse(JSON.stringify(empty)) as LooperDecisionsV3;
  }

  private parseAndCache(raw: string): LooperDecisionsV3 {
    try {
      const parsed = JSON.parse(raw) as LooperDecisionsV3;
      this.cache = {
        version: 3,
        decisionLogs: purgeOldLogs(parsed.decisionLogs ?? []),
      };
    } catch {
      this.cache = createEmptyDecisions();
    }
    return JSON.parse(JSON.stringify(this.cache)) as LooperDecisionsV3;
  }
}

export const looperDecisionsStore = new LooperDecisionsStore();
