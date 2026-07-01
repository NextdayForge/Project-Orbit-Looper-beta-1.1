import { Platform, Share } from 'react-native';
import { looperDataStore } from './LooperDataStore';
import { looperDecisionsStore } from './LooperDecisionsStore';
import {
  buildLooperBackupFilename,
  buildLooperBackupPayload,
  serializeLooperBackup,
  type LooperBackupFile,
} from './looperBackupCore';

export {
  LOOPER_BACKUP_FORMAT,
  buildLooperBackupFilename,
  buildLooperBackupPayload,
  serializeLooperBackup,
  type LooperBackupFile,
} from './looperBackupCore';

export async function loadLooperBackupPayload(): Promise<LooperBackupFile> {
  await looperDataStore.flush();
  const [data, decisions] = await Promise.all([
    looperDataStore.load(),
    looperDecisionsStore.load(),
  ]);
  return buildLooperBackupPayload(data, decisions);
}

export async function shareLooperBackup(json: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') {
      throw new Error('Web export is unavailable in this environment.');
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  await Share.share({
    title: filename,
    message: json,
  });
}

export async function exportLooperBackup(): Promise<{ filename: string; json: string }> {
  const backup = await loadLooperBackupPayload();
  const json = serializeLooperBackup(backup);
  return {
    filename: buildLooperBackupFilename(backup.exportedAt),
    json,
  };
}

export async function resetLooperAppData(): Promise<void> {
  await looperDataStore.flush();
  await Promise.all([looperDataStore.reset(), looperDecisionsStore.reset()]);
}
