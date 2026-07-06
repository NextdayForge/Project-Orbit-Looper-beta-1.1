import { AppSettings, DEFAULT_SETTINGS, LooperPlan } from '../types/schedule';
import { LooperDataV3, createEmptyLooperData } from '../types/looperData';
import { DEBOUNCE_MS, STORAGE_KEYS } from './keys';
import { IStorageAdapter } from './IStorageAdapter';
import { parseLooperDataRaw } from './looperDataParse';
import { defaultStorageAdapter } from './AsyncStorageAdapter';
import { debounce } from './debounce';

interface LegacyStoredV1 {
  settings?: AppSettings;
}

/**
 * Internal aggregate store for looper-data key.
 * Only repository implementations may import this module.
 */
export class LooperDataStore {
  private cache: LooperDataV3 | null = null;
  private loadPromise: Promise<LooperDataV3> | null = null;
  private readonly debouncedPersist: ReturnType<typeof debounce<() => void>>;

  constructor(private readonly adapter: IStorageAdapter = defaultStorageAdapter) {
    this.debouncedPersist = debounce(() => {
      void this.persistNow();
    }, DEBOUNCE_MS);
  }

  async load(): Promise<LooperDataV3> {
    if (this.cache) return this.clone(this.cache);
    if (this.loadPromise) return this.clone(await this.loadPromise);

    this.loadPromise = this.loadFromDisk();
    const data = await this.loadPromise;
    this.loadPromise = null;
    this.cache = data;
    return this.clone(data);
  }

  getSnapshot(): LooperDataV3 {
    if (!this.cache) {
      throw new Error('LooperDataStore: load() must be called before getSnapshot()');
    }
    return this.clone(this.cache);
  }

  async mutate(mutator: (data: LooperDataV3) => void, options?: { immediate?: boolean }): Promise<LooperDataV3> {
    const data = this.cache ?? (await this.load());
    mutator(data);
    this.cache = data;
    if (options?.immediate) {
      this.debouncedPersist.cancel();
      await this.persistNow();
    } else {
      this.debouncedPersist();
    }
    return this.clone(data);
  }

  async flush(): Promise<void> {
    this.debouncedPersist.flush();
    if (this.cache) {
      await this.persistNow();
    }
  }

  async reset(): Promise<LooperDataV3> {
    this.debouncedPersist.cancel();
    const empty = createEmptyLooperData();
    this.cache = empty;
    await this.adapter.setItem(STORAGE_KEYS.looperData, JSON.stringify(empty));
    return this.clone(empty);
  }

  private async loadFromDisk(): Promise<LooperDataV3> {
    const raw = await this.adapter.getItem(STORAGE_KEYS.looperData);
    if (raw) {
      const parsed = parseLooperDataRaw(raw);
      if (parsed) {
        return this.normalize(parsed);
      }
      // A corrupt payload must not brick every load(). Quarantine the raw
      // bytes for manual recovery, then fall through to migration/empty data.
      await this.adapter.setItem(STORAGE_KEYS.looperDataCorruptBackup, raw);
    }

    const legacyOrbitRaw = await this.adapter.getItem(STORAGE_KEYS.legacyOrbitData);
    if (legacyOrbitRaw) {
      const legacyParsed = parseLooperDataRaw(legacyOrbitRaw);
      if (legacyParsed) {
        const migrated = this.normalize(legacyParsed);
        await this.adapter.setItem(STORAGE_KEYS.looperData, JSON.stringify(migrated));
        return migrated;
      }
    }

    return this.migrateFromLegacyV1();
  }

  private async migrateFromLegacyV1(): Promise<LooperDataV3> {
    const legacyRaw = await this.adapter.getItem(STORAGE_KEYS.legacyV1);
    const base = createEmptyLooperData();

    if (!legacyRaw) {
      return base;
    }

    const existingBackup = await this.adapter.getItem(STORAGE_KEYS.legacyV1Backup);
    if (!existingBackup) {
      await this.adapter.setItem(STORAGE_KEYS.legacyV1Backup, legacyRaw);
    }

    try {
      const parsed = JSON.parse(legacyRaw) as LegacyStoredV1;
      base.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
    } catch {
      // ignore corrupt legacy payload
    }

    await this.adapter.setItem(STORAGE_KEYS.looperData, JSON.stringify(base));
    return base;
  }

  private normalize(partial: Partial<LooperDataV3>): LooperDataV3 {
    const base = createEmptyLooperData(partial.settings);
    const settings = { ...DEFAULT_SETTINGS, ...partial.settings };

    // Legacy: dayStartMinutes was replaced by wakeMinutes (v3.1).
    const legacy = partial.settings as (Partial<AppSettings> & {
      dayStartMinutes?: number;
      geminiApiKey?: string;
      orbitPlan?: LooperPlan;
    }) | undefined;
    if (legacy && typeof legacy.dayStartMinutes === 'number' && legacy.wakeMinutes === undefined) {
      settings.wakeMinutes = legacy.dayStartMinutes;
    }

    // Legacy BYOK — never persist user-provided Gemini keys.
    if ('geminiApiKey' in settings) {
      delete (settings as { geminiApiKey?: string }).geminiApiKey;
    }

    // Pre-rebrand: orbitPlan → looperPlan
    if (legacy?.orbitPlan !== undefined && settings.looperPlan === undefined) {
      settings.looperPlan = legacy.orbitPlan;
    }
    if (settings.looperPlan !== 'pro') {
      settings.looperPlan = 'free';
    }

    if (
      settings.onboardingCompleted !== true &&
      ((partial.tasks?.length ?? 0) > 0 || (partial.sessions?.length ?? 0) > 0)
    ) {
      settings.onboardingCompleted = true;
    }

    return {
      ...base,
      ...partial,
      version: 3,
      tasks: partial.tasks ?? [],
      sessions: partial.sessions ?? [],
      calendarBlocks: partial.calendarBlocks ?? [],
      reflections: partial.reflections ?? [],
      routines: partial.routines ?? [],
      userModel: partial.userModel ?? base.userModel,
      settings,
    };
  }

  private async persistNow(): Promise<void> {
    if (!this.cache) return;
    await this.adapter.setItem(STORAGE_KEYS.looperData, JSON.stringify(this.cache));
  }

  private clone(data: LooperDataV3): LooperDataV3 {
    return JSON.parse(JSON.stringify(data)) as LooperDataV3;
  }
}

export const looperDataStore = new LooperDataStore();
