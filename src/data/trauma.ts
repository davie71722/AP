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
    { id: 'r-head', region: '頭部', name: '重度頭部外傷', acts: ['意識不清', 'GCS≤8', '瞳孔不等大', '意識持續下降', '抽搐', '耳鼻流出血/腦脊髓液', '已抽吸', ETT, '已放i-gel', BVM, NRM, '已上頸圈', '頭部抬高30度'] },
    { id: 'r-face', region: '顏面', name: '顏面嚴重創傷', acts: ['氣道受阻風險', '口鼻大量出血', '牙齒/骨折碎片', '已抽吸', '已放口咽/鼻咽呼吸道', ETT, '已行環甲膜切開', BVM, NRM, '加壓止血'] },
    { id: 'r-inhal', region: '頸部', name: '吸入性灼傷', acts: ['聲音沙啞/喘鳴', '口鼻焦黑/鼻毛燒焦', '血氧<90%', '預防性插管完成', ETT, NRM, BVM] },
    { id: 'r-neckpen', region: '頸部', name: '頸部穿刺/血腫', acts: ['血腫擴大', '皮下氣腫', '氣道受阻風險', '局部加壓止血', '已貼封閉敷料', ETT, '已行環甲膜切開', '已打大口徑IV', NRM] },
    { id: 'r-cspine', region: '頸部', name: '疑頸椎損傷', acts: ['四肢癱瘓/無力', '感覺異常', '神經性休克(低血壓/心跳慢)', '已上頸圈及頭部固定', '已上長背板/鏟式擔架', NRM, '已打IV'] },
    { id: 'r-ptx', region: '胸部', name: '氣胸/血胸', acts: ['呼吸音減弱(左)', '呼吸音減弱(右)', '氣管偏移', '頸靜脈怒張', '血氧<90%', '已針刺減壓(左)', '已針刺減壓(右)', '已貼胸部封閉敷料', NRM, BVM, '已打大口徑IV'] },
    { id: 'r-flail', region: '胸部', name: '連枷胸/穿刺傷', acts: ['呼吸窘迫', '胸壁反常運動', '血氧<90%', '已貼胸部封閉敷料', '異物固定未拔除', NRM, BVM, '已打大口徑IV', BLOOD] },
    { id: 'r-abd', region: '腹部', name: '腹部嚴重創傷', acts: ['疑內出血/休克', '腹部膨脹/僵硬', '血壓<90', '心跳>120', IV2, IO, TXA, BLOOD, '已保溫防失溫'] },
    { id: 'r-evisc', region: '腹部', name: '臟器外露', acts: ['疑內出血/休克', '臟器NS濕紗覆蓋', '異物固定未拔除', IV2, IO, TXA, BLOOD, '已保溫防失溫'] },
    { id: 'r-pelvis', region: '骨盆', name: '不穩定骨盆骨折', acts: ['疑內出血/休克', '下肢長度不等/外旋', '已上骨盆固定帶', '已上長背板/鏟式擔架', IV2, IO, TXA, BLOOD, NALB] },
    { id: 'r-art', region: '四肢', name: '動脈大出血', acts: ['出血性休克', TQ, '已填塞止血紗布', '已加壓包紮', IV2, IO, TXA, BLOOD, '已保溫防失溫'] },
    { id: 'r-amp', region: '四肢', name: '創傷性截肢/壓砸', acts: ['出血性休克', '壓砸症候群風險', TQ, '斷肢低溫保存隨行', NALB, '已打IV', IV2, TXA, BLOOD] },
    { id: 'r-femur', region: '四肢', name: '股骨骨折', acts: ['出血性休克', '遠端脈搏消失', '已上牽引固定器', IV2, IO, NALB, TXA, BLOOD] },
    { id: 'r-burn', region: '全身', name: '大面積燒燙傷(>20%)', acts: ['吸入性灼傷疑慮', '環狀燒傷', '無菌乾紗/燒傷敷料覆蓋', '已保溫防失溫', '已打IV/IO輸液', NALB, NRM, BVM, ETT] },
    { id: 'r-shock', region: '全身', name: '高能量創傷合併休克', acts: ['意識改變', '血壓<90', '心跳>120', '皮膚濕冷', '全身脊椎固定完成', IV2, IO, TXA, BLOOD, '已保溫防失溫', NRM] },
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
  /** 側別：四肢為「右上肢」等，胸部／股骨為「左」「右」 */
  sides?: string[];
  /** 型態：股骨骨折的開放性／閉鎖性 */
  subtype?: string;
}

