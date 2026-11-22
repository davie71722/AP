// 個案照片：拍照後壓縮存在本機（IndexedDB，不同步），上限 2 張；可連同送醫資訊以系統分享傳出
import { useEffect, useState } from 'react';
import { addPhoto, deletePhoto, listPhotos, MAX_PHOTOS, type PhotoRow } from '../store/db';
import { useStore } from '../store/store';
import { DoubleTapButton } from './common';

/** 壓縮為長邊 1024px 的 JPEG（約 100KB） */
export async function compressImage(file: File, max = 1024, quality = 0.7): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
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

/** 分享用檔案：代碼-1.jpg */
export function photoFiles(rows: PhotoRow[], labelOf: (patientId: string) => string): File[] {
  const n: Record<string, number> = {};
  return rows.map((r) => dataUrlToFile(r.dataUrl, `${labelOf(r.patientId)}-${(n[r.patientId] = (n[r.patientId] ?? 0) + 1)}.jpg`));
}

export function PhotoSection({ patientId, readOnly = false }: { patientId: string; readOnly?: boolean }) {
  const rows = usePhotos([patientId]);
  const bump = useStore((s) => s.bumpPhotos);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const full = rows.length >= MAX_PHOTOS;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const ok = await addPhoto(patientId, await compressImage(f));
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
        照片 <span className="muted small">{rows.length}/{MAX_PHOTOS}｜存在本機，可隨送醫資訊分享</span>
      </h3>
      <div className="photos">
        {rows.map((r) => (
          <div key={r.id} className="photo">
            <img src={r.dataUrl} alt="個案照片" />
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
    </>
  );
}
