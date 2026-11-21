// 創傷與處置的防呆規則：互斥、取代、停用、側別、提醒
import type { Wound } from '../types';
import { actMatches, actText, ADV_AIRWAY, CHEST_SIDES, entryName, limbOf, MASK_O2, patientActs, SIDE_KIND, TRAUMA_BY_ID, type TraumaEntry } from './trauma';

/** 給氧裝置：一次只能一種 */
export const O2_DEVICES = ['NRM給氧', 'Mask給氧', 'BVM給氧'];
const BVM = 'BVM給氧';
/** 建立進階呼吸道後不再使用 */
const BASIC_AIRWAY = ['已放口咽/鼻咽呼吸道'];
const IV_BASIC = '已打IV';
const IV_BIG = ['已打雙線IV', '已打大口徑IV'];
const COLLAR = '已上頸圈';
const COLLAR_FULL = '已上頸圈及頭部固定';

const SHOCK = ['疑內出血/休克', '出血性休克', '血壓<90', '神經性休克(低血壓/心跳慢)', '皮膚濕冷'];
const ALOC = ['意識不清', 'GCS≤8', '意識持續下降', '意識改變'];
const NEED_AIRWAY = ['意識不清', 'GCS≤8'];
const ACCESS = /IV|IO|輸液/;

/** 移除時需再按一次確認的關鍵處置 */
export function isKeyAct(stored: string): boolean {
  return /^已插氣管內管$|^預防性插管完成$|^已放聲門上呼吸道|^已行環甲膜切開$|^已針刺減壓|^已上止血帶|^已上骨盆固定帶$|^已輸血$/.test(stored);
}

const sideOf = (a: string) => a.match(/\((左|右)\)$/)?.[1] ?? null;

/** 某傷勢的胸部側別（已選） */
function chestSides(list: TraumaEntry[]): string[] {
  const out = new Set<string>();
  for (const t of list) if (SIDE_KIND[t.id] === 'chest') for (const s of t.sides ?? []) out.add(s);
  return [...out];
}

export interface ActState {
  /** 已選時的實際文字（止血帶含時間） */
  stored?: string;
  disabled: boolean;
  /** 停用原因 */
  reason?: string;
}

