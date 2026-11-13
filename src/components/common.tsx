import { useEffect, useRef, useState, type ReactNode } from 'react';

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

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {children}
        <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={onClose}>
          關閉
        </button>
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
