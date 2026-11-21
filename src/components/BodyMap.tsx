// 外傷人形圖：點部位 → 點傷勢，產生傷口描述（資料與規則沿用「外傷人形圖傷口紀錄」模組）
import { useState } from 'react';
import BM from '../data/bodymap.json';
import { woundText, type Color, type Wound } from '../types';
import { limbOf, regionGroups, traumaForRegion, type TraumaEntry } from '../data/trauma';
import { TraumaPicker } from './TraumaPicker';

type View = Wound['v'];
interface Region {
  key: string;
  front: string;
  back: string;
  side: 'C' | 'R' | 'L' | string;
  shape: 'r' | 'e' | string;
  x: number;
  y: number;
  w: number;
  h: number;
}
interface VImg {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  lx: number;
}

const WC: Record<string, string> = {
  擦傷: '#f59e0b',
  撕裂傷: '#dc2626',
  挫傷: '#7c3aed',
  燙傷: '#ea580c',
  '疑似骨折/脫臼': '#2563eb',
  截肢: '#111827',
};
/** 傷勢按鈕（不含感染；加入疑似骨折/脫臼） */
const TYPES = ['擦傷', '撕裂傷', '挫傷', '燙傷', '疑似骨折/脫臼', '截肢'];
/** 放大：裁掉人形外的空白 */
const VIEWBOX: Record<View, string> = { front: '30 0 140 395', back: '30 0 140 395', face: '10 25 180 295', hand: '0 0 200 395', foot: '0 0 200 395' };
const VIEWS: { id: View; name: string }[] = [
  { id: 'front', name: '正面' },
  { id: 'back', name: '背面' },
  { id: 'face', name: '臉部' },
  { id: 'hand', name: '手部' },
  { id: 'foot', name: '足部' },
];
const VIMG = BM.vimg as Record<string, VImg[]>;
const regionsOf = (v: View): Region[] => (v === 'face' ? BM.face : v === 'hand' ? BM.hand : v === 'foot' ? BM.foot : BM.body);

/** 部位 → 含左右的名稱。正面、臉、手、足：畫面左半＝病人右側；背面：畫面左半＝病人左側 */
export function regionName(s: Region, view: View): string {
  const n = view === 'back' ? s.back : s.front;
  if (s.side === 'C') return n;
  const leftHalf = s.x + s.w / 2 < 100;
  const patientLeft = view === 'back' ? leftHalf : !leftHalf;
  return (patientLeft ? '左' : '右') + n;
}

