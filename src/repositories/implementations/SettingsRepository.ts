import { LooperDataStore } from '../../storage/LooperDataStore';
import { AppSettings, DEFAULT_SETTINGS } from '../../types/schedule';
import { ISettingsRepository } from '../interfaces/ISettingsRepository';

export class SettingsRepository implements ISettingsRepository {
  constructor(private readonly store: LooperDataStore) {}

  async get(): Promise<AppSettings> {
    const data = await this.store.load();
    return { ...DEFAULT_SETTINGS, ...data.settings };
  }

  async save(settings: AppSettings): Promise<AppSettings> {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    await this.store.mutate((data) => {
      data.settings = merged;
    });
    return merged;
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const data = await this.store.load();
    const merged = { ...DEFAULT_SETTINGS, ...data.settings, ...partial };
    await this.store.mutate((next) => {
      next.settings = merged;
    });
    return merged;
  }
}
