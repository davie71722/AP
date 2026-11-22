// 創傷與處置的防呆規則：互斥、取代、停用、側別、提醒
import type { Wound } from '../types';
import { actMatches, actText, ADV_AIRWAY, perTrauma, CHEST_SIDES, entryName, limbOf, patientActs, SIDE_KIND, SUBTYPES, TRAUMA_BY_ID, type TraumaEntry } from './trauma';

/** 給氧裝置：一次只能一種 */
export const O2_DEVICES = ['NRM給氧', 'Mask給氧', 'BVM給氧'];
/** 建立進階呼吸道後不再使用 */
const BASIC_AIRWAY = ['已放口咽/鼻咽呼吸道'];
const IV_BASIC = '已打IV';
const IV_BIG = ['已打雙線IV', '已打大口徑IV'];
const INTUBATED = ['已插氣管內管', '預防性插管完成'];

const SHOCK = ['疑內出血/休克', '出血性休克', '血壓<90', '神經性休克(低血壓/心跳慢)', '皮膚濕冷'];
const ALOC = ['意識不清', 'GCS≤8', '意識持續下降', '意識改變'];
const NEED_AIRWAY = ['意識不清', 'GCS≤8'];
const ACCESS = /IV|IO|輸液|輸血/;

/** 移除時需再按一次確認的關鍵處置 */
export function isKeyAct(stored: string): boolean {
  return /^已插氣管內管$|^預防性插管完成$|^已放i-gel$|^通報醫導後環甲切$|^已行環甲膜切開$|^已針刺減壓|^已上止血帶|^已上骨盆固定帶$|^已輸血$/.test(stored);
}

const sideOf = (a: string) => a.match(/\((左|右)\)$/)?.[1] ?? null;

/** 某傷勢的胸部側別（已選） */
function chestSides(list: TraumaEntry[]): string[] {
  const out = new Set<string>();
  for (const t of list) if (SIDE_KIND[t.id] === 'chest') for (const s of t.sides ?? []) out.add(s);
  return [...out];
}

// ---------- 藥物防呆（新竹縣 2026 到院前救護作業流程手冊） ----------
export const NALB = '已給Nalbuphine';
export const TXA = '已給Transamin';
/** 明顯頭部或軀幹鈍挫傷：Nalbuphine 施打條件不符（P3 註2） */
const HEAD_TRUNK: Record<string, string> = {
  'r-head': '頭部', 'r-face': '頭部', 'y-head': '頭部',
  'r-ptx': '軀幹', 'r-flail': '軀幹', 'r-abd': '軀幹', 'r-evisc': '軀幹', 'r-pelvis': '軀幹', 'r-shock': '軀幹',
};
/** GCS < 14 */
const GCS_LOW = ['意識不清', 'GCS≤8', '意識持續下降', '意識改變', '抽搐'];
/** 出血性休克徵象：收縮壓<90 或 心跳≥120（T0 註6） */
const TXA_SHOCK = ['出血性休克', '疑內出血/休克', '血壓<90', '心跳>120'];
const TXA_HOURS = 3;

/** 病人層級的判斷資料 */
export interface PatientCtx {
  tags?: string[];
  /** 個案備註的年齡（有填才判斷） */
  age?: string;
  /** 事件開始（受傷）時間 */
  startAt?: number | null;
  now?: number;
}

