import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { HospitalRuntime } from '../types';
import { beginEdit, cancelEdit, commitEdit } from '../store/store';

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

/** 系統分享（iOS／Android 分享面板）；不支援或被嵌入頁擋下時回傳 false */
export async function systemShare(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try {
    await navigator.share({ text });
    return true;
  } catch (e) {
    // 使用者取消也算處理完成
    return (e as Error)?.name === 'AbortError';
  }
}

/** 複製／分享（系統分享面板，不支援時改為複製）／LINE */
export function ShareButtons({ text, copyLabel = '📋 複製', small = false, className = '' }: { text: string; copyLabel?: string; small?: boolean; className?: string }) {
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
          if (await systemShare(text)) return;
          await copyText(text);
          flash('已複製，可貼到 LINE');
        }}
      >
        {msg === '已複製，可貼到 LINE' ? msg : '📤 分享'}
      </button>
      <a className={`btn ${sz} line-btn`} href={lineShareUrl(text)} target="_blank" rel="noreferrer">
        LINE
      </a>
    </div>
  );
}
