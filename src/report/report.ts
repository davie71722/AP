// 回報文字與匯出（規格書 9.5）
import { HOSPITAL_BY_ID, HOSPITALS } from '../data/hospitals';
import { INCIDENT_TYPE_BY_ID } from '../data/incidentTypes';
import { fmtClock } from '../engine/actions';
import type { HospitalRuntime, Incident, Patient, Vehicle } from '../types';

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
  const count = (pred: (p: Patient) => boolean) => patients.filter(pred).length;
  const by = (c: string, st?: Patient['status']) => count((p) => p.color === c && (!st || p.status === st));
  const types = incident.types.map((t) => INCIDENT_TYPE_BY_ID[t]?.name).join('＋') || '未指定';
  const vs = (st: Vehicle['status']) => vehicles.filter((v) => v.status === st).length;

  const perHospital = HOSPITALS.map((h) => {
    const sent = patients.filter((p) => p.status === 'sent' && p.hospitalId === h.id);
    if (!sent.length) return null;
    const parts = (['R', 'Y', 'G'] as const)
      .map((c) => [c, sent.filter((p) => p.color === c).length] as const)
      .filter(([, n]) => n > 0)
      .map(([c, n]) => `${{ R: '紅', Y: '黃', G: '綠' }[c]}${n}`);
    return `${h.short} ${parts.join('')}`;
  }).filter(Boolean);

  const closed = HOSPITALS.filter((h) => runtime[h.id]?.bypass).map((h) => h.short);
  const self = HOSPITALS.filter((h) => {
    const s = runtime[h.id]?.selfPresented;
    return s && s.R + s.Y + s.G > 0;
  }).map((h) => {
    const s = runtime[h.id].selfPresented;
    return `${h.short} 紅${s.R}黃${s.Y}綠${s.G}`;
  });

  const lines = [
    `【新竹縣MCI後送回報】${fmtClock(now)}`,
    `事件：${types}｜地點：${incident.location?.label ?? '未指定'}`,
    `經過時間：${elapsedMin(incident, now)} 分`,
    `傷患總數 ${patients.length}：紅${by('R')} 黃${by('Y')} 綠${by('G')} 黑${by('K')}`,
    `已後送：紅${by('R', 'sent')} 黃${by('Y', 'sent')} 綠${by('G', 'sent')}；待後送：紅${by('R', 'waiting')} 黃${by(
      'Y',
      'waiting',
    )} 綠${by('G', 'waiting')}`,
    `車輛：現場待命${vs('standby')}、運送中${vs('transport')}、趕赴中${vs('enroute')}、待除污${vs('decon')}`,
    `各院收治：${perHospital.length ? perHospital.join('；') : '無'}`,
    `關閉醫院：${closed.length ? closed.join('、') : '無'}`,
  ];
  if (self.length) lines.push(`自行到院：${self.join('；')}`);
  return lines.join('\n');
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function logToCsv(incident: Incident): string {
  const rows = [['時間', '內容'], ...incident.log.map((l) => [new Date(l.at).toLocaleString('zh-TW'), l.text])];
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function patientsToCsv(patients: Patient[]): string {
  const rows = [
    ['代碼', '原代碼', '顏色', '狀態', '醫院', '車輛', '出發時間', '標籤', '檢傷卡號'],
    ...patients.map((p) => [
      p.label,
      p.prevLabels.join('→'),
      p.color,
      p.status === 'sent' ? '已送出' : '待送',
      p.hospitalId ? HOSPITAL_BY_ID[p.hospitalId]?.short : '',
      p.vehicleId ?? '',
      p.sentAt ? new Date(p.sentAt).toLocaleString('zh-TW') : '',
      p.tags.join(' '),
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
