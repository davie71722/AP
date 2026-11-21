// 創傷標籤 → 專屬處置按鈕，自動組成交接註解
import { STATUS, actMatches, actText, keyFlags, TRAUMA_BY_ID, traumaListFor, traumaText, type TraumaEntry } from '../data/trauma';
import { useStore } from '../store/store';
import type { Color } from '../types';

export function TraumaPicker({ color, value, onChange }: { color: Color; value: TraumaEntry[]; onChange: (v: TraumaEntry[]) => void }) {
  const now = useStore((s) => s.now);
  const list = traumaListFor(color);
  // 改色前選的創傷（如黃升紅）仍顯示
  const others = value.filter((t) => !list.some((d) => d.id === t.id));
  const has = (id: string) => value.find((t) => t.id === id);

  const toggleTrauma = (id: string) => {
    const d = TRAUMA_BY_ID[id];
    onChange(has(id) ? value.filter((t) => t.id !== id) : [...value, { id, name: d.name, acts: [] }]);
  };
  const toggleAct = (id: string, act: string) =>
    onChange(
      value.map((t) => {
        if (t.id !== id) return t;
        const on = t.acts.some((a) => actMatches(a, act));
        return {
          ...t,
          acts: on ? t.acts.filter((a) => !actMatches(a, act)) : [...t.acts, actText(act, now)],
        };
      }),
    );

  const item = (id: string) => {
    const d = TRAUMA_BY_ID[id];
    const sel = has(id);
    return (
      <div key={id} className={`tr-item ${sel ? 'on' : ''}`}>
        <button className={`btn sm tr-name ${sel ? 'on' : ''}`} onClick={() => toggleTrauma(id)}>
          {sel ? '✔ ' : ''}
          {d.name}
        </button>
        {sel && (
          <>
            {[
              ['評估', d.acts.filter((a) => STATUS.has(a))],
              ['處置', d.acts.filter((a) => !STATUS.has(a))],
            ].map(([label, acts]) =>
              (acts as string[]).length === 0 ? null : (
                <div key={label as string}>
                  {color === 'R' && <div className="tr-sub">{label}</div>}
                  <div className="tr-acts">
                    {(acts as string[]).map((a) => {
                      const stored = sel.acts.find((x) => actMatches(x, a));
                      return (
                        <button key={a} className={`btn sm ${stored ? 'on' : ''}`} onClick={() => toggleAct(id, a)}>
                          {stored ?? a.replace('(自動帶入時間)', '')}
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
  const flags = keyFlags(value);
  return (
    <div className="trauma">
      {others.map((t) => item(t.id))}
      {list.map((d) => {
        const head = d.region && d.region !== lastRegion ? <div className="tr-region">{d.region}</div> : null;
        lastRegion = d.region ?? '';
        return (
          <div key={d.id}>
            {head}
            {item(d.id)}
          </div>
        );
      })}
      {value.length > 0 && (
        <div className="tr-out">
          {flags.length > 0 && <KeyFlags flags={flags} />}
          {traumaText(value)}
        </div>
      )}
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
