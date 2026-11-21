// 交接註解：以連接詞組成完整敘述（傷勢併評估；處置予…）
// 例：重度頭外傷併耳鼻漏、左側氣血胸併呼吸音減弱及氣管偏移、右前臂疑骨折脫臼；處置予抽吸、置i-gel、NRM給氧、頸圈及長背板固定並頭抬高30度、建立大口徑IV及IO、給Transamin及輸血。
import type { Color, Wound } from '../types';
import { limbOf, LIMB_SIDES, SIDE_KIND, STATUS, type TraumaEntry } from './trauma';

/** 傷勢簡稱 */
const INJURY_SHORT: Record<string, string> = {
  'r-head': '重度頭外傷',
  'r-face': '顏面嚴重創傷',
  'r-inhal': '吸入性灼傷',
  'r-neckpen': '頸穿刺',
  'r-cspine': '疑頸椎損傷',
  'r-ptx': '氣血胸',
  'r-flail': '連枷胸或胸穿刺傷',
  'r-abd': '腹部嚴重創傷',
  'r-evisc': '臟器外露',
  'r-pelvis': '不穩定骨盆骨折',
  'r-art': '動脈大出血',
  'r-amp': '創傷性截肢壓砸',
  'r-femur': '股骨骨折',
  'r-burn': '大面積燒燙傷(>20%)',
  'r-shock': '高能量創傷併休克',
  'y-fx': '肢體骨折脫臼',
  'y-openfx': '開放性骨折(已止血)',
  'y-burn': '中度燒燙傷(10-20%)',
  'y-lac': '較大撕裂穿刺傷',
  'y-spine': '背頸痛(無癱瘓)',
  'y-head': '頭部撞擊(意識清楚)',
  'g-abr': '表淺擦挫傷',
  'g-lac': '小撕裂傷(已止血)',
  'g-sprain': '輕微扭傷疼痛',
  'g-burn': '小面積二度燒傷(<10%)',
};

/** 評估簡稱 */
const STATUS_SHORT: Record<string, string> = {
  '耳鼻流出血/腦脊髓液': '耳鼻漏',
  氣道受阻風險: '氣道疑似阻塞',
  口鼻大量出血: '口鼻大出血',
  '牙齒/骨折碎片': '口內碎片',
  '聲音沙啞/喘鳴': '聲啞喘鳴',
  '口鼻焦黑/鼻毛燒焦': '口鼻焦黑',
  '四肢癱瘓/無力': '四肢無力',
  '神經性休克(低血壓/心跳慢)': '神經性休克',
  '疑內出血/休克': '疑內出血休克',
  '腹部膨脹/僵硬': '腹脹僵硬',
  '下肢長度不等/外旋': '下肢短縮外旋',
  吸入性灼傷疑慮: '疑吸入性灼傷',
};

