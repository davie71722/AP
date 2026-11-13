import { useState } from 'react';
import { COUNTY_ORDER, HOSPITAL_BY_ID, HOSPITAL_DB_META, HOSPITALS } from '../data/hospitals';
import { capacityOf, effectiveTravel } from '../engine/plan';
import { useStore } from '../store/store';
import { usePlan, useTriage } from '../store/usePlan';
import { LEVEL_NAME, type Hospital, type TransportColor } from '../types';
import { Sheet, Stepper } from './common';

const TAG_NAME: Record<string, string> = { hazmat: '化災責任', peds: '兒科', burn: '燒燙傷', obstetric: '產科' };
const TC: TransportColor[] = ['R', 'Y', 'G'];

function usePlanned() {
  const plan = usePlan();
  const planned: Record<string, Record<TransportColor, number>> = {};
  for (const s of plan.suggestions) {
    planned[s.hospitalId] ??= { R: 0, Y: 0, G: 0 };
    planned[s.hospitalId][s.color] += s.patientIds.length;
  }
  return planned;
}

export function HospitalTab() {
  const [open, setOpen] = useState<string | null>(null);
  const [county, setCounty] = useState<string>('新竹縣');
  const planned = usePlanned();
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 10 }}>
        {COUNTY_ORDER.map((c) => (
          <button key={c} className={`btn sm ${county === c ? 'on' : ''}`} onClick={() => setCounty(c)}>
            {c}
          </button>
        ))}
      </div>
      <section className="section">
        {HOSPITALS.filter((h) => h.county === county).map((h) => (
          <HospitalRow key={h.id} h={h} planned={planned[h.id]} onOpen={() => setOpen(h.id)} />
        ))}
      </section>
      <p className="muted small">
        點醫院名稱可修正車程、填自行到院人數、調整容量與除污能力。
        <br />
        資料版本：{HOSPITAL_DB_META.version}（{HOSPITAL_DB_META.updatedAt}）｜{HOSPITAL_DB_META.source}
        <br />
        {HOSPITAL_DB_META.note}
      </p>
      {open && <HospitalSheet id={open} planned={planned[open]} onClose={() => setOpen(null)} />}
    </>
  );
}

function HospitalRow({ h, planned, onOpen }: { h: Hospital; planned?: Record<TransportColor, number>; onOpen: () => void }) {
  const rt = useStore((s) => s.runtime[h.id]);
  const settings = useStore((s) => s.incident.settings);
  const travel = useStore((s) => s.travel.byHospital[h.id]);
  const toggleBypass = useStore((s) => s.toggleBypass);
  const cap = capacityOf(h, rt, settings.nightMode);
  const tr = effectiveTravel(travel, rt, settings);
  const self = rt.selfPresented;

  return (
    <div className={`hrow ${rt.bypass ? 'closed' : ''}`}>
      <button className="hinfo" onClick={onOpen}>
        <div className="hname">
          {h.short}
          {rt.bypass && <span style={{ color: 'var(--red)', fontSize: 14 }}> 關閉中</span>}
          <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>
            {' '}
            {tr ? `${Math.round(tr.go)}分` : ''}
            {rt.travelAdjustMin !== 0 && `(${rt.travelAdjustMin > 0 ? '+' : ''}${rt.travelAdjustMin})`}
          </span>
        </div>
        <div className="hmeta">
          <span className={`badge ${h.level}`}>{LEVEL_NAME[h.level]}</span>
          {h.traumaLevel !== h.level && <span className={`badge ${h.traumaLevel}`}>外傷{LEVEL_NAME[h.traumaLevel]}</span>}
          {h.tags.map((t) => (
            <span key={t} className="badge">
              {TAG_NAME[t] ?? t}
            </span>
          ))}
          {rt.decon && <span className="badge">可除污</span>}
        </div>
        <div className="caps">
          {TC.map((c) => {
            const used = rt.used[c] + self[c];
            const p = planned?.[c] ?? 0;
            return (
              <span key={c} className={`c ${used + p >= cap[c] ? 'over' : ''}`}>
                <i className={`dot ${c}`} />
                {used}
                {p ? <span className="muted">+{p}</span> : ''}/{cap[c]}
              </span>
            );
          })}
        </div>
      </button>
      <button className={`btn ${rt.bypass ? 'go' : 'danger'}`} style={{ minWidth: 84 }} onClick={() => toggleBypass(h.id)}>
        {rt.bypass ? '開啟' : '關閉'}
      </button>
    </div>
  );
}

