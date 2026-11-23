// 現場照護計時：止血帶時間警示、待送病人再評估計時
import type { Patient, Settings } from '../types';

export const TQ_WARN_MIN = 60;
export const TQ_ALERT_MIN = 120;

export interface Tourniquet {
  /** 肢體側別（如「右下肢」），未選側別為空 */
  side: string;
  /** 上止血帶時間（ms） */
  at: number;
  /** 已經過分鐘 */
  min: number;
  level: 'ok' | 'warn' | 'alert';
}

/** HH:MM → 最近一次（不晚於現在 5 分鐘）的時間點；跨午夜往前一天 */
export function clockToMs(hhmm: string, now: number): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  let t = d.getTime();
  if (t > now + 5 * 60000) t -= 24 * 3600000;
  return t;
}

/** 病人身上的止血帶（依傷勢肢體），含經過時間與警示等級 */
export function tourniquets(p: Pick<Patient, 'trauma'>, now: number): Tourniquet[] {
  const out: Tourniquet[] = [];
  for (const t of p.trauma ?? []) {
    for (const a of t.acts) {
      const m = a.match(/^已上止血帶\((\d{1,2}:\d{2})\)$/);
      if (!m) continue;
      const at = clockToMs(m[1], now);
      if (at === null) continue;
      const min = Math.max(0, Math.floor((now - at) / 60000));
      out.push({ side: (t.sides ?? []).join('、'), at, min, level: min >= TQ_ALERT_MIN ? 'alert' : min >= TQ_WARN_MIN ? 'warn' : 'ok' });
    }
  }
  return out;
}

/** 再評估間隔（分）：依牌色 */
export function reassessInterval(p: Pick<Patient, 'color'>, settings: Pick<Settings, 'reassessMin'>): number | null {
  if (p.color === 'K') return null;
  return settings.reassessMin[p.color] ?? null;
}

/** 上次評估時間：最後一次再評估，否則檢傷建立時間 */
export function lastAssessed(p: Pick<Patient, 'reassessedAt' | 'history'>): number | null {
  return p.reassessedAt ?? p.history[0]?.at ?? null;
}

/** 距離下次再評估的分鐘（負數＝已逾時）；不需再評估回傳 null */
export function reassessDue(p: Patient, settings: Pick<Settings, 'reassessMin'>, now: number): number | null {
  if (p.status !== 'waiting') return null;
  const iv = reassessInterval(p, settings);
  const last = lastAssessed(p);
  if (!iv || last === null) return null;
  return Math.ceil(iv - Math.max(0, now - last) / 60000);
}