/** 處置分組與簡稱：[組別, 簡稱] */
const PROC: Record<string, [string, string]> = {
  已抽吸: ['airway', '抽吸'],
  '已放口咽/鼻咽呼吸道': ['airway', '置口咽或鼻咽呼吸道'],
  '已放i-gel': ['airway', '置i-gel'],
  '已放聲門上呼吸道(i-gel)': ['airway', '置i-gel'],
  已插氣管內管: ['airway', '插管'],
  預防性插管完成: ['airway', '預防性插管'],
  已行環甲膜切開: ['airway', '通報醫導後環甲切'],
  通報醫導後環甲切: ['airway', '通報醫導後環甲切'],
  NRM給氧: ['o2', 'NRM給氧'],
  Mask給氧: ['o2', 'Mask給氧'],
  BVM給氧: ['o2', 'BVM給氧'],
  加壓止血: ['bleed', '加壓止血'],
  局部加壓止血: ['bleed', '局部加壓止血'],
  彈性繃帶加壓止血: ['bleed', '彈性繃帶加壓止血'],
  已加壓止血包紮: ['bleed', '加壓止血包紮'],
  已填塞止血紗布: ['bleed', '止血紗布填塞'],
  已加壓包紮: ['bleed', '加壓包紮'],
  傷口加壓包紮: ['bleed', '傷口加壓包紮'],
  '已針刺減壓(左)': ['chest', '左側針刺減壓'],
  '已針刺減壓(右)': ['chest', '右側針刺減壓'],
  已貼胸部封閉敷料: ['chest', '胸部封閉敷料'],
  已貼封閉敷料: ['chest', '封閉敷料'],
  已上頸圈: ['fix', '頸圈'],
  已上頸圈及頭部固定: ['fix', '頭頸'],
  '已上長背板/鏟式擔架': ['fix', '長背板'],
  '已上長背板/真空墊': ['fix', '長背板或真空墊'],
  全身脊椎固定完成: ['fix', '全身脊椎'],
  已上骨盆固定帶: ['fix', '骨盆帶'],
  已上牽引固定器: ['fix', '牽引器'],
  '已副木/夾板固定': ['fix', '副木'],
  已副木固定: ['fix', '副木'],
  三角巾懸吊: ['fixplus', '三角巾懸吊'],
  頭部抬高30度: ['fixplus', '頭抬高30度'],
  '患肢抬高/冰敷': ['fixplus', '患肢抬高冰敷'],
  已打大口徑IV: ['access', '大口徑IV'],
  已打雙線IV: ['access', '雙線IV'],
  已打IV: ['access', 'IV'],
  已打骨針IO: ['access', 'IO'],
  '已打IV/IO輸液': ['access', 'IV或IO輸液'],
  已給Transamin: ['med', 'Transamin'],
  已給Nalbuphine: ['med', 'Nalbuphine'],
  已輸血: ['blood', '輸血'],
};

/** A、B及C */
export function joinAnd(xs: string[], last = '及'): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join('、')}${last}${xs[xs.length - 1]}`;
}

function sidePrefix(t: TraumaEntry): string {
  const s = t.sides ?? [];
  if (!s.length) return '';
  const kind = SIDE_KIND[t.id];
  if (kind === 'chest' || kind === 'femur') return s.length > 1 ? '雙側' : `${s[0]}側`;
  return joinAnd(LIMB_SIDES.filter((x) => s.includes(x)));
}

function statusShort(a: string, t: TraumaEntry): string {
  const m = a.match(/^呼吸音減弱\((左|右)\)$/);
  // 胸部傷勢已有側別時省略重複的左右
  if (m) return (t.sides ?? []).length === 1 && t.sides![0] === m[1] ? '呼吸音減弱' : `${m[1]}側呼吸音減弱`;
  return STATUS_SHORT[a] ?? a;
}

/** 評估串接不用「、」（避免與傷勢之間的「、」混淆）：A及B、A與B及C */
export function joinFindings(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join('與')}及${xs[xs.length - 1]}`;
}

/** 與人形圖傷口合併的傷勢：用實際部位取代肢體側別 */
export interface Merge {
  regions: string[];
  fx?: string;
  tbsa?: number;
}

/** 單一傷勢敘述：左側氣血胸併呼吸音減弱及氣管偏移 */
export function injuryPhrase(t: TraumaEntry, withStatus = true, merge?: Merge): string {
  let name = INJURY_SHORT[t.id] ?? t.name;
  if (t.id === 'r-femur') name = `${t.subtype ?? ''}${name}`;
  if (t.id === 'y-fx' && merge?.fx) name = `${merge.fx}骨折`;
  else if (t.id === 'y-fx' && (t.sides ?? []).length) name = '骨折脫臼';
  if (merge?.tbsa) name = name.replace(/\(.*\)$/, '') + `(TBSA合計${merge.tbsa}%)`;
  let prefix = sidePrefix(t);
  if (merge?.regions.length) {
    // 有實際部位時用較短的名稱
    name = { 'y-lac': '撕裂穿刺傷', 'g-lac': '撕裂傷(已止血)', 'g-abr': '擦挫傷' }[t.id] ?? name;
    // 已由人形圖部位說明的側別不再重複
    const covered = new Set(merge.regions.map((r) => limbOf(r)).filter(Boolean));
    const rest = (t.sides ?? []).filter((x) => !covered.has(x));
    prefix = joinAnd([...merge.regions, ...rest]);
  }
  const base = `${prefix}${name}`;
  if (!withStatus) return base;
  const st = t.acts.filter((a) => STATUS.has(a)).map((a) => statusShort(a, t));
  return st.length ? `${base}${/併/.test(name) ? '且' : '併'}${joinFindings(st)}` : base;
}

