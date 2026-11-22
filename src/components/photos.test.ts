import { describe, expect, it } from 'vitest';
import { asciiName } from './Photos';

describe('照片檔名', () => {
  it('英數檔名', () => {
    expect(asciiName('紅1-C')).toBe('MCI-R1-C');
    expect(asciiName('P1-3-A')).toBe('MCI-P1-3-A');
    expect(asciiName('死亡-2')).toBe('MCI-K-2');
  });
});
