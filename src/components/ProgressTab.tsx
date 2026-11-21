// 送醫進度：上方醫院處置狀況（含現場到院車程），下方已出發車輛與經過時間
import { useState } from 'react';
import { HOSPITAL_BY_ID, HOSPITALS } from '../data/hospitals';
import { effectiveTravel } from '../engine/plan';
import { useTriage } from '../store/usePlan';
import { useStore } from '../store/store';
import type { Hospital, Patient } from '../types';
import { clockAfter, SentCounts } from './common';
import { trafficLabel } from '../travel/traffic';
import { HospitalSheet } from './HospitalTab';
import { VehicleSheet } from './InputTab';

export function ProgressTab() {
  const [more, setMore] = useState(false);
  const { names } = useTriage();
  const [showLoad, setShowLoad] = useState(false);
  const setStrain = useStore((s) => s.setStrain);
  const toggleBypass = useStore((s) => s.toggleBypass);
  const [openH, setOpenH] = useState<string | null>(null);
  const [openV, setOpenV] = useState<string | null>(null);
  const runtime = useStore((s) => s.runtime);
  const travel = useStore((s) => s.travel);
  const settings = useStore((s) => s.incident.settings);
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const now = useStore((s) => s.now);
  const undoStack = useStore((s) => s.undoStack);
  const undo = useStore((s) => s.undo);

  const go = (h: Hospital) => effectiveTravel(travel.byHospital[h.id], runtime[h.id], settings)?.go;
  const byGo = (a: Hospital, b: Hospital) => (go(a) ?? 999) - (go(b) ?? 999);
  const featured = HOSPITALS.filter((h) => h.featured).sort(byGo);
  const others = HOSPITALS.filter((h) => !h.featured).sort(byGo);

  // 已出發：依車輛與出發時間分組
  const trips = new Map<string, Patient[]>();
  for (const p of patients) {
    if (p.status !== 'sent' || !p.sentAt) continue;
    const key = `${p.vehicleId ?? 'duty'}@${p.sentAt}`;
    trips.set(key, [...(trips.get(key) ?? []), p]);
  }
  const tripList = [...trips.entries()].map(([key, ps]) => ({ key, ps, sentAt: ps[0].sentAt!, arriveAt: ps[0].arriveAt })).sort((a, b) => b.sentAt - a.sentAt);

  const closedCount = HOSPITALS.filter((h) => runtime[h.id]?.bypass).length;
  const fullCount = HOSPITALS.filter((h) => (runtime[h.id]?.strain ?? 0) === 2).length;
  const row = (h: Hospital) => {
    const rt = runtime[h.id];
    const g = go(h);
    return (
      <div key={h.id} className={`hosp-row ${rt.bypass ? 'closed' : ''} ${(rt.strain ?? 0) === 2 ? 'full' : ''}`}>
        <button className="hn" onClick={() => setOpenH(h.id)}>
          {h.short}
        </button>
        <span className="hgo">{g !== undefined ? `${Math.round(g)}′` : '—'}</span>
        <SentCounts rt={rt} names={names} />
        <span className="hbtns">
          <button
            className={`btn sm full-btn ${(rt.strain ?? 0) === 2 ? 'on' : ''}`}
            disabled={rt.bypass}
            onClick={() => setStrain(h.id, (rt.strain ?? 0) === 2 ? 0 : 2)}
          >
            滿載
          </button>
          {((rt.strain ?? 0) === 2 || rt.bypass) && (
            <button className={`btn sm close-btn ${rt.bypass ? 'on' : ''}`} onClick={() => toggleBypass(h.id)}>
              關閉
            </button>
          )}
        </span>
      </div>
    );
  };

  return (
    <>
      <button className={`btn full load-btn ${showLoad ? 'on' : ''}`} onClick={() => setShowLoad(!showLoad)}>
        醫院負荷
        <span className="row" style={{ gap: 4 }}>
          {fullCount > 0 && <span className="chip R">滿載 {fullCount}</span>}
          {closedCount > 0 && <span className="chip K">關閉 {closedCount}</span>}
        </span>
        {showLoad ? '▲' : '▼'}
      </button>
      {showLoad && (
        <section className="section" style={{ marginTop: 8 }}>
          <div className="muted small" style={{ marginBottom: 6 }}>
            車程（現場出發）{travel.source === 'online' ? '即時路況' : `估算・${trafficLabel(new Date())}`}｜已後送牌數（含自行到院）｜滿載仍可送；滿載後可再按關閉（不送）
          </div>
          <div className="hosp-list">{featured.map(row)}</div>
          <button className="btn sm full" style={{ marginTop: 8 }} onClick={() => setMore(!more)}>
            更多醫院 {more ? '▲' : '▼'}
          </button>
          {more && <div className="hosp-list" style={{ marginTop: 8 }}>{others.map(row)}</div>}
        </section>
      )}

      <section className="section">
        <h2>
          已出發 <span className="muted small">{tripList.length} 趟</span>
        </h2>
        {tripList.length === 0 && <div className="empty">尚未有車出發</div>}
        {tripList.map((t) => {
          const v = vehicles.find((x) => x.id === t.ps[0].vehicleId);
          const h = t.ps[0].hospitalId ? HOSPITAL_BY_ID[t.ps[0].hospitalId] : undefined;
          const elapsed = Math.max(0, Math.floor((now - t.sentAt) / 60000));
          const arrived = t.arriveAt ? now >= t.arriveAt : false;
          return (
            <button key={t.key} className="trip" onClick={() => v && setOpenV(v.id)}>
              <div className="trip-top">
                <b>{v ? v.name : t.ps[0].byDuty ? '勤務車' : '—'}</b>
                <span className="arrow">➔</span>
                <b>{h ? h.short : '未定'}</b>
                <span className="spacer" />
                <span className="elapsed">{elapsed}′</span>
              </div>
              <div className="trip-sub">
                {t.ps.map((p) => (
                  <span key={p.id} className={`chip ${p.color}`}>
                    {p.label}
                  </span>
                ))}
                <span className="muted small">
                  出發 {clockAfter(t.sentAt, 0)}
                  {t.arriveAt ? `｜${arrived ? '已抵院' : `預估抵院 ${clockAfter(t.arriveAt, 0)}`}` : ''}
                </span>
              </div>
              {t.ps.some((p) => p.note) && <div className="muted small">{t.ps.map((p) => p.note).filter(Boolean).join('；')}</div>}
            </button>
          );
        })}
        {undoStack.length > 0 && (
          <button className="btn warn full" style={{ marginTop: 8 }} onClick={undo}>
            ↶ 撤銷上一筆（{undoStack[undoStack.length - 1].label}）
          </button>
        )}
      </section>
      {openH && <HospitalSheet id={openH} onClose={() => setOpenH(null)} />}
      {openV && <VehicleSheet id={openV} onClose={() => setOpenV(null)} />}
    </>
  );
}
