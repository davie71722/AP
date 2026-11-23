// 保密暨資通安全同意：操作者實名、連線 IP、裝置識別碼與稽核軌跡（Audit Log）
import { create } from 'zustand';
import { callMapService, isGasBackend } from '../travel/routes';

export interface Operator {
  name: string;
  ip: string;
  agreedAt: number;
}

const NAME_KEY = 'zhuxian-mci-operator-name';
const DEVICE_KEY = 'zhuxian-mci-device';
const AGREED_KEY = 'zhuxian-mci-agreed';
const LOCAL_AUDIT_KEY = 'zhuxian-mci-audit';

function safeGet(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function safeSet(store: 'local' | 'session', key: string, v: string) {
  try {
    (store === 'local' ? localStorage : sessionStorage).setItem(key, v);
  } catch {
    /* 忽略 */
  }
}

/** 裝置識別碼（本機隨機產生，持久保存） */
export function deviceId(): string {
  let id = safeGet('local', DEVICE_KEY);
  if (!id) {
    id = `D-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
    safeSet('local', DEVICE_KEY, id);
  }
  return id;
}

/** 真實姓名檢查：2–20 字，中文或英文字母（可含間隔號、空白），不可純數字或特殊符號 */
export function validName(name: string): boolean {
  const t = name.trim();
  return t.length >= 2 && t.length <= 20 && /^[\p{Script=Han}A-Za-z·．\s]+$/u.test(t) && /[\p{Script=Han}A-Za-z]/u.test(t);
}

/** 連線 IP（GAS 後端看不到使用者 IP，改由瀏覽器查詢公開 IP；查不到時標示未取得） */
export async function fetchIp(): Promise<string> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch('https://api.ipify.org?format=json', { signal: ctl.signal });
    clearTimeout(t);
    const j = (await r.json()) as { ip?: string };
    return j.ip ?? 'IP未取得';
  } catch {
    return 'IP未取得';
  }
}

interface ConsentState {
  operator: Operator | null;
  agree(name: string, ip: string): void;
}

function restore(): Operator | null {
  // 同一次開啟（分頁）內已同意者不再詢問；重新開啟需再次同意
  try {
    const o = JSON.parse(safeGet('session', AGREED_KEY) ?? 'null') as Operator | null;
    return o && validName(o.name) ? o : null;
  } catch {
    return null;
  }
}

export const useConsent = create<ConsentState>((set) => ({
  operator: typeof window === 'undefined' ? null : restore(),
  agree: (name, ip) => {
    const op = { name: name.trim(), ip, agreedAt: Date.now() };
    safeSet('local', NAME_KEY, op.name);
    safeSet('session', AGREED_KEY, JSON.stringify(op));
    set({ operator: op });
    audit('同意聲明並進入系統', `${op.name}｜${ip}`);
  },
}));

export function lastName(): string {
  return safeGet('local', NAME_KEY) ?? '';
}

export function operatorName(): string {
  return useConsent.getState().operator?.name ?? '';
}

// ---------- 稽核軌跡 ----------
export interface AuditEntry {
  at: number;
  name: string;
  ip: string;
  device: string;
  action: string;
  detail: string;
}

let queue: AuditEntry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** 記錄一筆稽核（本機保留最近 500 筆；GAS 版另送後端試算表永久保存） */
export function audit(action: string, detail = '') {
  const op = useConsent.getState().operator;
  const e: AuditEntry = { at: Date.now(), name: op?.name ?? '', ip: op?.ip ?? '', device: deviceId(), action, detail: detail.slice(0, 500) };
  try {
    const list = JSON.parse(safeGet('local', LOCAL_AUDIT_KEY) ?? '[]') as AuditEntry[];
    safeSet('local', LOCAL_AUDIT_KEY, JSON.stringify([...list, e].slice(-500)));
  } catch {
    /* 忽略 */
  }
  if (!isGasBackend()) return;
  queue.push(e);
  if (!timer) timer = setTimeout(flush, 3000);
}

async function flush() {
  timer = null;
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  try {
    const r = await callMapService<{ ok?: boolean; error?: string }>({ audit: batch });
    if (!r?.ok) throw new Error(r?.error ?? 'audit_failed');
  } catch {
    // 離線或失敗：放回佇列稍後重送
    queue = [...batch, ...queue].slice(-1000);
    if (!timer) timer = setTimeout(flush, 30000);
  }
}

export function localAudit(): AuditEntry[] {
  try {
    return JSON.parse(safeGet('local', LOCAL_AUDIT_KEY) ?? '[]') as AuditEntry[];
  } catch {
    return [];
  }
}
