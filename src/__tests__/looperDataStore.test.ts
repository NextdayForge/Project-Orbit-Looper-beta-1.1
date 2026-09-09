import { LooperDataStore } from '../storage/LooperDataStore';
import { IStorageAdapter } from '../storage/IStorageAdapter';

// ts-jest hoists jest.mock() calls above the imports above, so this mock is in
// place before LooperDataStore.ts (which imports AsyncStorageAdapter.ts, and
// through it the real @react-native-async-storage/async-storage native module)
// is ever evaluated. Every test here injects its own in-memory FakeAdapter via
// the constructor instead, so the mocked default is never actually exercised.
jest.mock('../storage/AsyncStorageAdapter', () => ({
  defaultStorageAdapter: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

/** In-memory IStorageAdapter backed by a Map, so two store instances can share "disk". */
class FakeAdapter implements IStorageAdapter {
  private readonly map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.map.delete(key);
  }
}

describe('LooperDataStore — Gemini API key persistence (Web BYOK)', () => {
  it('survives a reload: normalize() no longer strips settings.geminiApiKey', async () => {
    const disk = new FakeAdapter();

    const first = new LooperDataStore(disk);
    await first.load();
    await first.mutate((data) => {
      (data.settings as { geminiApiKey?: string }).geminiApiKey = 'secret-key';
    }, { immediate: true });

    // Simulate an app reload: a fresh store instance reading the same backing storage.
    const second = new LooperDataStore(disk);
    const reloaded = await second.load();

    expect((reloaded.settings as { geminiApiKey?: string }).geminiApiKey).toBe('secret-key');
  });

  it('keeps the key through a second, unrelated mutation after reload (no silent wipe on next write)', async () => {
    const disk = new FakeAdapter();

    const first = new LooperDataStore(disk);
    await first.load();
    await first.mutate((data) => {
      (data.settings as { geminiApiKey?: string }).geminiApiKey = 'secret-key';
    }, { immediate: true });

    const second = new LooperDataStore(disk);
    await second.load();
    await second.mutate((data) => {
      data.settings.pxPerMinute = 3;
    }, { immediate: true });

    const third = new LooperDataStore(disk);
    const reloaded = await third.load();
    expect((reloaded.settings as { geminiApiKey?: string }).geminiApiKey).toBe('secret-key');
    expect(reloaded.settings.pxPerMinute).toBe(3);
  });
});
