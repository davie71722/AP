import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { HospitalRuntime } from '../types';
import { beginEdit, cancelEdit, commitEdit } from '../store/store';
import { audit } from '../security/consent';

/** 連按兩次確認（不使用瀏覽器 confirm） */
export function DoubleTapButton({
  children,
  armedText = '再按一次確認',
  onConfirm,
  className = '',
}: {
  children: ReactNode;
  armedText?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button
      className={`btn danger ${armed ? 'armed' : ''} ${className}`}
      onClick={() => {
        if (armed) {
          clearTimeout(t.current);
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          t.current = setTimeout(() => setArmed(false), 3000);
        }
      }}
    >
      {armed ? armedText : children}
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  format = (v: number) => String(v),
  small = false,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  small?: boolean;
}) {
  const cls = `btn ${small ? 'sm' : ''}`;
  return (
    <span className="stepper">
      <button className={cls} disabled={value - step < min - 1e-9} onClick={() => onChange(+(value - step).toFixed(2))}>
        −
      </button>
      <span className="val">{format(value)}</span>
      <button className={cls} disabled={value + step > max + 1e-9} onClick={() => onChange(+(value + step).toFixed(2))}>
        ＋
      </button>
    </span>
  );
}

/**
 * 彈出視窗：左「返回（不存檔）」還原開啟前的資料，右「確認」保留；點視窗外等同確認。
 * 視窗內直接完成的動作（如出發、刪除）呼叫 onClose 視同確認。
 */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const token = useRef<number | null>(null);
  useEffect(() => {
    token.current = beginEdit();
    return () => {
      // 未明確返回者一律視為確認
      if (token.current !== null) commitEdit(token.current);
      token.current = null;
    };
  }, []);
  const confirm = () => {
    if (token.current !== null) commitEdit(token.current);
    token.current = null;
    onClose();
  };
  const cancel = () => {
    if (token.current !== null) cancelEdit(token.current);
    token.current = null;
    onClose();
  };
  return (
    <div className="sheet-bg" onClick={confirm}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {children}
        <div className="sheet-actions">
          <button className="btn" onClick={cancel}>
            ← 返回（不存檔）
          </button>
          <button className="btn primary" onClick={confirm}>
            ✔ 確認
          </button>
        </div>
      </div>
    </div>
  );
}

export function fmtMin(m: number): string {
  return `${Math.round(m)}′`;
}

