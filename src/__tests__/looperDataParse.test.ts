import { parseLooperDataRaw } from '../storage/looperDataParse';
import { createEmptyLooperData } from '../types/looperData';

describe('parseLooperDataRaw', () => {
  it('parses a valid persisted payload', () => {
    const data = createEmptyLooperData();
    const parsed = parseLooperDataRaw(JSON.stringify(data));
    expect(parsed).not.toBeNull();
    expect(parsed?.tasks).toEqual([]);
  });

  it('returns null for corrupt JSON instead of throwing', () => {
    expect(parseLooperDataRaw('{"tasks": [truncated')).toBeNull();
    expect(parseLooperDataRaw('not-json')).toBeNull();
    expect(parseLooperDataRaw('')).toBeNull();
  });

  it('returns null for non-object payloads', () => {
    expect(parseLooperDataRaw('"a string"')).toBeNull();
    expect(parseLooperDataRaw('[1, 2, 3]')).toBeNull();
    expect(parseLooperDataRaw('null')).toBeNull();
    expect(parseLooperDataRaw('42')).toBeNull();
  });
});
