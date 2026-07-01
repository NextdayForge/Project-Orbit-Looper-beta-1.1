import { AppSettings } from '../../types/schedule';

export interface ISettingsRepository {
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<AppSettings>;
  update(partial: Partial<AppSettings>): Promise<AppSettings>;
}