/** 藥物不可給的原因（null＝可給） */
export function drugBlock(list: TraumaEntry[], act: string, ctx: PatientCtx = {}): string | null {
  const all = patientActs(list);
  const tags = ctx.tags ?? [];
  const age = Number(ctx.age);
  const minor = tags.includes('peds') || tags.includes('minor') || (ctx.age?.trim() !== '' && Number.isFinite(age) && age > 0 && age < 18);
  if (act === NALB) {
    if (minor) return 'Nalbuphine 限 ≥18 歲（P3）';
    if (tags.includes('pregnant')) return '懷孕為 Nalbuphine 禁忌症（P3）';
    const g = all.find((a) => GCS_LOW.includes(a));
    if (g) return `GCS<14（${g}），不可給 Nalbuphine（P3）`;
    const ht = list.find((t) => HEAD_TRUNK[t.id]);
    if (ht) return `明顯${HEAD_TRUNK[ht.id]}鈍挫傷（${ht.name}），不可給 Nalbuphine（P3）`;
  }
  if (act === TXA) {
    if (minor) return 'Transamin 限成人（T0 註6）';
    if (!all.some((a) => TXA_SHOCK.includes(a))) return 'Transamin 需出血性休克徵象：收縮壓<90 或心跳≥120（T0 註6）';
    if (ctx.startAt && ctx.now && ctx.now - ctx.startAt > TXA_HOURS * 3600000) return '受傷已逾 3 小時，不給 Transamin（T0 註6）';
    if (!all.some((a) => /IV|IO/.test(a) && a !== TXA)) return 'Transamin 需先建立 IV／IO（1g 加入 NS 100mL 滴注 10 分）';
  }
  return null;
}

export interface ActState {
  /** 已選時的實際文字（止血帶含時間） */
  stored?: string;
  disabled: boolean;
  /** 停用原因 */
  reason?: string;
}

/** 按鈕狀態 */
export function actState(list: TraumaEntry[], act: string, traumaId?: string, ctx?: PatientCtx): ActState {
  const all = patientActs(list);
  // 止血帶每個肢體各自記錄
  const stored = perTrauma(act) && traumaId ? list.find((t) => t.id === traumaId)?.acts.find((x) => actMatches(x, act)) : all.find((x) => actMatches(x, act));
  if (stored) return { stored, disabled: false };
  const drug = drugBlock(list, act, ctx);
  if (drug) return { disabled: true, reason: drug };
  const adv = all.find((a) => ADV_AIRWAY.includes(a));
  if (adv && O2_DEVICES.includes(act)) return { disabled: true, reason: `已建立進階呼吸道（${adv.replace(/^已/, '')}），不再選給氧方式` };
  if (adv && BASIC_AIRWAY.includes(act)) return { disabled: true, reason: '已建立進階呼吸道' };
  if (act === IV_BASIC && all.some((a) => IV_BIG.includes(a))) return { disabled: true, reason: '已記錄大口徑／雙線 IV' };
  if (act === '已放i-gel' && all.some((a) => INTUBATED.includes(a))) return { disabled: true, reason: '已插管，不需 i-gel' };
  const side = sideOf(act);
  if (side && /^(呼吸音減弱|已針刺減壓)/.test(act)) {
    const cs = chestSides(list);
    if (cs.length && !cs.includes(side)) return { disabled: true, reason: `胸部傷勢側別為「${cs.join('、')}」` };
  }
  return { disabled: false };
}

/**
 * 點選處置（加入）：互斥、取代、連帶。
 * - 給氧裝置一次一種；進階呼吸道一次一種
 * - 建立進階呼吸道：移除所有給氧方式（NRM／Mask／BVM）與口咽／鼻咽呼吸道
 * - 大口徑／雙線 IV 取代「已打IV」；已插管時不可放 i-gel
 * - 胸部左右處置：自動補上胸部傷勢側別
 */
export function addAct(list: TraumaEntry[], traumaId: string, act: string, now: number, ctx?: PatientCtx): TraumaEntry[] {
  const st = actState(list, act, traumaId, ctx);
  if (st.disabled || st.stored) return list;
  const text = actText(act, now);
  const remove = new Set<string>();
  if (O2_DEVICES.includes(text)) O2_DEVICES.filter((x) => x !== text).forEach((x) => remove.add(x));
  if (ADV_AIRWAY.includes(text)) {
    ADV_AIRWAY.filter((x) => x !== text).forEach((x) => remove.add(x));
    O2_DEVICES.forEach((x) => remove.add(x));
    BASIC_AIRWAY.forEach((x) => remove.add(x));
  }
  if (IV_BIG.includes(text)) remove.add(IV_BASIC);
  const side = sideOf(text);
  const chest = side && /^(呼吸音減弱|已針刺減壓)/.test(text);

  let out = list.map((t) => ({ ...t, acts: t.acts.filter((a) => !remove.has(a)) }));
  out = out.map((t) => {
    if (t.id !== traumaId) return t;
    const acts = [...t.acts, text];
    const sides = chest && SIDE_KIND[t.id] === 'chest' && !(t.sides ?? []).includes(side!) ? [...(t.sides ?? []), side!] : t.sides;
    return { ...t, acts, sides };
  });
  return out;
}

