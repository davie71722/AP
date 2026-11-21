// 後送官創傷標籤與院前處置快捷註解（依「創傷標籤與院前處置快捷註解規格書」）
import type { Color } from '../types';

/** 點選時自動帶入當下時間 HH:MM */
export const TQ = '已上止血帶(自動帶入時間)';

export interface TraumaDef {
  id: string;
  name: string;
  /** 紅牌依部位分組 */
  region?: string;
  acts: string[];
}

const IV2 = '已打雙線IV';
const IO = '已打骨針IO';
const TXA = '已給Transamin';
const BLOOD = '已輸血';
const NALB = '已給Nalbuphine';
const BVM = 'BVM給氧';
const NRM = 'NRM給氧';
const ETT = '已插氣管內管';
const RIDE = '可搭坐車';

export const TRAUMA: Record<'R' | 'Y' | 'G', TraumaDef[]> = {
  R: [
    { id: 'r-head', region: '頭部', name: '重度頭部外傷', acts: ['意識不清', '瞳孔不等大', '意識持續下降', '已抽吸', ETT, '已放聲門上呼吸道', BVM] },
    { id: 'r-face', region: '顏面', name: '顏面嚴重創傷', acts: ['氣道受阻風險', '已抽吸', ETT, BVM, '加壓止血'] },
    { id: 'r-inhal', region: '頸部', name: '吸入性灼傷', acts: ['聲音沙啞/喘鳴', '預防性插管完成', NRM, BVM] },
    { id: 'r-neckpen', region: '頸部', name: '頸部穿刺/血腫', acts: ['局部加壓止血', ETT, '已行環甲膜切開', '已打大口徑IV'] },
    { id: 'r-cspine', region: '頸部', name: '疑頸椎損傷', acts: ['四肢癱瘓/無力', '已上頸圈及頭部固定', '已上長背板/鏟式擔架'] },
    { id: 'r-ptx', region: '胸部', name: '氣胸/血胸', acts: ['已針刺減壓(左)', '已針刺減壓(右)', '已貼胸部封閉敷料', NRM, BVM] },
    { id: 'r-flail', region: '胸部', name: '連枷胸/穿刺傷', acts: ['呼吸窘迫', '已貼胸部封閉敷料', NRM, BVM, '已打大口徑IV', BLOOD] },
    { id: 'r-abd', region: '腹部', name: '腹部嚴重創傷', acts: ['疑內出血/休克', IV2, IO, TXA, BLOOD] },
    { id: 'r-evisc', region: '腹部', name: '臟器外露', acts: ['臟器NS濕紗覆蓋', IV2, IO, TXA, BLOOD] },
    { id: 'r-pelvis', region: '骨盆', name: '不穩定骨盆骨折', acts: ['已上骨盆固定帶', IV2, IO, TXA, BLOOD] },
    { id: 'r-art', region: '四肢', name: '動脈大出血', acts: [TQ, '已填塞止血紗布', IV2, TXA, BLOOD] },
    { id: 'r-amp', region: '四肢', name: '創傷性截肢/壓砸', acts: [TQ, '斷肢低溫保存隨行', NALB, '已打IV', BLOOD] },
    { id: 'r-femur', region: '四肢', name: '雙側股骨骨折', acts: ['已上牽引固定器', IV2, NALB, TXA, BLOOD] },
    { id: 'r-burn', region: '全身', name: '大面積燒燙傷(>20%)', acts: ['無菌乾紗/燒傷敷料覆蓋', '已保溫防失溫', '已打IV/IO輸液', NALB, NRM] },
    { id: 'r-shock', region: '全身', name: '高能量創傷合併休克', acts: ['全身脊椎固定完成', IV2, IO, TXA, BLOOD] },
  ],
  Y: [
    { id: 'y-fx', name: '單一肢體骨折/脫臼', acts: ['已副木/夾板固定', '三角巾懸吊', '遠端脈搏正常', NALB] },
    { id: 'y-openfx', name: '開放性骨折(已止血)', acts: ['無菌敷料覆蓋', '已副木固定', '遠端脈搏正常', '已打IV', NALB] },
    { id: 'y-burn', name: '中度燒燙傷(10-20%)', acts: ['已沖水降溫', '無菌敷料覆蓋', NALB, 'Mask給氧'] },
    { id: 'y-lac', name: '較大撕裂/穿刺(無休克)', acts: ['彈性繃帶加壓止血', '無菌敷料包紮', '已打IV'] },
    { id: 'y-spine', name: '背痛/頸痛(無癱瘓)', acts: ['已上頸圈', '已上長背板/真空墊', '四肢肌力正常'] },
    { id: 'y-head', name: '頭部撞擊(意識清楚)', acts: ['傷口加壓包紮', '曾短暫昏迷', '生命徵象穩定'] },
  ],
  G: [
    { id: 'g-abr', name: '表淺擦傷/挫傷', acts: ['NS清洗傷口', '已貼敷料/紗布', RIDE] },
    { id: 'g-lac', name: '小面積撕裂傷(已止血)', acts: ['已加壓止血包紮', '行走無礙', RIDE] },
    { id: 'g-sprain', name: '輕微扭傷/肢體疼痛', acts: ['已彈性繃帶包紮', '患肢抬高/冰敷', RIDE] },
    { id: 'g-burn', name: '小面積二度燒傷(<10%)', acts: ['已冷水降溫', '無菌紗布覆蓋', RIDE] },
  ],
};

