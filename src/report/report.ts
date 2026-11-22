// 回報文字與匯出（規格書 9.5）
import { HOSPITAL_BY_ID, HOSPITALS } from '../data/hospitals';
import { INCIDENT_TYPE_BY_ID } from '../data/incidentTypes';
import { fmtClock } from '../engine/actions';
import { injuryText, RED_CLASSES, trapText, TRIAGE_NAMES, type HospitalRuntime, type Incident, type Patient, type Vehicle } from '../types';

export function elapsedMin(incident: Incident, now: number): number {
  return incident.startAt ? Math.max(0, Math.floor((now - incident.startAt) / 60000)) : 0;
}

/** 人數核對：總數＝已送＋離開＋待送＋黑（每人只歸一類） */
export function headcount(patients: Patient[]) {
  const black = patients.filter((p) => p.color === 'K').length;
  const live = patients.filter((p) => p.color !== 'K');
  const sent = live.filter((p) => p.status === 'sent').length;
  const left = live.filter((p) => p.status === 'left').length;
  const waiting = live.filter((p) => p.status === 'waiting').length;
  const total = patients.length;
  return { total, sent, left, waiting, black, ok: total === sent + left + waiting + black };
}

/** 人數核對文字：12＝已送 7＋離開 1＋待送 3＋黑 1（沒有的不寫） */
export function headcountText(patients: Patient[], blackName = '黑'): string {
  const h = headcount(patients);
  if (!h.total) return '';
  const parts = [
    h.sent ? `已送 ${h.sent}` : '',
    h.left ? `離開 ${h.left}` : '',
    h.waiting ? `待送 ${h.waiting}` : '',
    h.black ? `${blackName} ${h.black}` : '',
  ].filter(Boolean);
  return `${h.total}＝${parts.join('＋')}${h.ok ? ' ✔' : ' ⚠ 不符'}`;
}

/** 受困名單：紅1-A 受困中、黃2 14:32 脫困 */
function trappedList(patients: Patient[]): Patient[] {
  return patients.filter((p) => p.trapped || p.extricatedAt);
}

