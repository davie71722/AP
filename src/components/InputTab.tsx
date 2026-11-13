import { useState } from 'react';
import { COUNTY_ORDER, HOSPITAL_BY_ID, HOSPITALS } from '../data/hospitals';
import { FIRE_UNITS, SUPPORT_SOURCES } from '../data/places';
import { useStore } from '../store/store';
import { useRules } from '../store/usePlan';
import { COLOR_NAME, PATIENT_TAGS, VEHICLE_STATUS_NAME, type Color, type Patient, type TransportColor, type Vehicle } from '../types';
import { DoubleTapButton, Sheet, Stepper, clockAfter } from './common';

const COLORS: Color[] = ['R', 'Y', 'G', 'K'];

export function InputTab() {
  const patients = useStore((s) => s.patients);
  const addPatient = useStore((s) => s.addPatient);
  const removeLast = useStore((s) => s.removeLastPatient);
  const [openPatient, setOpenPatient] = useState<string | null>(null);
  const [showSent, setShowSent] = useState(false);

  const waiting = patients.filter((p) => p.status === 'waiting');
  const sent = patients.filter((p) => p.status === 'sent');

  return (
    <>
      <section className="section">
        <h2>檢傷（每點一次＝一位傷患）</h2>
        <div className="triage">
          {COLORS.map((c) => {
            const n = patients.filter((p) => p.color === c).length;
            const canUndo = patients.some((p) => p.color === c && p.status === 'waiting');
            return (
              <div className="triage-cell" key={c}>
                <button className={`triage-btn ${c}`} onClick={() => addPatient(c)}>
                  <span>＋{COLOR_NAME[c]}</span>
                  <span className="n">{n}</span>
                </button>
                <button className="btn sm" disabled={!canUndo} onClick={() => removeLast(c)}>
                  −1 撤銷
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2>
          傷患代碼 <span className="muted small">點擊可加標籤、再檢傷、填卡號</span>
        </h2>
        {waiting.length === 0 && <div className="empty">尚無待送傷患</div>}
        <div className="row">
          {waiting.map((p) => (
            <PatientChip key={p.id} p={p} onClick={() => setOpenPatient(p.id)} />
          ))}
        </div>
        {sent.length > 0 && (
          <>
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setShowSent(!showSent)}>
              {showSent ? '隱藏' : '顯示'}已送出（{sent.length}）
            </button>
            {showSent && (
              <div className="row" style={{ marginTop: 8 }}>
                {sent.map((p) => (
                  <PatientChip key={p.id} p={p} onClick={() => setOpenPatient(p.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <VehiclesSection />
      <SelfPresentedSection />

      {openPatient && <PatientSheet id={openPatient} onClose={() => setOpenPatient(null)} />}
    </>
  );
}

function PatientChip({ p, onClick }: { p: Patient; onClick: () => void }) {
  const tagNames = p.tags.map((t) => PATIENT_TAGS.find((x) => x.id === t)?.name ?? t);
  return (
    <button className={`ptag ${p.color} ${p.status === 'sent' ? 'sent' : ''}`} onClick={onClick}>
      {p.label}
      {(p.prevLabels.length > 0 || tagNames.length > 0 || p.status === 'sent') && (
        <small>
          {p.prevLabels.length > 0 && `←${p.prevLabels.join('←')} `}
          {tagNames.join('·')}
          {p.status === 'sent' && p.hospitalId && ` ➔${HOSPITAL_BY_ID[p.hospitalId]?.short}`}
        </small>
      )}
    </button>
  );
}

function PatientSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const p = useStore((s) => s.patients.find((x) => x.id === id));
  const toggleTag = useStore((s) => s.toggleTag);
  const retriage = useStore((s) => s.retriage);
  const setNo = useStore((s) => s.setTriageTagNo);
  const del = useStore((s) => s.deletePatient);
  const rules = useRules();
  if (!p) return null;
  // 事件相關標籤排前面
  const tags = [...PATIENT_TAGS].sort(
    (a, b) => Number(rules.patientTags.includes(b.id)) - Number(rules.patientTags.includes(a.id)),
  );
  const no = p.triageTagNo ?? '';
  return (
    <Sheet onClose={onClose}>
      <h2>
        <span className={`chip ${p.color}`}>{p.label}</span>{' '}
        {p.prevLabels.length > 0 && <span className="muted small">原代碼：{p.prevLabels.join(' → ')}</span>}
        {p.status === 'sent' && <span className="muted small">（已送出 ➔ {HOSPITAL_BY_ID[p.hospitalId ?? '']?.short}）</span>}
      </h2>

      <h3>標籤</h3>
      <div className="grid cols-auto">
        {tags.map((t) => (
          <button
            key={t.id}
            className={`btn ${p.tags.includes(t.id) ? 'on' : ''}`}
            style={rules.patientTags.includes(t.id) && !p.tags.includes(t.id) ? { borderColor: 'var(--orange)' } : undefined}
            onClick={() => toggleTag(p.id, t.id)}
          >
            {p.tags.includes(t.id) ? '✔ ' : ''}
            {t.name}
          </button>
        ))}
      </div>

      {p.status === 'waiting' && (
        <>
          <h3>再檢傷改色（保留原代碼紀錄）</h3>
          <div className="grid cols-4">
            {COLORS.map((c) => (
              <button key={c} className={`btn chip ${c}`} style={{ minHeight: 56 }} disabled={p.color === c} onClick={() => retriage(p.id, c)}>
                改為{COLOR_NAME[c]}
              </button>
            ))}
          </div>
        </>
      )}

      <h3>檢傷卡號（選填）</h3>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="report" style={{ minWidth: 140, minHeight: 48, fontSize: 22 }}>{no || '—'}</div>
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '清除'].map((k) => (
            <button
              key={k}
              className="btn sm"
              onClick={() => setNo(p.id, k === '⌫' ? no.slice(0, -1) : k === '清除' ? '' : (no + k).slice(0, 12))}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <h3>紀錄</h3>
      <div className="log">
        {p.history.map((h, i) => (
          <div key={i}>
            <time>{new Date(h.at).toLocaleTimeString('zh-TW')}</time>
            {h.action}
          </div>
        ))}
      </div>

      {p.status === 'waiting' && (
        <div style={{ marginTop: 12 }}>
          <DoubleTapButton
            onConfirm={() => {
              del(p.id);
              onClose();
            }}
          >
            刪除此傷患
          </DoubleTapButton>
        </div>
      )}
    </Sheet>
  );
}

function VehiclesSection() {
  const vehicles = useStore((s) => s.vehicles);
  const addUnit = useStore((s) => s.addUnitVehicle);
  const addSupport = useStore((s) => s.addSupportVehicle);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="section">
      <h2>救護車</h2>
      <h3>縣內分隊（點一下＝新增一台，車號自 91 起）</h3>
      <div className="grid cols-auto">
        {FIRE_UNITS.map((u) => (
          <button key={u.name} className="btn sm" onClick={() => addUnit(u.name)}>
            {u.name}
          </button>
        ))}
      </div>
      <h3>支援</h3>
      <div className="grid cols-wide">
        {SUPPORT_SOURCES.map((s) => (
          <button key={s.name} className="btn sm" onClick={() => addSupport(s.name)}>
            {s.name}
          </button>
        ))}
      </div>
      <h3>車輛（{vehicles.length}）</h3>
      {vehicles.length === 0 && <div className="empty">尚未加入車輛</div>}
      <div className="grid cols-wide">
        {vehicles.map((v) => (
          <VehicleCard key={v.id} v={v} onClick={() => setOpen(v.id)} />
        ))}
      </div>
      {open && <VehicleSheet id={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

export function vehicleCountdown(v: Vehicle, now: number): string {
  if (v.status === 'enroute') {
    const left = (v.etaToSceneMin ?? 0) - (now - v.addedAt) / 60000;
    return left > 0 ? `到場約 ${Math.ceil(left)} 分` : '應已到場，請確認';
  }
  if (v.status === 'transport' && v.returnAt) {
    const left = (v.returnAt - now) / 60000;
    return left > 0 ? `返場約 ${Math.ceil(left)} 分（${clockAfter(now, left)}）` : '應已返場，請確認';
  }
  if (v.status === 'decon') return '須除污後才可再派';
  return '';
}

function VehicleCard({ v, onClick }: { v: Vehicle; onClick: () => void }) {
  const now = useStore((s) => s.now);
  return (
    <button className={`vcard ${v.status}`} onClick={onClick}>
      <span className="name">{v.name}</span>
      <span className={`status-${v.status}`}>
        {VEHICLE_STATUS_NAME[v.status]}
        {v.trips > 0 && <span className="muted">｜已 {v.trips} 趟</span>}
      </span>
      <span className="small muted">{vehicleCountdown(v, now)}</span>
    </button>
  );
}

export function VehicleSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const v = useStore((s) => s.vehicles.find((x) => x.id === id));
  const now = useStore((s) => s.now);
  const setStatus = useStore((s) => s.setVehicleStatus);
  const adjustEta = useStore((s) => s.adjustEta);
  const del = useStore((s) => s.deleteVehicle);
  if (!v) return null;
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <h2>
        {v.name} <span className={`status-${v.status} small`}>{VEHICLE_STATUS_NAME[v.status]}</span>
      </h2>
      <p className="muted">
        {v.unit}｜已完成 {v.trips} 趟｜{vehicleCountdown(v, now)}
        {v.contaminated && v.status !== 'decon' ? '｜⚠ 已污染，返場後需除污' : ''}
      </p>
      <div className="grid cols-2">
        {v.status === 'enroute' && (
          <button className="btn go" onClick={act(() => setStatus(v.id, 'standby'))}>
            ✔ 已到場待命
          </button>
        )}
        {v.status === 'transport' && (
          <button className="btn go" onClick={act(() => setStatus(v.id, 'standby'))}>
            ✔ 已返場{v.contaminated ? '（轉待除污）' : ''}
          </button>
        )}
        {v.status === 'decon' && (
          <button className="btn go" onClick={act(() => setStatus(v.id, 'standby'))}>
            ✔ 除污完成，解除
          </button>
        )}
        {v.status === 'offline' && (
          <button className="btn go" onClick={act(() => setStatus(v.id, 'standby'))}>
            ✔ 恢復現場待命
          </button>
        )}
        {v.status !== 'offline' && (
          <button className="btn warn" onClick={act(() => setStatus(v.id, 'offline'))}>
            離線（被改派／故障）
          </button>
        )}
      </div>
      {(v.status === 'enroute' || v.status === 'transport') && (
        <>
          <h3>{v.status === 'enroute' ? '到場時間修正' : '返場時間修正'}</h3>
          <div className="row">
            <button className="btn" onClick={() => adjustEta(v.id, -5)}>
              −5 分
            </button>
            <button className="btn" onClick={() => adjustEta(v.id, -1)}>
              −1 分
            </button>
            <button className="btn" onClick={() => adjustEta(v.id, 1)}>
              ＋1 分
            </button>
            <button className="btn" onClick={() => adjustEta(v.id, 5)}>
              ＋5 分
            </button>
          </div>
        </>
      )}
      <div style={{ marginTop: 12 }}>
        <DoubleTapButton onConfirm={act(() => del(v.id))}>刪除車輛</DoubleTapButton>
      </div>
    </Sheet>
  );
}

function SelfPresentedSection() {
  const runtime = useStore((s) => s.runtime);
  const adjust = useStore((s) => s.adjustSelfPresented);
  const [all, setAll] = useState(false);
  const list = HOSPITALS.filter((h) => all || h.county === '新竹縣' || h.county === '新竹市').sort(
    (a, b) => COUNTY_ORDER.indexOf(a.county) - COUNTY_ORDER.indexOf(b.county),
  );
  const total = HOSPITALS.reduce((n, h) => {
    const s = runtime[h.id].selfPresented;
    return n + s.R + s.Y + s.G;
  }, 0);
  return (
    <section className="section">
      <h2>
        醫院自行到院 <span className="muted small">（例：東元回報已湧入 8 名綠傷；共 {total} 人）</span>
      </h2>
      {list.map((h) => (
        <div key={h.id} className="row" style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
          <b style={{ minWidth: 110 }}>{h.short}</b>
          {(['R', 'Y', 'G'] as TransportColor[]).map((c) => (
            <span key={c} className="row">
              <span className={`chip ${c}`}>{COLOR_NAME[c]}</span>
              <Stepper small min={0} value={runtime[h.id].selfPresented[c]} onChange={(v) => adjust(h.id, c, v - runtime[h.id].selfPresented[c])} />
            </span>
          ))}
        </div>
      ))}
      <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>
        {all ? '只顯示新竹縣市' : '顯示桃園、苗栗醫院'}
      </button>
    </section>
  );
}