/** 按鈕狀態 */
export function actState(list: TraumaEntry[], act: string): ActState {
  const all = patientActs(list);
  const stored = all.find((x) => actMatches(x, act));
  if (stored) return { stored, disabled: false };
  const adv = all.find((a) => ADV_AIRWAY.includes(a));
  if (adv && MASK_O2.includes(act)) return { disabled: true, reason: `已建立進階呼吸道（${adv.replace(/^已/, '')}），以 BVM 給氧` };
  if (adv && BASIC_AIRWAY.includes(act)) return { disabled: true, reason: '已建立進階呼吸道' };
  if (act === IV_BASIC && all.some((a) => IV_BIG.includes(a))) return { disabled: true, reason: '已記錄大口徑／雙線 IV' };
  if (act === COLLAR && all.includes(COLLAR_FULL)) return { disabled: true, reason: '已記錄頸圈及頭部固定' };
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
 * - 建立進階呼吸道：移除 NRM／Mask 與口咽／鼻咽呼吸道，自動加 BVM 給氧
 * - 大口徑／雙線 IV 取代「已打IV」；頸圈及頭部固定取代「已上頸圈」
 * - 胸部左右處置：自動補上胸部傷勢側別
 */
export function addAct(list: TraumaEntry[], traumaId: string, act: string, now: number): TraumaEntry[] {
  if (actState(list, act).disabled) return list;
  const text = actText(act, now);
  const remove = new Set<string>();
  const extra: string[] = [];
  if (O2_DEVICES.includes(text)) O2_DEVICES.filter((x) => x !== text).forEach((x) => remove.add(x));
  if (ADV_AIRWAY.includes(text)) {
    ADV_AIRWAY.filter((x) => x !== text).forEach((x) => remove.add(x));
    MASK_O2.forEach((x) => remove.add(x));
    BASIC_AIRWAY.forEach((x) => remove.add(x));
    extra.push(BVM);
  }
  if (IV_BIG.includes(text)) remove.add(IV_BASIC);
  if (text === COLLAR_FULL) remove.add(COLLAR);
  const side = sideOf(text);
  const chest = side && /^(呼吸音減弱|已針刺減壓)/.test(text);

  const all = patientActs(list);
  let out = list.map((t) => ({ ...t, acts: t.acts.filter((a) => !remove.has(a)) }));
  out = out.map((t) => {
    if (t.id !== traumaId) return t;
    const acts = [...t.acts, text];
    for (const x of extra) if (!all.includes(x) && !acts.includes(x)) acts.push(x);
    const sides = chest && SIDE_KIND[t.id] === 'chest' && !(t.sides ?? []).includes(side!) ? [...(t.sides ?? []), side!] : t.sides;
    return { ...t, acts, sides };
  });
  // BVM 若已在其他傷勢下，不重複
  if (extra.includes(BVM) && out.filter((t) => t.acts.includes(BVM)).length > 1) {
    let kept = false;
    out = out.map((t) => {
      if (!t.acts.includes(BVM)) return t;
      if (!kept) {
        kept = true;
        return t;
      }
      return { ...t, acts: t.acts.filter((a) => a !== BVM) };
    });
  }
  return out;
}

/** 取消處置（全病人移除） */
export function removeAct(list: TraumaEntry[], act: string): TraumaEntry[] {
  return list.map((t) => ({ ...t, acts: t.acts.filter((a) => !actMatches(a, act)) }));
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
export function traumaWarnings(list: TraumaEntry[] | undefined, wounds: Wound[] = []): string[] {
  const l = list ?? [];
  const all = patientActs(l);
  const w: string[] = [];
  const has = (xs: string[]) => xs.some((x) => all.includes(x));

  // 側別
  for (const t of l) {
    const kind = SIDE_KIND[t.id];
    if (kind && !(t.sides ?? []).length) w.push(`${t.name}：尚未選${kind === 'limb' ? '肢體側別' : '左右側'}`);
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
  // 人形圖側別與肢體傷勢側別
  const limbWounds = wounds.map((x) => ({ x, limb: limbOf(x.region) })).filter((x) => x.limb);
  for (const t of l) {
    if (SIDE_KIND[t.id] !== 'limb' || !(t.sides ?? []).length || !limbWounds.length) continue;
    if (!limbWounds.some((x) => t.sides!.includes(x.limb!)))
      w.push(`${entryName(t)} 與人形圖傷口側別（${[...new Set(limbWounds.map((x) => x.x.region))].join('、')}）不同，請確認`);
  }
  // 止血帶：需有四肢出血／截肢傷勢
  if (all.some((a) => a.startsWith('已上止血帶(')) && !l.some((t) => t.id === 'r-art' || t.id === 'r-amp')) w.push('已上止血帶，但未記錄動脈大出血或截肢');
  // 呼吸道與給氧
  const adv = all.find((a) => ADV_AIRWAY.includes(a));
  if (adv && !all.includes(BVM)) w.push(`已建立進階呼吸道（${adv.replace(/^已/, '')}），未記錄 BVM 給氧`);
  if (has(NEED_AIRWAY) && !adv) w.push('意識不清／GCS≤8，尚未建立進階呼吸道，請確認呼吸道處置');
  if (all.includes('血氧<90%') && !all.some((a) => O2_DEVICES.includes(a))) w.push('血氧<90%，尚未記錄給氧');
  // 藥物
  if (all.includes('已給Nalbuphine') && has([...SHOCK, ...ALOC])) w.push('休克或意識改變時給予 Nalbuphine（鴉片類止痛），請再確認');
  // 休克未建立管路
  if (has(SHOCK) && !all.some((a) => ACCESS.test(a))) w.push('有休克徵象，尚未建立 IV／IO');
  if (all.includes('已輸血') && !all.some((a) => ACCESS.test(a))) w.push('已輸血，但未記錄 IV／IO 管路');
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