export function BodyMap({
  wounds,
  onChange,
  color,
  trauma,
  onTrauma,
}: {
  wounds: Wound[];
  onChange: (w: Wound[]) => void;
  color?: Color;
  trauma?: TraumaEntry[];
  onTrauma?: (t: TraumaEntry[]) => void;
}) {
  const [view, setView] = useState<View>('front');
  const [sel, setSel] = useState<Region | null>(null);
  const [msg, setMsg] = useState('');

  const go = (v: View) => {
    setView(v);
    setSel(null);
    setMsg('');
  };
  const pick = (s: Region) => {
    // 正面點頭面部 → 臉部；正／背面點手 → 手部、點足 → 足部（背面點頭直接選後頭部）
    if (view === 'front' && s.key === 'head') return go('face');
    if ((view === 'front' || view === 'back') && /^hd[RL]$/.test(s.key)) return go('hand');
    if ((view === 'front' || view === 'back') && /^ft[RL]$/.test(s.key)) return go('foot');
    setSel(s);
    setMsg('');
  };
  // 點傷勢即加入（撕裂傷公分、燙傷度數與 TBSA 可在清單補填，不填也可）
  const add = (type: string) => {
    if (!sel) return setMsg('請先點選人形圖上的部位');
    onChange([...wounds, { region: regionName(sel, view), type, cm: 0, deg: '', tbsa: 0, x: sel.x + sel.w / 2, y: sel.y + sel.h / 2, v: view }]);
    setMsg('');
  };
  const update = (i: number, p: Partial<Wound>) => onChange(wounds.map((w, j) => (j === i ? { ...w, ...p } : w)));

  const img = VIMG[view];
  const related = sel && color && color !== 'K' ? traumaForRegion(color, regionGroups(sel.key, view)) : [];
  return (
    <div className="bodymap">
      <div className="bm-tabs">
        {VIEWS.map((v) => (
          <button key={v.id} className={`btn sm ${view === v.id ? 'on' : ''}`} onClick={() => go(v.id)}>
            {v.name}
          </button>
        ))}
      </div>
      <div className="bm-main">
      <svg className={`bm-svg ${view}`} viewBox={VIEWBOX[view]}>
        {!img && (
          <>
            <text x={33} y={12} fontSize={9} fill="#64748b">
              {view !== 'back' ? '病人右 ←' : '病人左 ←'}
            </text>
            <text x={167} y={12} fontSize={9} fill="#64748b" textAnchor="end">
              {view !== 'back' ? '→ 病人左' : '→ 病人右'}
            </text>
          </>
        )}
        {view === 'face' && <image href={BM.faceImg} x={0} y={30} width={200} height={286.3} pointerEvents="none" />}
        {(img ?? []).map((m) => (
          <g key={m.label}>
            <image href={m.src} x={m.x} y={m.y} width={m.w} height={m.h} pointerEvents="none" />
            <text x={m.lx} y={m.y - 3} fontSize={9} fontWeight={700} fill="#2f5d62" textAnchor="middle">
              {m.label}
            </text>
          </g>
        ))}
        {regionsOf(view).map((s, i) => {
          const cls = `rg${view === 'face' || view === 'hand' || view === 'foot' ? ' fc' : ''}${sel === s ? ' sel' : ''}`;
          const title = <title>{regionName(s, view)}</title>;
          return s.shape === 'e' ? (
            <ellipse key={i} className={cls} cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} onClick={() => pick(s)}>
              {title}
            </ellipse>
          ) : (
            <rect key={i} className={cls} x={s.x} y={s.y} width={s.w} height={s.h} rx={7} onClick={() => pick(s)}>
              {title}
            </rect>
          );
        })}
        {wounds
          .filter((w) => w.v === view)
          .map((w, i) => (
            <circle key={i} cx={w.x} cy={w.y} r={6} fill={WC[w.type] ?? '#dc2626'} stroke="#fff" strokeWidth={1.5} pointerEvents="none" />
          ))}
      </svg>
      <div className="bm-types">
        <div className="bm-sel">{msg || (sel ? regionName(sel, view) : '先點部位')}</div>
        {TYPES.map((t) => (
          <button key={t} className="btn sm" disabled={!sel} onClick={() => add(t)}>
            <i style={{ background: WC[t] }} />
            {t}
          </button>
        ))}
      </div>
      </div>
      {sel && color && trauma && onTrauma && related.length > 0 && (
        <div className="bm-related">
          <div className="tr-sub">
            {regionName(sel, view)}：相關{color === 'R' ? '紅牌' : color === 'Y' ? '黃牌' : '綠牌'}傷勢與處置
          </div>
          <TraumaPicker color={color} value={trauma} onChange={onTrauma} only={related.map((d) => d.id)} ctxSide={limbOf(regionName(sel, view))} />
        </div>
      )}
      {wounds.length > 0 && (
        <div className="bm-list">
          {wounds.map((w, i) => (
            <div key={i} className="bm-item">
              <span style={{ color: WC[w.type] }}>●</span>
              <span className="t">{woundText(w)}</span>
              {w.type === '燙傷' && (
                <span className="bm-cm">
                  {['I', 'II', 'III'].map((d) => (
                    <button key={d} className={`btn sm deg ${w.deg === d ? 'on' : ''}`} onClick={() => update(i, { deg: w.deg === d ? '' : d })}>
                      {d}
                    </button>
                  ))}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.5}
                    placeholder="TBSA"
                    value={w.tbsa > 0 ? w.tbsa : ''}
                    onChange={(e) => update(i, { tbsa: Math.min(100, Math.max(0, +e.target.value || 0)) })}
                  />
                  %
                </span>
              )}
              {w.type === '撕裂傷' && (
                <span className="bm-cm">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.5}
                    placeholder="長度"
                    value={w.cm > 0 ? w.cm : ''}
                    onChange={(e) => update(i, { cm: +e.target.value || 0 })}
                  />
                  cm
                </span>
              )}
              <button className="btn sm" onClick={() => onChange(wounds.filter((_, j) => j !== i))}>
                刪除
              </button>
            </div>
          ))}
          <button className="btn sm" style={{ justifySelf: 'end' }} onClick={() => onChange([])}>
            全部清除
          </button>
        </div>
      )}
    </div>
  );
}
