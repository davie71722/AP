// 個案照片：拍照後以原始大小存在本機（IndexedDB，不同步），上限 2 張；可連同送醫資訊以系統分享傳出
import { useEffect, useState } from 'react';
import { addPhoto, deletePhoto, listPhotos, type PhotoRow } from '../store/db';
import { useStore } from '../store/store';
import type { PhotoPanel } from '../report/report';
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

const BADGE: Record<string, [string, string]> = { R: ['#e53935', '#fff'], Y: ['#ffd400', '#000'], G: ['#2ecc71', '#000'], K: ['#4b5563', '#fff'] };

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = fail;
    i.src = src;
  });
}

/** 照片一、照片二並排（同高）合成一張，下方加病人資訊欄 */
export async function composePhotos(urls: string[], panel: PhotoPanel): Promise<string> {
  const imgs = await Promise.all(urls.map(loadImg));
  const H = Math.min(1600, Math.max(...imgs.map((i) => i.naturalHeight)));
  const gap = imgs.length > 1 ? Math.round(H / 80) : 0;
  const ws = imgs.map((i) => Math.round((i.naturalWidth * H) / i.naturalHeight));
  const W = ws.reduce((a, b) => a + b, 0) + gap * (imgs.length - 1);
  const font = Math.max(22, Math.round(W / 30));
  const pad = Math.round(font * 0.8);
  const lh = Math.round(font * 1.45);
  const family = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const setFont = (w: number, k = 1) => (ctx.font = `${w} ${Math.round(font * k)}px ${family}`);
  // 換行
  const labelW = (() => {
    setFont(700);
    return Math.max(...panel.rows.map(([k]) => ctx.measureText(k).width), 0) + font * 0.8;
  })();
  const wrap = (text: string, max: number): string[] => {
    setFont(400);
    const out: string[] = [];
    let cur = '';
    for (const ch of text) {
      if (ctx.measureText(cur + ch).width > max && cur) {
        out.push(cur);
        cur = ch;
      } else cur += ch;
    }
    return cur ? [...out, cur] : out;
  };
  const rows = panel.rows.map(([k, v]) => ({ k, lines: wrap(v, W - pad * 2 - labelW) }));
  const badgeH = Math.round(font * 2);
  const band = pad + badgeH + pad * 0.8 + rows.reduce((n, r) => n + r.lines.length * lh, 0) + pad;
  c.width = W;
  c.height = Math.round(H + band);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  let x = 0;
  imgs.forEach((img, i) => {
    ctx.drawImage(img, x, 0, ws[i], H);
    // 角標：照片一、照片二
    if (imgs.length > 1) {
      setFont(700, 0.7);
      const t = `照片${['一', '二'][i]}`;
      const tw = ctx.measureText(t).width + font * 0.6;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(x + pad / 2, pad / 2, tw, font * 1.1);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(t, x + pad / 2 + font * 0.3, pad / 2 + font * 0.55);
    }
    x += ws[i] + gap;
  });
  // 資訊欄
  const y0 = H;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, y0, W, band);
  const [bg, fg] = BADGE[panel.color] ?? BADGE.K;
  ctx.fillStyle = bg;
  ctx.fillRect(0, y0, W, Math.max(4, Math.round(font / 5)));
  setFont(800, 1.15);
  const bw = ctx.measureText(panel.badge).width + font * 1.2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(pad, y0 + pad, bw, badgeH, font * 0.4);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(panel.badge, pad + font * 0.6, y0 + pad + badgeH / 2);
  if (panel.side) {
    setFont(700, 1.1);
    ctx.fillStyle = '#fff';
    ctx.fillText(panel.side, pad + bw + font * 0.7, y0 + pad + badgeH / 2);
  }
  let y = y0 + pad + badgeH + pad * 0.8;
  ctx.textBaseline = 'top';
  for (const r of rows) {
    setFont(700);
    ctx.fillStyle = '#ff9f1a';
    ctx.fillText(r.k, pad, y + (lh - font) / 2);
    setFont(400);
    ctx.fillStyle = '#eee';
    r.lines.forEach((l, i) => ctx.fillText(l, pad + labelW, y + i * lh + (lh - font) / 2));
    y += r.lines.length * lh;
  }
  return c.toDataURL('image/jpeg', 0.9);
}

