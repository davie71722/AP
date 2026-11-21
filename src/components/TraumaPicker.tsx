// 創傷標籤 → 側別、評估、處置按鈕（含防呆），自動組成交接註解
import { useEffect, useRef, useState } from 'react';
import { CHEST_SIDES, entryName, LIMB_SIDES, SIDE_KIND, STATUS, TRAUMA_BY_ID, traumaListFor, keepForColor, type TraumaEntry } from '../data/trauma';
import { actState, addAct, isKeyAct, removeAct, sideLock, toggleSide } from '../data/traumaRules';
import { useStore } from '../store/store';
import type { Color } from '../types';

export function TraumaPicker({
  color,
  value,
  onChange,
  only,
  ctxSide,
}: {
  color: Color;
  value: TraumaEntry[];
  onChange: (v: TraumaEntry[]) => void;
  /** 只列這些傷勢（人形圖點部位時） */
  only?: string[];
  /** 人形圖點的肢體側別，如「右下肢」：新增四肢傷勢時自動帶入 */
  ctxSide?: string | null;
}) {
  const now = useStore((s) => s.now);
  const [armed, setArmed] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = (t: string) => {
    setHint(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => (setHint(null), setArmed(null)), 3000);
  };

  // 只顯示病人目前牌色可用的傷勢（黃綠不顯示紅牌）
  const list = traumaListFor(color).filter((d) => !only || only.includes(d.id));
  const shown = keepForColor(value, color);
  const others = only ? [] : shown.filter((t) => !list.some((d) => d.id === t.id));
  const has = (id: string) => value.find((t) => t.id === id);
  const useCtx = (id: string) => !!ctxSide && SIDE_KIND[id] === 'limb';

  const tapTrauma = (id: string) => {
    const d = TRAUMA_BY_ID[id];
    const cur = has(id);
    if (!cur) return onChange([...value, { id, name: d.name, acts: [], ...(useCtx(id) ? { sides: [ctxSide!] } : {}) }]);
    // 人形圖帶入側別：已有此傷勢時切換該側
    if (useCtx(id)) {
      const next = toggleSide(value, id, ctxSide!);
      const t = next.find((x) => x.id === id)!;
      if ((t.sides ?? []).length) return onChange(next);
    }
    // 取消傷勢：有關鍵處置時需再按一次
    if (cur.acts.some(isKeyAct) && armed !== `t:${id}`) {
      setArmed(`t:${id}`);
      return flash(`「${d.name}」含關鍵處置，再按一次取消此傷勢`);
    }
    setArmed(null);
    // 其他傷勢也有的評估／處置保留下來
    const rest = value.filter((t) => t.id !== id);
    onChange(
      rest.map((t) => {
        const def = TRAUMA_BY_ID[t.id];
        const keep = cur.acts.filter(
          (a) =>
            !rest.some((r) => r.acts.includes(a)) &&
            def?.acts.some((x) => a === x || (x.startsWith('已上止血帶') && a.startsWith('已上止血帶'))),
        );
        return keep.length ? { ...t, acts: [...t.acts, ...keep] } : t;
      }),
    );
  };

  const tapAct = (id: string, act: string) => {
    const st = actState(value, act);
    if (st.disabled) return flash(st.reason ?? '目前不可選');
    if (!st.stored) {
      setArmed(null);
      return onChange(addAct(value, id, act, now));
    }
    if (isKeyAct(st.stored) && armed !== `a:${act}`) {
      setArmed(`a:${act}`);
      return flash(`再按一次取消「${st.stored}」`);
    }
    setArmed(null);
    onChange(removeAct(value, act));
  };

  const tapSide = (id: string, side: string) => {
    const lock = sideLock(value, id, side);
    if (lock) return flash(lock);
    onChange(toggleSide(value, id, side));
  };

  const item = (id: string) => {
    const d = TRAUMA_BY_ID[id];
    const sel = has(id);
    const kind = SIDE_KIND[id];
    const ctxOff = sel && useCtx(id) && !(sel.sides ?? []).includes(ctxSide!);
    return (
      <div key={id} className={`tr-item ${sel ? 'on' : ''}`}>
        <button className={`btn sm tr-name ${sel ? 'on' : ''} ${armed === `t:${id}` ? 'armed' : ''}`} onClick={() => tapTrauma(id)}>
          {sel ? '✔ ' : ''}
          {sel ? entryName(sel) : d.name}
          {ctxOff && <span className="muted">　＋{ctxSide}</span>}
        </button>
        {sel && (
          <>
            {kind && (
              <div>
                <div className={`tr-sub ${(sel.sides ?? []).length ? '' : 'need'}`}>側別{(sel.sides ?? []).length ? '' : '（必選）'}</div>
                <div className={`tr-acts ${kind === 'limb' ? 'g4' : ''}`}>
                  {(kind === 'limb' ? LIMB_SIDES : CHEST_SIDES).map((s) => (
                    <button key={s} className={`btn sm side ${(sel.sides ?? []).includes(s) ? 'on' : ''}`} onClick={() => tapSide(id, s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(
              [
                ['評估', d.acts.filter((a) => STATUS.has(a))],
                ['處置', d.acts.filter((a) => !STATUS.has(a))],
              ] as [string, string[]][]
            ).map(([label, acts]) =>
              acts.length === 0 ? null : (
                <div key={label}>
                  <div className="tr-sub">{label}</div>
                  <div className="tr-acts">
                    {acts.map((a) => {
                      const st = actState(value, a);
                      return (
                        <button
                          key={a}
                          className={`btn sm ${st.stored ? 'on' : ''} ${st.disabled ? 'dim' : ''} ${armed === `a:${a}` ? 'armed' : ''}`}
                          aria-disabled={st.disabled}
                          title={st.reason}
                          onClick={() => tapAct(id, a)}
                        >
                          {st.stored ?? a.replace('(自動帶入時間)', '')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ),
            )}
          </>
        )}
      </div>
    );
  };

  let lastRegion = '';
  return (
    <div className="trauma">
      {hint && <div className="tr-hint">{hint}</div>}
      {others.map((t) => item(t.id))}
      {list.map((d) => {
        const head = !only && d.region && d.region !== lastRegion ? <div className="tr-region">{d.region}</div> : null;
        lastRegion = d.region ?? '';
        return (
          <div key={d.id}>
            {head}
            {item(d.id)}
          </div>
        );
      })}
    </div>
  );
}

/** 交接關鍵處置醒目色塊 */
export function KeyFlags({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <span className="key-flags">
      {flags.map((f) => (
        <b key={f} className="kf">
          {f}
        </b>
      ))}
    </span>
  );
}

/** 防呆提醒 */
export function TraumaWarnings({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="tr-warn">
      {items.map((w) => (
        <div key={w}>⚠ {w}</div>
      ))}
    </div>
  );
}
