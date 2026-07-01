import { LooperDecisionsV3, LooperDataV3, LOOPER_DATA_VERSION } from '../types/looperData';
import { AppSettings } from '../types/schedule';

export const LOOPER_BACKUP_FORMAT = 'looper-backup-v1';

export interface LooperBackupFile {
  format: typeof LOOPER_BACKUP_FORMAT;
  exportedAt: string;
  appVersion: string;
  data: LooperDataV3;
  decisions: LooperDecisionsV3;
}

function sanitizeSettingsForExport(settings: AppSettings): AppSettings {
  const legacy = settings as AppSettings & { geminiApiKey?: string };
  const { geminiApiKey: _removed, ...rest } = legacy;
  return { ...rest };
}

export function buildLooperBackupPayload(
  data: LooperDataV3,
  decisions: LooperDecisionsV3,
  exportedAt = new Date().toISOString()
): LooperBackupFile {
  return {
    format: LOOPER_BACKUP_FORMAT,
    exportedAt,
    appVersion: '1.0.0',
    data: {
      ...data,
      version: LOOPER_DATA_VERSION,
      settings: sanitizeSettingsForExport(data.settings),
    },
    decisions: {
      ...decisions,
      version: LOOPER_DATA_VERSION,
    },
  };
}

export function serializeLooperBackup(backup: LooperBackupFile): string {
  return JSON.stringify(backup, null, 2);
}

export function buildLooperBackupFilename(exportedAt: string): string {
  const stamp = exportedAt.slice(0, 10).replace(/-/g, '');
  return `orbit-looper-backup-${stamp}.json`;
}
