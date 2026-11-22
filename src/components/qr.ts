// 從照片讀 QR Code：優先用瀏覽器內建 BarcodeDetector（Android Chrome），否則用 jsQR（iPhone）
import jsQR from 'jsqr';

/** 解出 QR 內容；找不到回傳 null */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  const bmp = await loadImage(file);
  type BD = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
  const Ctor = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BD }).BarcodeDetector;
  if (Ctor) {
    try {
      const r = await new Ctor({ formats: ['qr_code'] }).detect(bmp);
      if (r[0]?.rawValue) return r[0].rawValue;
    } catch {
      /* 改用 jsQR */
    }
  }
  // jsQR：依序以不同解析度嘗試（太大很慢、太小讀不到）
  for (const max of [1000, 1600, 600]) {
    const k = Math.min(1, max / Math.max(bmp.naturalWidth, bmp.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.naturalWidth * k);
    c.height = Math.round(bmp.naturalHeight * k);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const r = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
    if (r?.data) return r.data;
  }
  return null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((ok, fail) => {
    const i = new Image();
    i.onload = () => (URL.revokeObjectURL(url), ok(i));
    i.onerror = (e) => (URL.revokeObjectURL(url), fail(e));
    i.src = url;
  });
}

/** QR 內容 → 拍拍尺號碼：網址取最後一個查詢值或路徑段，其餘取整段文字 */
export function patNoFromQr(text: string): string {
  const t = text.trim();
  try {
    const u = new URL(t);
    const qs = [...u.searchParams.values()].filter(Boolean);
    if (qs.length) return qs[qs.length - 1].slice(0, 30);
    const seg = u.pathname.split('/').filter(Boolean);
    if (seg.length) return decodeURIComponent(seg[seg.length - 1]).slice(0, 30);
  } catch {
    /* 不是網址 */
  }
  return t.slice(0, 30);
}
