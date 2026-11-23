import { describe, expect, it } from 'vitest';
import { validName } from './consent';

describe('操作人員姓名檢查', () => {
  it('中文全名可、純數字與特殊符號不可', () => {
    expect(validName('王小明')).toBe(true);
    expect(validName('歐陽 娜娜')).toBe(true);
    expect(validName('Wang Xiaoming')).toBe(true);
    expect(validName('')).toBe(false);
    expect(validName('王')).toBe(false);
    expect(validName('12345')).toBe(false);
    expect(validName('王小明!')).toBe(false);
    expect(validName('@@')).toBe(false);
  });
});