/** 每位病人一張合成照片（預先處理，按分享時立即送出） */
export function useComposites(rows: PhotoRow[], panelOf: (patientId: string) => PhotoPanel | null, nameOf: (patientId: string) => string) {
  const [out, setOut] = useState<{ files: File[]; previews: string[] }>({ files: [], previews: [] });
  const pids = [...new Set(rows.map((r) => r.patientId))];
  const key = rows.map((r) => r.id + r.at).join(',') + '|' + pids.map((p) => JSON.stringify(panelOf(p))).join('|');
  useEffect(() => {
    let alive = true;
    void (async () => {
      const previews: string[] = [];
      const files: File[] = [];
      for (const pid of pids) {
        const panel = panelOf(pid);
        const urls = rows.filter((r) => r.patientId === pid).map((r) => r.dataUrl);
        if (!panel || !urls.length) continue;
        try {
          const url = await composePhotos(urls, panel);
          previews.push(url);
          files.push(dataUrlToFile(url, `${nameOf(pid)}.jpg`));
        } catch {
          /* 合成失敗則略過 */
        }
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

export function PhotoSection({ patientId, panel, readOnly = false }: { patientId: string; panel: PhotoPanel; readOnly?: boolean }) {
  const rows = usePhotos([patientId]);
  const bump = useStore((s) => s.bumpPhotos);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [view, setView] = useState<string | null>(null);
  const label = useStore((s) => s.patients.find((p) => p.id === patientId)?.label ?? 'photo');
  const { previews } = useComposites(rows, () => panel, () => label);

  const onFile = async (slot: number, f: File | undefined) => {
    if (!f) return;
    setBusy(slot);
    try {
      const ok = await addPhoto(patientId, await photoDataUrl(f), slot);
      setMsg(ok ? '' : '照片儲存失敗');
      bump();
    } catch {
      setMsg('照片讀取失敗');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h3>
        照片 <span className="muted small">按格子開相機｜原始大小，存在本機</span>
      </h3>
      <div className="photos">
        {[1, 2].map((slot) => {
          const r = rows.find((x) => x.slot === slot);
          return (
            <div key={slot} className="photo">
              {r ? (
                <img src={r.dataUrl} alt={`照片${slot === 1 ? '一' : '二'}`} onClick={() => setView(r.dataUrl)} />
              ) : (
                <div className="photo-empty">照片{slot === 1 ? '一' : '二'}</div>
              )}
              {!readOnly && (
                <div className="grid g2">
                  <label className={`btn sm ${r ? '' : 'primary'} ${busy === slot ? 'dim' : ''}`}>
                    {busy === slot ? '處理中…' : r ? '重拍' : `📷 拍照${slot === 1 ? '一' : '二'}`}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={(e) => {
                        void onFile(slot, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {r ? (
                    <DoubleTapButton className="sm" armedText="再按刪除" onConfirm={async () => (await deletePhoto(r.id), bump())}>
                      刪除
                    </DoubleTapButton>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {previews[0] && (
        <>
          <div className="tr-sub" style={{ marginTop: 8 }}>合成照片（分享時送出）</div>
          <img className="composite" src={previews[0]} alt="合成照片" onClick={() => setView(previews[0])} />
        </>
      )}
      {msg && <p className="small" style={{ color: 'var(--orange)', margin: '4px 0 0' }}>{msg}</p>}
      {view && (
        <div className="photo-view" onClick={(e) => (e.stopPropagation(), setView(null))}>
          <img src={view} alt="照片（原始大小）" />
          <span>點一下關閉｜可雙指放大</span>
        </div>
      )}
    </>
  );
}