/** 需選型態的傷勢（單選） */
export const SUBTYPES: Record<string, string[]> = { 'r-femur': ['閉鎖性', '開放性'] };

// ---------- 側別 ----------
export const LIMB_SIDES = ['右上肢', '左上肢', '右下肢', '左下肢'];
export const CHEST_SIDES = ['右', '左'];
/** 需選側別的傷勢 */
export const SIDE_KIND: Record<string, 'limb' | 'chest' | 'femur'> = {
  'r-femur': 'femur',
  'r-art': 'limb',
  'r-amp': 'limb',
  'y-fx': 'limb',
  'y-openfx': 'limb',
  'g-sprain': 'limb',
  'r-ptx': 'chest',
  'r-flail': 'chest',
};

/** 含側別的傷勢名稱：動脈大出血(右下肢)、氣胸/血胸(左)、雙側為(雙側) */
export function entryName(t: TraumaEntry): string {
  const s = t.sides ?? [];
  if (!s.length) return t.subtype ? `${t.name}(${t.subtype})` : t.name;
  if (SIDE_KIND[t.id] === 'chest' || SIDE_KIND[t.id] === 'femur') return `${t.name}(${s.length > 1 ? '雙側' : s[0]}${t.subtype ? '、' + t.subtype : ''})`;
  const order = LIMB_SIDES.filter((x) => s.includes(x));
  return `${t.name}(${order.join('、')})`;
}

// ---------- 人形圖部位 ↔ 傷勢 ----------
/** 傷勢對應的人形圖部位群組；any＝任何部位、burn＝任何部位的燒燙傷 */
export const GROUPS: Record<string, string[]> = {
  'r-head': ['head'],
  'r-face': ['face'],
  'r-inhal': ['face', 'neck'],
  'r-neckpen': ['neck'],
  'r-cspine': ['neck', 'back'],
  'r-ptx': ['chest'],
  'r-flail': ['chest'],
  'r-abd': ['abd'],
  'r-evisc': ['abd'],
  'r-pelvis': ['pelvis'],
  'r-art': ['arm', 'leg', 'neck'],
  'r-amp': ['arm', 'leg'],
  'r-femur': ['leg'],
  'r-burn': ['burn'],
  'r-shock': ['any'],
  'y-fx': ['arm', 'leg'],
  'y-openfx': ['arm', 'leg'],
  'y-burn': ['burn'],
  'y-lac': ['any'],
  'y-spine': ['neck', 'back'],
  'y-head': ['head', 'face'],
  'g-abr': ['any'],
  'g-lac': ['any'],
  'g-sprain': ['arm', 'leg'],
  'g-burn': ['burn'],
};

const UPPER = /^(clav|sh|arm|el|fa|wr|hd)[RL]$/;
const LOWER = /^(hip|th|kn|lg|an|ft)[RL]$/;

/** 人形圖部位 → 群組 */
export function regionGroups(key: string, view: string): string[] {
  if (view === 'hand') return ['arm'];
  if (view === 'foot') return ['leg'];
  if (view === 'face') return key === 'fneck' ? ['neck'] : key === 'fscalp' || key === 'fhead' ? ['head', 'face'] : ['face'];
  const back = view === 'back';
  if (key === 'head') return ['head', 'face'];
  if (key === 'neck') return back ? ['neck', 'back'] : ['neck'];
  if (key === 'chest') return back ? ['chest', 'back'] : ['chest'];
  if (key === 'abd') return back ? ['abd', 'back'] : ['abd'];
  if (key === 'pelv') return ['pelvis'];
  if (/^clav[RL]$/.test(key)) return ['chest', 'arm'];
  if (/^hip[RL]$/.test(key)) return ['pelvis', 'leg'];
  if (UPPER.test(key)) return ['arm'];
  if (LOWER.test(key)) return ['leg'];
  return [];
}