const MINOR = ['擦傷', '挫傷', '撕裂傷'];
const WOUND_SHORT: Record<string, string> = { '疑似骨折/脫臼': '疑骨折脫臼', 感染: '感染' };

/** 人形圖傷口敘述：相同傷勢合併部位（額及上唇撕裂傷）；紅牌省略擦挫撕裂等輕微傷 */
export function woundPhrases(wounds: Wound[], color?: Color, burnTotal = false): string[] {
  const list = color === 'R' ? wounds.filter((w) => !MINOR.includes(w.type)) : wounds;
  const out: string[] = [];
  const groups = new Map<string, string[]>();
  for (const w of list) {
    let type = w.type === '疑似骨折/脫臼' && w.fx ? `${w.fx}骨折` : (WOUND_SHORT[w.type] ?? w.type);
    // 燒燙傷已在傷勢寫明 TBSA 合計：依度數合併部位
    if (w.type === '燙傷' && (burnTotal || !w.tbsa)) type = `${w.deg ? w.deg + '度' : ''}燙傷`;
    const detail = w.type === '撕裂傷' && w.cm > 0 ? `${w.cm}cm` : w.type === '燙傷' && !burnTotal && w.tbsa > 0 && w.deg ? `${w.deg}度` : '';
    const tbsa = w.type === '燙傷' && !burnTotal && w.tbsa > 0 ? `(TBSA ${w.tbsa}%)` : '';
    if (detail || tbsa) {
      out.push(`${w.region}${detail}${type}${tbsa}`);
      continue;
    }
    if (!groups.has(type)) {
      groups.set(type, []);
      out.push(`\u0000${type}`);
    }
    if (!groups.get(type)!.includes(w.region)) groups.get(type)!.push(w.region);
  }
  return out.map((x) => (x.startsWith('\u0000') ? `${joinAnd(groups.get(x.slice(1))!)}${x.slice(1)}` : x));
}

/** 處置敘述：抽吸、置i-gel、NRM給氧、頸圈及長背板固定並頭抬高30度、建立大口徑IV及IO、給Transamin及輸血 */
export function procedurePhrase(acts: string[]): string {
  const g: Record<string, string[]> = {};
  const other: string[] = [];
  let ride = false;
  for (const a of acts) {
    if (STATUS.has(a)) continue;
    if (a === '可搭坐車') {
      ride = true;
      continue;
    }
    const tq = a.match(/^已上止血帶(?:\[(.*)\])?\((.+)\)$/);
    if (tq) {
      (g.bleed ??= []).push(`${tq[1] ?? ''}止血帶(${tq[2]})`);
      continue;
    }
    const p = PROC[a];
    if (p) (g[p[0]] ??= []).push(p[1]);
    else other.push(a.replace(/^已/, ''));
  }
  const parts: string[] = [];
  parts.push(...(g.airway ?? []), ...(g.o2 ?? []), ...(g.bleed ?? []), ...(g.chest ?? []));
  if (g.fix?.length || g.fixplus?.length) {
    // 脊椎固定合寫：長背板頸圈固定
    const fixes = g.fix ?? [];
    const board = fixes.some((x) => /長背板|全身脊椎/.test(x));
    const collar = fixes.some((x) => x === '頸圈' || x === '頭頸');
    const spine = board && collar ? '長背板頸圈' : board ? '長背板' : collar ? '頸圈' : '';
    const rest = fixes.filter((x) => !/長背板|全身脊椎/.test(x) && x !== '頸圈' && x !== '頭頸');
    const nouns = [spine, ...rest].filter(Boolean);
    const phrases = nouns.length ? [`${joinAnd(nouns)}固定`] : [];
    const plus = g.fixplus ?? [];
    if (phrases.length && plus.length) phrases[0] = `${phrases[0]}並${joinAnd(plus)}`;
    else if (plus.length) phrases.push(joinAnd(plus));
    parts.push(...phrases);
  }
  if (g.access?.length) parts.push(`建立${joinAnd(g.access)}`);
  if (g.med?.length) parts.push(`給${joinAnd([...g.med, ...(g.blood ?? [])])}`);
  else if (g.blood?.length) parts.push('輸血');
  parts.push(...other);
  const body = parts.join('、');
  return [body, ride ? '可搭坐車' : ''].filter(Boolean).join('，');
}