/** 取消處置（全病人移除） */
export function removeAct(list: TraumaEntry[], act: string, traumaId?: string): TraumaEntry[] {
  return list.map((t) => (perTrauma(act) && traumaId && t.id !== traumaId ? t : { ...t, acts: t.acts.filter((a) => !actMatches(a, act)) }));
}

/** 側別不可取消的原因（該側已有針刺減壓） */
export function sideLock(list: TraumaEntry[], traumaId: string, side: string): string | null {
  if (SIDE_KIND[traumaId] !== 'chest') return null;
  const t = list.find((x) => x.id === traumaId);
  if (!t?.sides?.includes(side)) return null;
  const others = list.filter((x) => x.id !== traumaId && SIDE_KIND[x.id] === 'chest' && x.sides?.includes(side));
  if (others.length) return null;
  const all = patientActs(list);
  return all.includes(`已針刺減壓(${side})`) ? `已記錄針刺減壓(${side})，請先取消減壓` : null;
}

/** 切換側別；胸部改側時移除與側別矛盾的呼吸音記錄 */
export function toggleSide(list: TraumaEntry[], traumaId: string, side: string): TraumaEntry[] {
  if (sideLock(list, traumaId, side)) return list;
  let out = list.map((t) => {
    if (t.id !== traumaId) return t;
    const cur = t.sides ?? [];
    return { ...t, sides: cur.includes(side) ? cur.filter((x) => x !== side) : [...cur, side] };
  });
  if (SIDE_KIND[traumaId] === 'chest') {
    const cs = chestSides(out);
    if (cs.length) out = out.map((t) => ({ ...t, acts: t.acts.filter((a) => !(/^呼吸音減弱\((左|右)\)$/.test(a) && !cs.includes(sideOf(a)!))) }));
  }
  return out;
}

