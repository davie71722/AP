// 個案照片：拍照後以原始大小存在本機（IndexedDB，不同步），上限 2 張；可連同送醫資訊以系統分享傳出
import { useEffect, useState } from 'react';
import { addPhoto, deletePhoto, listPhotos, MAX_PHOTOS, type PhotoRow } from '../store/db';
import { useStore } from '../store/store';
import { DoubleTapButton } from './common';

/** 原始大小保存：JPEG／PNG／WebP 直接存原檔（保留解析度與拍攝方向）；其他格式（如 HEIC）轉成原尺寸 JPEG */
export async function photoDataUrl(file: File): Promise<string> {
  if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return new Promise((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => fail(r.error);
      r.readAsDataURL(file);
    });
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** dataURL → File（分享用） */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/data:(.*?);/)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new File([buf], name, { type: mime });
}

/** 照片下方加上資訊欄（不遮住照片）：代碼、拍拍尺、送醫車輛與醫院、出發與 ETA、精簡傷勢與註解 */
export async function annotatePhoto(dataUrl: string, lines: string[]): Promise<string> {
  const img = await new Promise<HTMLImageElement>((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = fail;
    i.src = dataUrl;
  });
  const w = img.naturalWidth;
  const font = Math.max(18, Math.round(w / 28));
  const pad = Math.round(font * 0.7);
  const lh = Math.round(font * 1.35);
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const family = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  // 逐字換行（中文）
  const wrap = (text: string, bold: boolean): string[] => {
    ctx.font = `${bold ? 700 : 400} ${font}px ${family}`;
    const out: string[] = [];
    let cur = '';
    for (const ch of text) {
      if (ctx.measureText(cur + ch).width > w - pad * 2 && cur) {
        out.push(cur);
        cur = ch;
      } else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  };
  const rows = lines.flatMap((l, i) => wrap(l, i === 0).map((t) => ({ t, bold: i === 0 })));
  const band = pad * 2 + rows.length * lh;
  c.width = w;
  c.height = img.naturalHeight + band;
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, img.naturalHeight, w, band);
  ctx.fillStyle = '#ff9f1a';
  ctx.fillRect(0, img.naturalHeight, w, Math.max(3, Math.round(font / 6)));
  ctx.textBaseline = 'top';
  rows.forEach((r, i) => {
    ctx.font = `${r.bold ? 700 : 400} ${font}px ${family}`;
    ctx.fillStyle = r.bold ? '#fff' : '#ddd';
    ctx.fillText(r.t, pad, img.naturalHeight + pad + i * lh + (lh - font) / 2);
  });
  return c.toDataURL('image/jpeg', 0.92);
}

/** 分享用：照片加上資訊欄後轉為檔案（預先處理，按分享時立即送出） */
export function useAnnotatedFiles(rows: PhotoRow[], linesOf: (patientId: string) => string[], nameOf: (patientId: string) => string) {
  const [out, setOut] = useState<{ files: File[]; previews: string[] }>({ files: [], previews: [] });
  const key = rows.map((r) => r.id).join(',') + '|' + rows.map((r) => linesOf(r.patientId).join('/')).join('|');
  useEffect(() => {
    let alive = true;
    void (async () => {
      const n: Record<string, number> = {};
      const previews: string[] = [];
      const files: File[] = [];
      for (const r of rows) {
        let url = r.dataUrl;
        try {
          url = await annotatePhoto(r.dataUrl, linesOf(r.patientId));
        } catch {
          /* 加工失敗就用原圖 */
        }
        previews.push(url);
        files.push(dataUrlToFile(url, `${nameOf(r.patientId)}-${(n[r.patientId] = (n[r.patientId] ?? 0) + 1)}.jpg`));
      }
      if (alive) setOut({ files, previews });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return out;
}

/** 讀取多位病人的照片（照片變動時自動重讀） */
export function usePhotos(patientIds: string[]): PhotoRow[] {
  const rev = useStore((s) => s.photoRev);
  const key = patientIds.join(',');
  const [rows, setRows] = useState<PhotoRow[]>([]);
  useEffect(() => {
    let alive = true;
    void Promise.all(patientIds.map((id) => listPhotos(id))).then((r) => alive && setRows(r.flat()));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rev]);
  return rows;
}

export function PhotoSection({ patientId, readOnly = false }: { patientId: string; readOnly?: boolean }) {
  const rows = usePhotos([patientId]);
  const bump = useStore((s) => s.bumpPhotos);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const full = rows.length >= MAX_PHOTOS;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const ok = await addPhoto(patientId, await photoDataUrl(f));
      setMsg(ok ? '' : `最多 ${MAX_PHOTOS} 張`);
      bump();
    } catch {
      setMsg('照片讀取失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3>
        照片 <span className="muted small">{rows.length}/{MAX_PHOTOS}｜原始大小，存在本機，可隨送醫資訊分享</span>
      </h3>
      <div className="photos">
        {rows.map((r) => (
          <div key={r.id} className="photo">
            <img src={r.dataUrl} alt="個案照片" onClick={() => setView(r.dataUrl)} />
            {!readOnly && (
              <DoubleTapButton className="sm" armedText="再按刪除" onConfirm={async () => (await deletePhoto(r.id), bump())}>
                刪除
              </DoubleTapButton>
            )}
          </div>
        ))}
        {!readOnly && !full && (
          <label className={`btn photo-add ${busy ? 'dim' : ''}`}>
            {busy ? '處理中…' : '📷 拍照'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {msg && <p className="small" style={{ color: 'var(--orange)', margin: '4px 0 0' }}>{msg}</p>}
      {view && (
        <div className="photo-view" onClick={(e) => (e.stopPropagation(), setView(null))}>
          <img src={view} alt="個案照片（原始大小）" />
          <span>點一下關閉｜可雙指放大</span>
        </div>
      )}
    </>
  );
}