/** 部位名稱（含左右）→ 肢體側別，如「右前臂」→「右上肢」 */
export function limbOf(regionName: string): string | null {
  const side = regionName[0];
  if (side !== '左' && side !== '右') return null;
  if (/上臂|前臂|手肘|手腕|手掌|手背|手$|肩|鎖骨|指/.test(regionName)) return `${side}上肢`;
  if (/大腿|膝|小腿|踝|足|趾|腳|髖/.test(regionName)) return `${side}下肢`;
  return null;
}

/** 此顏色在某部位可選的傷勢 */
export function traumaForRegion(c: Color, groups: string[]): TraumaDef[] {
  return traumaListFor(c).filter((d) => (GROUPS[d.id] ?? []).some((g) => g === 'any' || g === 'burn' || groups.includes(g)));
}

/** 牌色等級：降級時移除較高等級的傷勢（黃綠不需要紅牌傷勢） */
const TIER: Record<string, number> = { r: 3, y: 2, g: 1 };
export function keepForColor(list: TraumaEntry[] | undefined, c: Color): TraumaEntry[] {
  const max = c === 'R' ? 3 : c === 'Y' ? 2 : c === 'G' ? 1 : 0;
  return (list ?? []).filter((t) => (TIER[t.id[0]] ?? 0) <= max);
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
export const STATUS = new Set([
  '意識不清', 'GCS≤8', '瞳孔不等大', '意識持續下降', '抽搐', '耳鼻流出血/腦脊髓液',
  '氣道受阻風險', '口鼻大量出血', '牙齒/骨折碎片',
  '聲音沙啞/喘鳴', '口鼻焦黑/鼻毛燒焦', '血氧<90%', '血腫擴大', '皮下氣腫',
  '四肢癱瘓/無力', '感覺異常', '神經性休克(低血壓/心跳慢)',
  '呼吸音減弱(左)', '呼吸音減弱(右)', '氣管偏移', '頸靜脈怒張', '呼吸窘迫', '胸壁反常運動',
  '疑內出血/休克', '腹部膨脹/僵硬', '血壓<90', '心跳>120', '下肢長度不等/外旋',
  '出血性休克', '壓砸症候群風險', '遠端脈搏消失', '吸入性灼傷疑慮', '環狀燒傷', '意識改變', '皮膚濕冷',
]);

/** 進階呼吸道：選了就不再給 NRM／Mask 等氧氣面罩（BVM 仍可經管路給氧） */
export const ADV_AIRWAY = ['已插氣管內管', '已放i-gel', '已行環甲膜切開', '預防性插管完成'];
export const MASK_O2 = ['NRM給氧', 'Mask給氧'];

/** 已點選的評估／處置以「病人」為單位：任一傷勢點過，其他傷勢的同一按鈕也顯示已選 */
export function patientActs(list: TraumaEntry[] | undefined): string[] {
  const out: string[] = [];
  for (const t of list ?? []) for (const a of t.acts) if (!out.includes(a)) out.push(a);
  return out;
}

export function hasAdvAirway(list: TraumaEntry[] | undefined): boolean {
  return patientActs(list).some((a) => ADV_AIRWAY.includes(a));
}

/** 交接關鍵處置：醒目標示 */
const KEY_ACTS: [RegExp, string][] = [
  [/^已插氣管內管$|^預防性插管完成$/, '插管'],
  [/^已放i-gel$/, 'i-gel'],
  [/^已行環甲膜切開$/, '環甲膜切開'],
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