function HospitalSheet({ id, planned, onClose }: { id: string; planned?: Record<TransportColor, number>; onClose: () => void }) {
  const h = HOSPITAL_BY_ID[id];
  const rt = useStore((s) => s.runtime[id]);
  const settings = useStore((s) => s.incident.settings);
  const travel = useStore((s) => s.travel.byHospital[id]);
  const adjustTravel = useStore((s) => s.adjustTravel);
  const adjustSelf = useStore((s) => s.adjustSelfPresented);
  const adjustCapacity = useStore((s) => s.adjustCapacity);
  const toggleDecon = useStore((s) => s.toggleDecon);
  const toggleBypass = useStore((s) => s.toggleBypass);
  const cap = capacityOf(h, rt, settings.nightMode);
  const tr = effectiveTravel(travel, rt, settings);
  const { names } = useTriage();

  return (
    <Sheet onClose={onClose}>
      <h2>
        {h.short} <span className={`badge ${h.level}`}>{LEVEL_NAME[h.level]}級</span>
      </h2>
      <p className="muted small" style={{ marginTop: -6 }}>
        {h.name}｜{h.county}
      </p>

      <h3>量能（實色已收、灰色自行到院、淡色建議中）</h3>
      {TC.map((c) => {
        const total = Math.max(cap[c], 1);
        const pct = (n: number) => `${Math.min(100, (n / total) * 100)}%`;
        const p = planned?.[c] ?? 0;
        return (
          <div className="bar-wrap" key={c}>
            <span className={`chip ${c}`} style={{ padding: '0 4px', fontSize: 13 }}>
              {names[c]}
            </span>
            <div className={`bar ${c}`}>
              <span className="used" style={{ width: pct(rt.used[c]) }} />
              <span className="self" style={{ width: pct(rt.selfPresented[c]) }} />
              <span className="plan" style={{ width: pct(p) }} />
            </div>
            <span className="num">
              {rt.used[c] + rt.selfPresented[c]}
              {p ? `+${p}` : ''}/{cap[c]}
            </span>
          </div>
        );
      })}

      <h3>車程修正（目前 {tr ? Math.round(tr.go) : '—'} 分）</h3>
      <div className="setrow">
        <span>人工修正</span>
        <Stepper value={rt.travelAdjustMin} step={5} onChange={(v) => adjustTravel(id, v - rt.travelAdjustMin)} format={(v) => `${v > 0 ? '+' : ''}${v}分`} />
      </div>

      <h3>自行到院（醫院回報已湧入人數）</h3>
      {TC.map((c) => (
        <div className="setrow" key={c}>
          <span className={`chip ${c}`}>{names[c]}傷</span>
          <Stepper min={0} value={rt.selfPresented[c]} onChange={(v) => adjustSelf(id, c, v - rt.selfPresented[c])} />
        </div>
      ))}

      <h3>收治容量（{settings.nightMode ? '夜間' : '日間'}）</h3>
      {TC.map((c) => (
        <div className="setrow" key={c}>
          <span className={`chip ${c}`}>{names[c]}傷</span>
          <Stepper min={0} value={cap[c]} onChange={(v) => adjustCapacity(id, c, v - cap[c])} />
        </div>
      ))}

      <div className="grid g2" style={{ marginTop: 12 }}>
        <button className={`btn ${rt.decon ? 'on' : ''}`} onClick={() => toggleDecon(id)}>
          除污能力：{rt.decon ? '有' : '無'}
        </button>
        <button className={`btn ${rt.bypass ? 'go' : 'danger'}`} onClick={() => toggleBypass(id)}>
          {rt.bypass ? '重新開啟' : '關閉（Bypass）'}
        </button>
      </div>
    </Sheet>
  );
}