/** 防呆提醒（不阻擋操作） */
export function traumaWarnings(list: TraumaEntry[] | undefined, wounds: Wound[] = [], ctx?: PatientCtx): string[] {
  const l = list ?? [];
  const all = patientActs(l);
  const w: string[] = [];
  const has = (xs: string[]) => xs.some((x) => all.includes(x));

  // 側別
  for (const t of l) {
    const kind = SIDE_KIND[t.id];
    if (kind && !(t.sides ?? []).length) w.push(`${t.name}：尚未選${kind === 'limb' ? '肢體側別' : '左右側'}`);
    if (SUBTYPES[t.id] && !t.subtype) w.push(`${t.name}：尚未選${SUBTYPES[t.id].join('／')}`);
  }
  // 胸部：減壓側與呼吸音側不一致
  for (const s of CHEST_SIDES) {
    const other = s === '左' ? '右' : '左';
    if (all.includes(`已針刺減壓(${s})`) && all.includes(`呼吸音減弱(${other})`) && !all.includes(`呼吸音減弱(${s})`))
      w.push(`針刺減壓在${s}側，但呼吸音減弱記錄在${other}側，請確認`);
  }
  const cs = chestSides(l);
  for (const a of all) {
    const s = sideOf(a);
    if (s && /^(呼吸音減弱|已針刺減壓)/.test(a) && cs.length && !cs.includes(s)) w.push(`「${a}」與胸部傷勢側別（${cs.join('、')}）不一致`);
  }
  // 人形圖側別與肢體傷勢側別（只比對同類傷口：骨折↔疑似骨折、截肢↔截肢）
  const SAME: Record<string, string> = { 'y-fx': '疑似骨折/脫臼', 'y-openfx': '疑似骨折/脫臼', 'g-sprain': '疑似骨折/脫臼', 'r-amp': '截肢' };
  for (const t of l) {
    const type = SAME[t.id];
    if (!type || !(t.sides ?? []).length) continue;
    const ws = wounds.filter((x) => x.type === type && limbOf(x.region));
    if (ws.length && !ws.some((x) => t.sides!.includes(limbOf(x.region)!)))
      w.push(`${entryName(t)} 與人形圖${type === '截肢' ? '截肢' : '骨折'}部位（${[...new Set(ws.map((x) => x.region))].join('、')}）側別不同，請確認`);
  }
  // 止血帶：需有四肢出血／截肢傷勢
  if (all.some((a) => a.startsWith('已上止血帶(')) && !l.some((t) => ['r-art', 'r-amp', 'r-crush'].includes(t.id))) w.push('已上止血帶，但未記錄動脈大出血、截肢或壓砸傷');
  // 呼吸道與給氧
  const adv = all.find((a) => ADV_AIRWAY.includes(a));
  if (has(NEED_AIRWAY) && !adv) w.push('意識不清／GCS≤8，尚未建立進階呼吸道，請確認呼吸道處置');
  if (all.includes('血氧<90%') && !adv && !all.some((a) => O2_DEVICES.includes(a))) w.push('血氧<90%，尚未記錄給氧');
  // 藥物
  if (all.includes(NALB) && has([...SHOCK, ...ALOC])) w.push('休克或意識改變時給予 Nalbuphine（鴉片類止痛），請再確認');
  // 已給藥後才出現的禁忌／不符條件
  for (const d of [NALB, TXA]) {
    if (!all.includes(d)) continue;
    const r = drugBlock(l.map((t) => ({ ...t, acts: t.acts.filter((a) => a !== d) })), d, ctx);
    if (r) w.push(`已給${d.replace('已給', '')}，但${r.replace(/，?不可給.*$|，不給.*$/, '')}，請確認`);
  }
  // 休克未建立管路
  if (has(SHOCK) && !all.some((a) => ACCESS.test(a))) w.push('有休克徵象，尚未建立 IV／IO');
  // 燒燙傷面積與分類
  const tbsa = wounds.filter((x) => x.type === '燙傷').reduce((n, x) => n + (x.tbsa || 0), 0);
  if (tbsa > 0) {
    if (l.some((t) => t.id === 'r-burn') && tbsa <= 20) w.push(`人形圖燙傷 TBSA 合計 ${tbsa}%，與「大面積燒燙傷(>20%)」不符`);
    if (l.some((t) => t.id === 'y-burn') && (tbsa < 10 || tbsa > 20)) w.push(`人形圖燙傷 TBSA 合計 ${tbsa}%，與「中度燒燙傷(10-20%)」不符`);
    if (l.some((t) => t.id === 'g-burn') && tbsa >= 10) w.push(`人形圖燙傷 TBSA 合計 ${tbsa}%，與「小面積二度燒傷(<10%)」不符`);
    if (tbsa > 20 && !l.some((t) => t.id === 'r-burn')) w.push(`人形圖燙傷 TBSA 合計 ${tbsa}%（>20%），請考慮紅牌「大面積燒燙傷」`);
  }
  // 傷勢定義中不存在的處置（資料異常）
  for (const t of l) if (!TRAUMA_BY_ID[t.id]) w.push(`未知傷勢：${t.name}`);
  return [...new Set(w)];
}

/** 設定型態（單選；再按取消） */
export function setSubtype(list: TraumaEntry[], traumaId: string, subtype: string): TraumaEntry[] {
  return list.map((t) => (t.id === traumaId ? { ...t, subtype: t.subtype === subtype ? undefined : subtype } : t));
}

/** 此處置記錄在哪個傷勢下（只能在該處取消） */
export function ownerOf(list: TraumaEntry[], act: string, traumaId?: string): TraumaEntry | undefined {
  if (perTrauma(act) && traumaId) return list.find((t) => t.id === traumaId && t.acts.some((a) => actMatches(a, act)));
  return list.find((t) => t.acts.some((a) => actMatches(a, act)));
}