/**
 * 交接註解：傷勢（併評估）＋人形圖傷口；處置予…。其他註解。
 * 紅牌不列擦傷、挫傷、撕裂傷等輕微傷。
 */
const MERGE_TYPE: Record<string, string> = { 'y-fx': '疑似骨折/脫臼', 'y-openfx': '疑似骨折/脫臼', 'r-amp': '截肢' };
/** 軟組織傷勢可併入的人形圖傷口 */
const SOFT: Record<string, string[]> = { 'y-lac': ['撕裂傷'], 'g-lac': ['撕裂傷'], 'g-abr': ['擦傷', '挫傷'] };
const BURN = ['r-burn', 'y-burn', 'g-burn'];

const TIER: Record<string, number> = { r: 0, y: 1, g: 2 };

export function narrative(trauma: TraumaEntry[] | undefined, wounds: Wound[] = [], note?: string, color?: Color): string {
  // 嚴重度高者先寫（紅牌傷勢 → 黃 → 綠）
  const t = [...(trauma ?? [])].sort((a, b) => (TIER[a.id[0]] ?? 9) - (TIER[b.id[0]] ?? 9));
  // 人形圖傷口與四肢傷勢重複時合併（如「右上肢骨折脫臼」＋「右前臂閉鎖性骨折」→「右前臂閉鎖性骨折」）
  const used = new Set<Wound>();
  const merges = new Map<string, Merge>();
  for (const x of t) {
    const type = MERGE_TYPE[x.id];
    if (!type || !(x.sides ?? []).length) continue;
    const ws = wounds.filter((w) => !used.has(w) && w.type === type && x.sides!.includes(limbOf(w.region) ?? '') && (x.id !== 'y-openfx' || w.fx !== '閉鎖性'));
    if (!ws.length) continue;
    ws.forEach((w) => used.add(w));
    const fxs = [...new Set(ws.map((w) => w.fx).filter(Boolean))];
    merges.set(x.id, { regions: [...new Set(ws.map((w) => w.region))], fx: fxs.length === 1 ? fxs[0] : undefined });
  }
  // 撕裂傷、擦挫傷：人形圖部位併入傷勢（右大腿6cm撕裂穿刺傷）
  for (const x of t) {
    const types = SOFT[x.id];
    if (!types) continue;
    const ws = wounds.filter((w) => !used.has(w) && types.includes(w.type));
    if (!ws.length) continue;
    ws.forEach((w) => used.add(w));
    const regions: string[] = [];
    for (const w of ws) {
      const r = `${w.region}${w.type === '撕裂傷' && w.cm > 0 ? `${w.cm}cm` : ''}`;
      if (!regions.includes(r)) regions.push(r);
    }
    merges.set(x.id, { regions });
  }
  // 燒燙傷：傷勢寫 TBSA 合計，部位依度數列出
  const burnTbsa = wounds.filter((w) => w.type === '燙傷').reduce((n, w) => n + (w.tbsa || 0), 0);
  const hasBurn = t.some((x) => BURN.includes(x.id));
  if (hasBurn && burnTbsa > 0) for (const x of t) if (BURN.includes(x.id)) merges.set(x.id, { regions: [], tbsa: burnTbsa });

  const injuries = [
    ...t.map((x) => injuryPhrase(x, true, merges.get(x.id))),
    ...woundPhrases(
      wounds.filter((w) => !used.has(w)),
      color,
      hasBurn && burnTbsa > 0,
    ),
  ];
  // 止血帶依肢體標示
  const acts: string[] = [];
  for (const x of t)
    for (const a of x.acts) {
      const tq = a.match(/^已上止血帶\((.+)\)$/);
      const v = tq ? `已上止血帶[${sidePrefix(x)}](${tq[1]})` : a;
      if (!acts.includes(v)) acts.push(v);
    }
  const proc = procedurePhrase(acts);
  let s = injuries.join('、');
  if (proc) s = s ? `${s}；處置予${proc}` : `處置予${proc}`;
  if (s) s += '。';
  if (note?.trim()) s += note.trim();
  return s;
}