/** 一趟車的「通報醫院」文字（每趟一鍵複製） */
export function hospitalNotice(ps: Patient[], vehicle: Vehicle | undefined, incident: Incident): string {
  if (!ps.length) return '';
  const p0 = ps[0];
  const h = p0.hospitalId ? HOSPITAL_BY_ID[p0.hospitalId] : undefined;
  const N = TRIAGE_NAMES[incident.settings.triageSystem ?? 'START'];
  const counts = (['R', 'Y', 'G'] as const)
    .map((c) => [c, ps.filter((p) => p.color === c).length] as const)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${N[c]}${/\d$/.test(N[c]) ? ' ' : ''}${n}`)
    .join(' ');
  const types = incident.types.map((t) => INCIDENT_TYPE_BY_ID[t]?.name).filter(Boolean).join('＋');
  const items: [string, string][] = [
    ['車號', vehicle?.name ?? (p0.byDuty ? '勤務車' : '')],
    ['事件類型', types],
    ['地點', incident.location?.label ?? ''],
    ['出發', p0.sentAt ? fmtClock(p0.sentAt) : ''],
    ['預估抵院', p0.arriveAt ? fmtClock(p0.arriveAt) : ''],
    ['人數', `${ps.length}（${counts}）`],
  ];
  const lines = [
    `【MCI 後送通報${h ? `｜${h.short}` : ''}】`,
    ...items.filter(([, v]) => v).map(([k, v]) => `• ${k}：${v}`),
    ...ps.map((p) => `• ${p.label}${injuryText(p) ? `：${injuryText(p)}` : ''}`),
  ];
  return lines.join('\n');
}

export function buildReport(
  incident: Incident,
  patients: Patient[],
  vehicles: Vehicle[],
  runtime: Record<string, HospitalRuntime>,
  now: number,
): string {
  const N = TRIAGE_NAMES[incident.settings.triageSystem ?? 'START'];
  // TST 名稱以數字結尾（P1），與人數間加空格避免誤讀
  const f = (name: string, n: number) => `${name}${/\d$/.test(name) ? ' ' : ''}${n}`;
  /** 只列出人數 > 0 的顏色 */
  const colors = (pred: (p: Patient) => boolean, cs: readonly ('R' | 'Y' | 'G' | 'K')[] = ['R', 'Y', 'G', 'K']) =>
    cs
      .map((c) => [c, patients.filter((p) => p.color === c && pred(p)).length] as const)
      .filter(([, n]) => n > 0)
      .map(([c, n]) => f(N[c], n))
      .join(' ');
  const join = (xs: (string | number | false | null | undefined)[], sep = '、') => xs.filter(Boolean).join(sep);
  const d = new Date(now);
  const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

  const types = incident.types.map((t) => INCIDENT_TYPE_BY_ID[t]?.name).join('＋');
  const redW = patients.filter((p) => p.color === 'R' && p.status === 'waiting');
  const upgraded = incident.log.filter((l) => l.text.includes('檢傷升級為紅傷')).map((l) => l.text.split('：').pop());
  const vs = (st: Vehicle['status'], name: string) => {
    const n = vehicles.filter((v) => v.status === st && !v.held).length;
    return n ? `${name} ${n}` : '';
  };
  const held = vehicles.filter((v) => v.held).length;
  const crew = (k: 'emtp' | 'emt2') => vehicles.filter((v) => v.status !== 'offline').reduce((n, v) => n + (v[k] ?? 0), 0);

  const perHospital = HOSPITALS.map((h) => {
    const sent = patients.filter((p) => p.status === 'sent' && p.hospitalId === h.id);
    if (!sent.length) return null;
    return `${h.short} ${colors((p) => p.status === 'sent' && p.hospitalId === h.id, ['R', 'Y', 'G'])}`;
  }).filter(Boolean);
  const full = HOSPITALS.filter((h) => (runtime[h.id]?.strain ?? 0) === 2 && !runtime[h.id]?.bypass).map((h) => h.short);
  const closed = HOSPITALS.filter((h) => runtime[h.id]?.bypass).map((h) => h.short);
  const self = HOSPITALS.filter((h) => {
    const s = runtime[h.id]?.selfPresented;
    return s && s.R + s.Y + s.G > 0;
  }).map((h) => {
    const s = runtime[h.id].selfPresented;
    return `${h.short} ${join([s.R && f(N.R, s.R), s.Y && f(N.Y, s.Y), s.G && f(N.G, s.G)], ' ')}`;
  });

  const items: [string, string][] = [
    ['回報時間', `${date} ${fmtClock(now)}`],
    ['事件經過', incident.startAt ? `${elapsedMin(incident, now)} 分（${fmtClock(incident.startAt)} 開始）` : ''],
    ['事件類型', types],
    ['地點', incident.location?.label ?? ''],
    ['大隊抵達', incident.milestones?.['大隊抵達'] ? fmtClock(incident.milestones['大隊抵達']) : ''],
    ['傷患總數', patients.length ? `${patients.length}（${colors(() => true)}）` : ''],
    ['人數核對', headcountText(patients, N.K)],
    ['受困中', join(patients.filter((p) => p.trapped).map((p) => p.label))],
    ['已後送', colors((p) => p.status === 'sent', ['R', 'Y', 'G'])],
    ['待後送', colors((p) => p.status === 'waiting', ['R', 'Y', 'G'])],
    [`待送${N.R}分類`, join(RED_CLASSES.map((rc) => { const n = redW.filter((p) => p.redClass === rc.id).length; return n ? `${rc.id}${n}` : ''; }), ' ')],
    ['檢傷升級為紅傷', upgraded.length ? `${upgraded.length} 位（${upgraded.join('、')}）` : ''],
    ['勤務車／群送', String(patients.filter((p) => p.byDuty).length || '')],
    ['自行離開', String(patients.filter((p) => p.status === 'left').length || '')],
    ['車輛', join([vs('standby', '現場待命'), held ? `留守 ${held}` : '', vs('transport', '運送中'), vs('enroute', '趕赴中'), vs('decon', '待除污')])],
    ['人力', join([crew('emtp') ? `EMTP ${crew('emtp')}` : '', crew('emt2') ? `EMT-2 ${crew('emt2')}` : ''])],
    ['各院收治', perHospital.join('；')],
    ['滿載醫院', full.join('、')],
    ['關閉醫院', closed.join('、')],
    ['自行到院', self.join('；')],
  ];
  return ['【新竹縣MCI後送回報】', ...items.filter(([, v]) => v).map(([k, v]) => `• ${k}：${v}`)].join('\n');
}

/** 後送病患傷情初步報告：每位已後送病人的醫院、後送時間、由誰後送與傷情（依出發時間） */
export function buildTransportReport(patients: Patient[], vehicles: Vehicle[]): string {
  const sent = patients
    .filter((p) => p.status === 'sent')
    .sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0) || a.seq - b.seq);
  if (!sent.length) return '';
  const lines = sent.map((p) => {
    const h = p.hospitalId ? HOSPITAL_BY_ID[p.hospitalId]?.short : '';
    const v = p.vehicleId ? vehicles.find((x) => x.id === p.vehicleId) : undefined;
    const by = v ? v.name : p.byDuty ? '勤務車' : '—';
    const inj = injuryText(p);
    return `• ${p.label}｜${h || '未定醫院'}｜${p.sentAt ? fmtClock(p.sentAt) : '—'} ${by}後送${inj ? `｜${inj}` : ''}`;
  });
  return ['【後送病患傷情初步報告】', ...lines].join('\n');
}

/** 案件結束：統整戰況（條列，沒有的不寫），可複製 */
export function buildSummary(
  incident: Incident,
  patients: Patient[],
  vehicles: Vehicle[],
  runtime: Record<string, HospitalRuntime>,
  now: number,
): string {
  const N = TRIAGE_NAMES[incident.settings.triageSystem ?? 'START'];
  const f = (name: string, n: number) => `${n}${/\d$/.test(name) ? ' ' : ''}${name}`;
  const colors = (ps: Patient[], cs: readonly ('R' | 'Y' | 'G' | 'K')[] = ['R', 'Y', 'G', 'K']) =>
    cs
      .map((c) => [c, ps.filter((p) => p.color === c).length] as const)
      .filter(([, n]) => n > 0)
      .map(([c, n]) => f(N[c], n))
      .join(' ');
  const end = incident.endAt ?? now;
  const d = new Date(end);
  const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  const order = (p: Patient) => ({ R: 0, Y: 1, G: 2, K: 3 })[p.color] * 1000 + p.num;
  const sorted = [...patients].sort((a, b) => order(a) - order(b));
  const sent = sorted.filter((p) => p.status === 'sent');
  const byAmb = sent.filter((p) => !p.byDuty);
  const byDuty = sent.filter((p) => p.byDuty);
  const left = sorted.filter((p) => p.status === 'left');
  const waiting = sorted.filter((p) => p.status === 'waiting' && p.color !== 'K');
  const black = sorted.filter((p) => p.color === 'K');
  const departs = [...new Set(byAmb.map((p) => p.sentAt!).filter(Boolean))].sort((a, b) => a - b);
  const mins = incident.startAt ? Math.max(0, Math.round((end - incident.startAt) / 60000)) : 0;
  const upgraded = incident.log.filter((l) => l.text.includes('檢傷升級為紅傷')).map((l) => l.text.split('：').pop());

  const timeline = [
    incident.startAt ? `開始 ${fmtClock(incident.startAt)}` : '',
    incident.milestones?.['大隊抵達'] ? `大隊抵達 ${fmtClock(incident.milestones['大隊抵達'])}` : '',
    departs.length ? `首車出發 ${fmtClock(departs[0])}` : '',
    departs.length > 1 ? `末車出發 ${fmtClock(departs[departs.length - 1])}` : '',
    incident.endAt ? `結束 ${fmtClock(incident.endAt)}` : '',
  ].filter(Boolean);

  const perHospital = HOSPITALS.map((h) => {
    const ps = sent.filter((p) => p.hospitalId === h.id);
    return ps.length ? `${h.short} ${colors(ps, ['R', 'Y', 'G'])}（${ps.map((p) => p.label).join('、')}）` : '';
  }).filter(Boolean);
  const trips = vehicles
    .filter((v) => v.trips > 0)
    .map((v) => `${v.name} ${v.trips}趟`);
  const full = HOSPITALS.filter((h) => (runtime[h.id]?.strain ?? 0) === 2 && !runtime[h.id]?.bypass).map((h) => h.short);
  const closed = HOSPITALS.filter((h) => runtime[h.id]?.bypass).map((h) => h.short);

  const items: [string, string][] = [
    [incident.endAt ? '結束時間' : '統計時間', `${date} ${fmtClock(end)}`],
    ['事件類型', incident.types.map((t) => INCIDENT_TYPE_BY_ID[t]?.name).join('＋')],
    ['地點', incident.location?.label ?? ''],
    ['時間軸', `${timeline.join('、')}${mins ? `（歷時 ${mins} 分）` : ''}`],
    ['傷患總數', patients.length ? `${patients.length}（${colors(patients)}）` : ''],
    ['人數核對', headcountText(patients, N.K)],
    ['受困', (() => { const t = trappedList(sorted); return t.length ? `${t.length}（${t.map((p) => `${p.label} ${trapText(p).replace(/^受困，/, '')}`).join('、')}）` : ''; })()],
    ['救護車後送', byAmb.length ? `${byAmb.length}（${colors(byAmb, ['R', 'Y', 'G'])}）` : ''],
    ['勤務車／群送', byDuty.length ? `${byDuty.length}（${byDuty.map((p) => p.label).join('、')}）` : ''],
    ['自行離開', left.length ? `${left.length}（${left.map((p) => p.label).join('、')}）` : ''],
    ['未後送', waiting.length ? `${waiting.length}（${waiting.map((p) => p.label).join('、')}）` : ''],
    [N.K, black.length ? `${black.length}（${black.map((p) => p.label).join('、')}）` : ''],
    ['檢傷升級為紅傷', upgraded.length ? `${upgraded.length} 位（${upgraded.join('、')}）` : ''],
    ['各院收治', perHospital.join('；')],
    ['救護車', trips.length ? `${trips.length} 台、共 ${vehicles.reduce((n, v) => n + v.trips, 0)} 趟（${trips.join('、')}）` : ''],
    ['滿載醫院', full.join('、')],
    ['關閉醫院', closed.join('、')],
  ];
  const lines = ['【新竹縣MCI案件總結】', ...items.filter(([, v]) => v).map(([k, v]) => `• ${k}：${v}`)];

  // 傷患明細：代碼｜車輛 出發時間 ➔ 醫院｜交接註解
  const detail = sorted
    .filter((p) => p.color !== 'K' || injuryText(p))
    .map((p) => {
      const v = p.vehicleId ? vehicles.find((x) => x.id === p.vehicleId)?.name : p.byDuty ? '勤務車' : '';
      const h = p.hospitalId ? HOSPITAL_BY_ID[p.hospitalId]?.short : '';
      const where =
        p.status === 'sent' ? `${v ?? ''}${p.sentAt ? ` ${fmtClock(p.sentAt)}` : ''} ➔ ${h || '未定'}` : p.status === 'left' ? '自行離開' : '未後送';
      const inj = injuryText(p);
      return `${p.label}｜${where}${inj ? `｜${inj}` : ''}`;
    });
  if (detail.length) lines.push('', '【傷患明細】', ...detail);
  return lines.join('\n');
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 案件經過：排除標籤變動、車程查詢等系統內部紀錄 */
export function caseLog(incident: Incident) {
  return incident.log.filter((l) => !/(加|移除)標籤：|^即時車程查詢完成/.test(l.text));
}

export function logToCsv(incident: Incident): string {
  const rows = [['時間', '案件經過'], ...caseLog(incident).map((l) => [new Date(l.at).toLocaleString('zh-TW'), l.text])];
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function patientsToCsv(patients: Patient[], vehicles: Vehicle[] = []): string {
  const rows = [
    ['代碼', '原代碼', '顏色', '狀態', '醫院', '車輛', '出發時間', '傷勢'],
    ...patients.map((p) => [
      p.label,
      p.prevLabels.join('→'),
      p.color,
      p.status === 'sent' ? '已送出' : p.status === 'left' ? '自行離開' : '待送',
      p.hospitalId ? HOSPITAL_BY_ID[p.hospitalId]?.short : '',
      (p.vehicleId && vehicles.find((v) => v.id === p.vehicleId)?.name) || (p.byDuty ? '勤務車' : ''),
      p.sentAt ? new Date(p.sentAt).toLocaleString('zh-TW') : '',
      injuryText(p),
    ]),
  ];
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
