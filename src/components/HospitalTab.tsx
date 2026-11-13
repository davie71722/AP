import { useState } from 'react';
import { COUNTY_ORDER, HOSPITAL_DB_META, HOSPITALS } from '../data/hospitals';
import { capacityOf, effectiveTravel } from '../engine/plan';
import { useStore } from '../store/store';
import { usePlan } from '../store/usePlan';
import { LEVEL_NAME, type Hospital, type TransportColor } from '../types';
import { Stepper } from './common';

const TAG_NAME: Record<string, string> = { hazmat: '化災責任', peds: '兒科', burn: '燒燙傷', obstetric: '產科' };

export function HospitalTab() {
  const [edit, setEdit] = useState(false);
  const travel = useStore((s) => s.travel);
  return (
    <>
      <section className="section">
        <div className="row">
          <div>
            <b>醫院資料版本：</b>
            {HOSPITAL_DB_META.version}（{HOSPITAL_DB_META.updatedAt}）
            <div className="muted small">{HOSPITAL_DB_META.source}</div>
            <div className="muted small">{HOSPITAL_DB_META.note}</div>
            <div className="muted small">
              車程：{travel.source === 'online' ? '即時' : '離線估算'}
              {travel.updatedAt && `｜最後更新 ${new Date(travel.updatedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </div>
          <span className="spacer" />
          <button className={`btn ${edit ? 'on' : ''}`} onClick={() => setEdit(!edit)}>
            {edit ? '✔ 完成編輯' : '✎ 編輯模式'}
          </button>
        </div>
      </section>
      {COUNTY_ORDER.map((county) => (
        <section className="section" key={county}>
          <h2>{county}</h2>
          {HOSPITALS.filter((h) => h.county === county).map((h) => (
            <HospitalRow key={h.id} h={h} edit={edit} />
          ))}
        </section>
      ))}
    </>
  );
}

function HospitalRow({ h, edit }: { h: Hospital; edit: boolean }) {
  const rt = useStore((s) => s.runtime[h.id]);
  const settings = useStore((s) => s.incident.settings);
  const travel = useStore((s) => s.travel.byHospital[h.id]);
  const toggleBypass = useStore((s) => s.toggleBypass);
  const adjustTravel = useStore((s) => s.adjustTravel);
  const toggleDecon = useStore((s) => s.toggleDecon);
  const adjustCapacity = useStore((s) => s.adjustCapacity);
  const plan = usePlan();
  const cap = capacityOf(h, rt, settings.nightMode);
  const tr = effectiveTravel(travel, rt, settings);
  const planned = { R: 0, Y: 0, G: 0 };
  for (const s of plan.suggestions) if (s.hospitalId === h.id) planned[s.color] += s.patientIds.length;

  return (
    <div className={`hrow ${rt.bypass ? 'closed' : ''}`}>
      <div>
        <div className="hname">
          {h.short} {rt.bypass && <span style={{ color: 'var(--red)' }}>（關閉）</span>}
        </div>
        <div className="hmeta">
          <span className={`badge ${h.level}`}>{LEVEL_NAME[h.level]}級</span>
          {h.traumaLevel !== h.level && <span className={`badge ${h.traumaLevel}`}>外傷{LEVEL_NAME[h.traumaLevel]}</span>}
          {h.tags.map((t) => (
            <span key={t} className="badge">
              {TAG_NAME[t] ?? t}
            </span>
          ))}
          {rt.decon && <span className="badge">可除污</span>}
        </div>
        <div className="hmeta" style={{ marginTop: 2 }}>
          車程 {tr ? `${Math.round(tr.go)} 分` : '—'}
          {rt.travelAdjustMin !== 0 && `（修正 ${rt.travelAdjustMin > 0 ? '+' : ''}${rt.travelAdjustMin}）`}
        </div>
      </div>
      <div className="grid" style={{ gap: 4 }}>
        {(['R', 'Y', 'G'] as TransportColor[]).map((c) => {
          const total = Math.max(cap[c], 1);
          const used = rt.used[c];
          const self = rt.selfPresented[c];
          const pct = (n: number) => `${Math.min(100, (n / total) * 100)}%`;
          return (
            <div className="bar-wrap" key={c}>
              <span className={`chip ${c}`} style={{ padding: '0 5px', fontSize: 13 }}>
                {{ R: '紅', Y: '黃', G: '綠' }[c]}
              </span>
              {edit ? (
                <Stepper small min={0} value={cap[c]} onChange={(v) => adjustCapacity(h.id, c, v - cap[c])} />
              ) : (
                <div className={`bar ${c}`}>
                  <span className="used" style={{ width: pct(used) }} />
                  <span className="self" style={{ width: pct(self) }} />
                  <span className="plan" style={{ width: pct(planned[c]) }} />
                </div>
              )}
              <span className="num">
                {used + self}
                {planned[c] ? `+${planned[c]}` : ''}/{cap[c]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {edit ? (
          <>
            <button className="btn sm" onClick={() => adjustTravel(h.id, -5)}>
              車程 −5
            </button>
            <button className="btn sm" onClick={() => adjustTravel(h.id, 5)}>
              車程 ＋5
            </button>
            <button className={`btn sm ${rt.decon ? 'on' : ''}`} onClick={() => toggleDecon(h.id)}>
              除污 {rt.decon ? '有' : '無'}
            </button>
          </>
        ) : (
          <>
            <button className="btn sm" onClick={() => adjustTravel(h.id, -5)}>
              −5′
            </button>
            <button className="btn sm" onClick={() => adjustTravel(h.id, 5)}>
              ＋5′
            </button>
          </>
        )}
        <button className={`btn ${rt.bypass ? 'go' : 'danger'}`} style={{ minWidth: 96 }} onClick={() => toggleBypass(h.id)}>
          {rt.bypass ? '重新開啟' : '關閉'}
        </button>
      </div>
    </div>
  );
}
