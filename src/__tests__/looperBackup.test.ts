import { buildLooperBackupPayload, serializeLooperBackup } from '../storage/looperBackupCore';
import { createEmptyLooperData } from '../types/looperData';
import { DEFAULT_SETTINGS } from '../types/schedule';
import { makeSession, makeTask } from './fixtures';

describe('looperBackup', () => {
  it('redacts legacy gemini api key from exported settings', () => {
    const data = createEmptyLooperData({
      ...DEFAULT_SETTINGS,
      onboardingCompleted: true,
    });
    (data.settings as { geminiApiKey?: string }).geminiApiKey = 'secret-key';
    data.tasks = [makeTask({ id: 't1', title: '英語' })];
    data.sessions = [makeSession({ taskId: 't1', date: '2026-06-28' })];

    const backup = buildLooperBackupPayload(data, { version: 3, decisionLogs: [] });
    expect((backup.data.settings as { geminiApiKey?: string }).geminiApiKey).toBeUndefined();
    expect(backup.data.tasks).toHaveLength(1);
    expect(serializeLooperBackup(backup)).not.toContain('secret-key');
  });
});