export function clockAfter(now: number, min: number): string {
  const d = new Date(now + min * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 即時已後送牌數：2紅 1黃 2綠（含自行到院） */
export function SentCounts({ rt, names }: { rt: HospitalRuntime; names: Record<'R' | 'Y' | 'G', string> }) {
  return (
    <span className="sent-counts">
      {(['R', 'Y', 'G'] as const).map((c) => {
        const n = rt.used[c] + rt.selfPresented[c];
        return (
          <b key={c} className={`sc ${c} ${n === 0 ? 'zero' : ''}`}>
            {n}
            {/\d$/.test(names[c]) ? ' ' : ''}
            {names[c]}
          </b>
        );
      })}
    </span>
  );
}

/** 複製文字（舊瀏覽器退回 execCommand） */
export async function copyText(text: string) {
  audit('複製', text.split('\n')[0]);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

/** LINE 分享連結（手機有 LINE 時直接開啟選擇聊天室） */
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

/** 系統分享（iOS／Android 分享面板）；有照片且支援時一併分享。不支援或被嵌入頁擋下時回傳 false */
export async function systemShare(text: string, files: File[] = []): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  audit('分享（系統分享選單）', `${text.split('\n')[0]}${files.length ? `｜照片 ${files.map((f) => f.name).join('、')}` : ''}`);
  try {
    const withFiles = files.length > 0 && !!navigator.canShare?.({ text, files });
    await navigator.share(withFiles ? { text, files } : { text });
    return true;
  } catch (e) {
    // 使用者取消也算處理完成
    return (e as Error)?.name === 'AbortError';
  }
}

/** 複製／分享（系統分享面板，不支援時改為複製）／LINE */
export function ShareButtons({
  text,
  copyLabel = '📋 複製',
  small = false,
  className = '',
  files = [],
}: {
  text: string;
  copyLabel?: string;
  small?: boolean;
  className?: string;
  /** 照片（預先讀好，按下分享時立即送出） */
  files?: File[];
}) {
  const [msg, setMsg] = useState('');
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(t.current), []);
  const flash = (m: string) => {
    setMsg(m);
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(''), 2500);
  };
  const sz = small ? 'sm' : '';
  return (
    <>
    <div className={`share-row ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        className={`btn ${sz} primary`}
        onClick={async () => {
          await copyText(text);
          flash('✔ 已複製');
        }}
      >
        {msg === '✔ 已複製' ? msg : copyLabel}
      </button>
      <button
        className={`btn ${sz}`}
        onClick={async () => {
          if (await systemShare(text, files)) return;
          await copyText(text);
          flash('已複製，可貼到 LINE');
        }}
      >
        {msg === '已複製，可貼到 LINE' ? msg : `📤 分享${files.length ? `＋${files.length}📷` : ''}`}
      </button>
      <a className={`btn ${sz} line-btn`} href={lineShareUrl(text)} target="_blank" rel="noreferrer" onClick={() => audit('LINE 分享文字', text.split('\n')[0])}>
        LINE
      </a>
    </div>
    <ShareNotice />
    </>
  );
}

/** 分享提醒：經核准之通報管道，僅限指定醫院或指揮群組 */
export function ShareNotice() {
  return <p className="share-notice">🔒 僅限傳送指定醫院或指揮群組，嚴禁轉傳</p>;
}

/** 存檔到手機（分享面板被擋時的備援） */
export function saveFile(file: File) {
  audit('存到手機', file.name);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 合成照片分享到 LINE：開手機分享面板（選 LINE）；被擋時存到手機再從 LINE 傳 */
export function LinePhotoButton({ files, className = '' }: { files: File[]; className?: string }) {
  const [msg, setMsg] = useState('');
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(t.current), []);
  if (!files.length) return null;
  return (
    <>
      <button
        className={`btn line-btn ${className}`}
        onClick={async (e) => {
          e.stopPropagation();
          let ok = false;
          if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files })) {
            try {
              audit('LINE 分享照片', files.map((f) => f.name).join('、'));
              await navigator.share({ files });
              ok = true;
            } catch (err) {
              ok = (err as Error)?.name === 'AbortError';
            }
          }
          if (!ok) {
            files.forEach(saveFile);
            setMsg('已存到手機，請在 LINE 選照片傳送');
            clearTimeout(t.current);
            t.current = setTimeout(() => setMsg(''), 4000);
          }
        }}
      >
        LINE 分享照片{files.length > 1 ? `（${files.length} 張）` : ''}
      </button>
      {msg && <p className="small" style={{ margin: '4px 0 0', color: 'var(--orange)' }}>{msg}</p>}
    </>
  );
}

/** 合成照片動作：LINE 分享照片＋存到手機 */
export function PhotoActions({ files, small = false }: { files: File[]; small?: boolean }) {
  const [saved, setSaved] = useState(false);
  if (!files.length) return null;
  return (
    <>
    <div className="photo-actions mt8">
      <LinePhotoButton files={files} className={small ? 'sm' : ''} />
      <button
        className={`btn ${small ? 'sm' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          files.forEach(saveFile);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }}
      >
        {saved ? '✔ 已存' : `💾 存到手機${files.length > 1 ? `（${files.length}）` : ''}`}
      </button>
    </div>
    <ShareNotice />
    </>
  );
}

/** 案件的合成照片：縮圖＋全部 LINE 分享／存到手機 */
export function CaseComposites({ previews, files, title = '合成照片' }: { previews: string[]; files: File[]; title?: string }) {
  if (!previews.length) return null;
  return (
    <>
      <div className="tr-sub" style={{ marginTop: 10 }}>
        {title}（{previews.length} 張，已存在案件中）
      </div>
      <div className="thumbs">
        {previews.map((u, i) => (
          <img key={i} src={u} alt="合成照片" />
        ))}
      </div>
      <PhotoActions files={files} />
    </>
  );
}
