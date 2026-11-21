// 創傷標籤 → 專屬處置按鈕，自動組成交接註解
import { ADV_AIRWAY, MASK_O2, STATUS, actMatches, actText, hasAdvAirway, patientActs, TRAUMA_BY_ID, traumaListFor, type TraumaEntry } from '../data/trauma';
import { useStore } from '../store/store';
import type { Color } from '../types';

export function TraumaPicker({ color, value, onChange }: { color: Color; value: TraumaEntry[]; onChange: (v: TraumaEntry[]) => void }) {
  // 整合註解改在病人視窗下方顯示
  const now = useStore((s) => s.now);
  const list = traumaListFor(color);
  // 改色前選的創傷（如黃升紅）仍顯示
  const others = value.filter((t) => !list.some((d) => d.id === t.id));
  const has = (id: string) => value.find((t) => t.id === id);

  const toggleTrauma = (id: string) => {
    const d = TRAUMA_BY_ID[id];
    const cur = has(id);
    if (!cur) return onChange([...value, { id, name: d.name, acts: [] }]);
    // 取消傷勢：其他傷勢也有的評估／處置保留到其他傷勢
    const rest = value.filter((t) => t.id !== id);
    const moved = rest.map((t) => {
      const def = TRAUMA_BY_ID[t.id];
      const add = cur.acts.filter((a) => !t.acts.includes(a) && def?.acts.some((x) => actMatches(a, x)) && !rest.some((r) => r.acts.includes(a)));
      return add.length ? { ...t, acts: [...t.acts, ...add] } : t;
    });
    onChange(moved);
  };
  const all = patientActs(value);
  const adv = hasAdvAirway(value);
  /** 同一處置以病人為單位：任一傷勢點過即算已選；取消時全部移除 */
  const toggleAct = (id: string, act: string) => {
    const on = all.some((a) => actMatches(a, act));
    if (on) return onChange(value.map((t) => ({ ...t, acts: t.acts.filter((a) => !actMatches(a, act)) })));
    const text = actText(act, now);
    const becomesAdv = ADV_AIRWAY.includes(text);
    onChange(
      value.map((t) => {
        // 進階呼吸道建立後移除 NRM／Mask 給氧
        const acts = becomesAdv ? t.acts.filter((a) => !MASK_O2.includes(a)) : t.acts;
        return t.id === id ? { ...t, acts: [...acts, text] } : { ...t, acts };
      }),
    );
  };

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
                      const stored = all.find((x) => actMatches(x, a));
                      const off = adv && MASK_O2.includes(a);
                      return (
                        <button
                          key={a}
                          className={`btn sm ${stored ? 'on' : ''} ${off ? 'dim' : ''}`}
                          disabled={off}
                          onClick={() => toggleAct(id, a)}
                        >
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
