// 回報文字與匯出（規格書 9.5）
import { HOSPITAL_BY_ID, HOSPITALS } from '../data/hospitals';
import { INCIDENT_TYPE_BY_ID } from '../data/incidentTypes';
import { fmtClock } from '../engine/actions';
import { RED_CLASSES, TRIAGE_NAMES, type HospitalRuntime, type Incident, type Patient, type Vehicle } from '../types';

export function elapsedMin(incident: Incident, now: number): number {
  return incident.startAt ? Math.max(0, Math.floor((now - incident.startAt) / 60000)) : 0;
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
    ['代碼', '原代碼', '顏色', '狀態', '醫院', '車輛', '出發時間', '傷勢註解', '檢傷卡號'],
    ...patients.map((p) => [
      p.label,
      p.prevLabels.join('→'),
      p.color,
      p.status === 'sent' ? '已送出' : p.status === 'left' ? '自行離開' : '待送',
      p.hospitalId ? HOSPITAL_BY_ID[p.hospitalId]?.short : '',
      (p.vehicleId && vehicles.find((v) => v.id === p.vehicleId)?.name) || (p.byDuty ? '勤務車' : ''),
      p.sentAt ? new Date(p.sentAt).toLocaleString('zh-TW') : '',
      p.note ?? '',
      p.triageTagNo ?? '',
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