export const TRAUMA_BY_ID: Record<string, TraumaDef> = Object.fromEntries(
  Object.values(TRAUMA)
    .flat()
    .map((t) => [t.id, t]),
);

export function traumaListFor(c: Color): TraumaDef[] {
  return c === 'K' ? [] : TRAUMA[c];
}

/** 病人身上已點選的創傷：處置以實際文字儲存（止血帶含時間） */
export interface TraumaEntry {
  id: string;
  name: string;
  acts: string[];
}

/** 處置按鈕 → 實際寫入的文字 */
export function actText(act: string, now: number): string {
  if (act !== TQ) return act;
  const d = new Date(now);
  return `已上止血帶(${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')})`;
}

/** 已選處置是否對應此按鈕（止血帶以前綴比對） */
export function actMatches(stored: string, act: string): boolean {
  return act === TQ ? stored.startsWith('已上止血帶(') : stored === act;
}

/** 生理狀態（先列，與處置間以「，」分隔） */
const STATUS = new Set(['意識不清', '瞳孔不等大', '意識持續下降', '氣道受阻風險', '聲音沙啞/喘鳴', '四肢癱瘓/無力', '呼吸窘迫', '疑內出血/休克']);

/** 依按鈕順序排列 */
function ordered(t: TraumaEntry): string[] {
  const def = TRAUMA_BY_ID[t.id];
  if (!def) return t.acts;
  const idx = (a: string) => {
    const i = def.acts.findIndex((d) => actMatches(a, d));
    return i < 0 ? 99 : i;
  };
  return [...t.acts].sort((a, b) => idx(a) - idx(b));
}

/** 單一傷勢：創傷名稱，狀態1、狀態2，處置1、處置2（「可搭坐車」以逗號另接） */
export function traumaSegment(t: TraumaEntry): string {
  const acts = ordered(t);
  const groups = [acts.filter((a) => STATUS.has(a)), acts.filter((a) => !STATUS.has(a) && a !== RIDE), acts.filter((a) => a === RIDE)]
    .filter((g) => g.length)
    .map((g) => g.join('、'));
  return [t.name, ...groups].join('，');
}

/** 多重傷勢以「；」分隔，句尾「。」 */
export function traumaText(list: TraumaEntry[] | undefined): string {
  if (!list?.length) return '';
  return list.map(traumaSegment).join('；') + '。';
}

/** 交接關鍵處置：醒目標示 */
const KEY_ACTS: [RegExp, string][] = [
  [/^已插氣管內管$|^預防性插管完成$/, '插管'],
  [/^已針刺減壓/, '針刺減壓'],
  [/^已上止血帶\((\d\d:\d\d)\)$/, '止血帶'],
  [/^已上骨盆固定帶$/, '骨盆固定帶'],
  [/^已輸血$/, '輸血'],
  [/^已給Nalbuphine$/, 'Nalbuphine'],
];

export function keyFlags(list: TraumaEntry[] | undefined): string[] {
  const out: string[] = [];
  for (const t of list ?? []) {
    for (const a of t.acts) {
      for (const [re, name] of KEY_ACTS) {
        const m = a.match(re);
        if (!m) continue;
        const label = name === '止血帶' ? `止血帶 ${m[1]}` : name === '針刺減壓' ? a.replace('已', '') : name;
        if (!out.includes(label)) out.push(label);
      }
    }
  }
  return out;
}
