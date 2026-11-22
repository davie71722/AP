import { describe, expect, it } from 'vitest';
import { patNoFromQr } from './qr';

describe('拍拍尺 QR 內容 → 號碼', () => {
  it('純文字、網址查詢值、網址路徑', () => {
    expect(patNoFromQr(' A0123 ')).toBe('A0123');
    expect(patNoFromQr('https://example.org/tag?id=A0123')).toBe('A0123');
    expect(patNoFromQr('https://example.org/t/A0456')).toBe('A0456');
  });
});
