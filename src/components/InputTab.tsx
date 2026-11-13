import { useState } from 'react';
import { HOSPITAL_BY_ID } from '../data/hospitals';
import { FIRE_UNITS, SUPPORT_SOURCES } from '../data/places';
import { useStore } from '../store/store';
import { useRules, useTriage } from '../store/usePlan';
import { PATIENT_TAGS, RED_CLASSES, TRIAGE_SYSTEM_NAME, VEHICLE_STATUS_NAME, type Color, type Patient, type Vehicle } from '../types';
import { DoubleTapButton, Sheet, Stepper, clockAfter } from './common';

export function InputTab() {
  const patients = useStore((s) => s.patients);
  const [openPatient, setOpenPatient] = useState<string | null>(null);
  const [showSent, setShowSent] = useState(false);

  const waiting = patients.filter((p) => p.status === 'waiting');
  const sent = patients.filter((p) => p.status === 'sent');

  return (
    <>
      <TriagePad />

      <section className="section">
        <h2>
          待送傷患 <span className="muted small">點代碼：ABCD／標籤／再檢傷／卡號</span>
        </h2>
        {waiting.length === 0 && <div className="empty">尚無待送傷患</div>}
        <div className="ptags">
          {waiting.map((p) => (
            <PatientChip key={p.id} p={p} onClick={() => setOpenPatient(p.id)} />
          ))}
        </div>
        {sent.length > 0 && (
          <>
            <button className="btn sm full" style={{ marginTop: 8 }} onClick={() => setShowSent(!showSent)}>
              {showSent ? '隱藏' : '顯示'}已送出（{sent.length}）
            </button>
            {showSent && (
              <div className="ptags" style={{ marginTop: 8 }}>
                {sent.map((p) => (
                  <PatientChip key={p.id} p={p} onClick={() => setOpenPatient(p.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {openPatient && <PatientSheet id={openPatient} onClose={() => setOpenPatient(null)} />}
    </>
  );
}

function TriagePad() {
  const patients = useStore((s) => s.patients);
  const addPatient = useStore((s) => s.addPatient);
  const removeLast = useStore((s) => s.removeLastPatient);
  const { sys, names, sub } = useTriage();
  const count = (c: Color) => patients.filter((p) => p.color === c).length;
  const canUndo = (c: Color) => patients.some((p) => p.color === c && p.status === 'waiting');
  const undoBtn = (c: Color) => (
    <button className="triage-undo" disabled={!canUndo(c)} onClick={() => removeLast(c)}>
      −1 撤銷
    </button>
  );
  return (
    <section className="section">
      <div className="muted small" style={{ marginBottom: 6 }}>
        檢傷系統：{TRIAGE_SYSTEM_NAME[sys]}（可在「事件 → 設定」切換）
      </div>
      <div className="red-block">
        <div className="red-head">
          <span>
            ＋{names.R}
            {sub.R && <small> {sub.R}</small>}
            <span className="muted small">　點 ABCD 新增</span>
          </span>
          <span className="n">{count('R')}</span>
        </div>
        <div className="grid g4">
          {RED_CLASSES.map((rc) => (
            <button key={rc.id} className="triage-btn R abcd" onClick={() => addPatient('R', rc.id)}>
              <span className="l">{rc.id}</span>
              <span className="nm">{rc.name}</span>
              <span className="c">{patients.filter((p) => p.color === 'R' && p.redClass === rc.id).length}</span>
            </button>
          ))}
        </div>
        {undoBtn('R')}
      </div>
      <div className="grid g3" style={{ marginTop: 8 }}>
        {(['Y', 'G', 'K'] as Color[]).map((c) => (
          <div className="triage-col" key={c}>
            <button className={`triage-btn ${c}`} onClick={() => addPatient(c)}>
              <span>＋{names[c]}</span>
              {sub[c] && <small>{sub[c]}</small>}
              <span className="n">{count(c)}</span>
            </button>
            {undoBtn(c)}
          </div>
        ))}
      </div>
    </section>
  );
}

function PatientChip({ p, onClick }: { p: Patient; onClick: () => void }) {
  const tagNames = p.tags.map((t) => PATIENT_TAGS.find((x) => x.id === t)?.name ?? t);
  const sub =
    p.status === 'sent' && p.hospitalId
      ? `➔${HOSPITAL_BY_ID[p.hospitalId]?.short}`
      : [p.prevLabels.length ? `←${p.prevLabels[p.prevLabels.length - 1]}` : '', tagNames.join('·')].filter(Boolean).join(' ');
  return (
    <button className={`ptag ${p.color} ${p.status === 'sent' ? 'sent' : ''}`} onClick={onClick}>
      {p.label}
      {sub && <small>{sub}</small>}
    </button>
  );
}

function PatientSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const p = useStore((s) => s.patients.find((x) => x.id === id));
  const toggleTag = useStore((s) => s.toggleTag);
  const retriage = useStore((s) => s.retriage);
  const setRedClass = useStore((s) => s.setRedClass);
  const { names } = useTriage();
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
        <span className={`chip ${p.color}`} style={{ fontSize: 22 }}>
          {p.label}
        </span>
        {p.prevLabels.length > 0 && <span className="muted small">原：{p.prevLabels.join('→')}</span>}
        {p.status === 'sent' && <span className="muted small">已送出 ➔ {HOSPITAL_BY_ID[p.hospitalId ?? '']?.short}</span>}
      </h2>

      <h3>標籤</h3>
      <div className="grid g4">
        {tags.map((t) => (
          <button
            key={t.id}
            className={`btn sm ${p.tags.includes(t.id) ? 'on' : ''}`}
            style={rules.patientTags.includes(t.id) && !p.tags.includes(t.id) ? { borderColor: 'var(--orange)' } : undefined}
            onClick={() => toggleTag(p.id, t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      {p.status === 'waiting' && (
        <>
          {p.color === 'R' && (
            <>
              <h3>紅傷分類（ABCD）</h3>
              <div className="grid g4">
                {RED_CLASSES.map((rc) => (
                  <button key={rc.id} className={`btn sm ${p.redClass === rc.id ? 'on' : ''}`} onClick={() => setRedClass(p.id, rc.id)}>
                    {rc.id} {rc.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <h3>再檢傷改色（保留原代碼）</h3>
          {p.color !== 'R' && (
            <div className="grid g4" style={{ marginBottom: 6 }}>
              {RED_CLASSES.map((rc) => (
                <button key={rc.id} className="btn sm chip R" onClick={() => retriage(p.id, 'R', rc.id)}>
                  改{names.R}-{rc.id}
                </button>
              ))}
            </div>
          )}
          <div className="grid g3">
            {(['Y', 'G', 'K'] as Color[]).map((c) => (
              <button key={c} className={`btn sm chip ${c}`} disabled={p.color === c} onClick={() => retriage(p.id, c)}>
                改{names[c]}
              </button>
            ))}
          </div>
        </>
      )}

      <h3>檢傷卡號（選填）</h3>
      <div className="tagno">{no || '—'}</div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '清除', '0', '⌫'].map((k) => (
          <button
            key={k}
            className="btn sm"
            onClick={() => setNo(p.id, k === '⌫' ? no.slice(0, -1) : k === '清除' ? '' : (no + k).slice(0, 12))}
          >
            {k}
          </button>
        ))}
      </div>

      <h3>紀錄</h3>
      <div className="log">
        {p.history.map((h, i) => (
          <div key={i}>
            <time>{new Date(h.at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</time>
            {h.action}
          </div>
        ))}
      </div>

      {p.status === 'waiting' && (
        <div style={{ marginTop: 12 }}>
          <DoubleTapButton
            className="full"
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

export function VehiclesSection() {
  const vehicles = useStore((s) => s.vehicles);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <section className="section">
      <h2>
        救護車（{vehicles.length}）<span className="spacer" />
        <button className="btn sm primary" onClick={() => setAdding(true)}>
          ＋新增車輛
        </button>
      </h2>
      {vehicles.length === 0 && <div className="empty">尚未加入車輛</div>}
      <div className="vlist">
        {vehicles.map((v) => (
          <VehicleCard key={v.id} v={v} onClick={() => setOpen(v.id)} />
        ))}
      </div>
      {open && <VehicleSheet id={open} onClose={() => setOpen(null)} />}
      {adding && <AddVehicleSheet onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddVehicleSheet({ onClose }: { onClose: () => void }) {
  const addUnit = useStore((s) => s.addUnitVehicle);
  const addSupport = useStore((s) => s.addSupportVehicle);
  const vehicles = useStore((s) => s.vehicles);
  const last = vehicles[vehicles.length - 1];
  return (
    <Sheet onClose={onClose}>
      <h2>新增車輛</h2>
      <p className="muted small" style={{ marginTop: -6 }}>
        點一下＝新增一台（可連點），車號自 91 起。{last && <>剛加入：<b style={{ color: 'var(--text)' }}>{last.name}</b></>}
      </p>
      <h3>縣內分隊</h3>
      <div className="grid g4">
        {FIRE_UNITS.map((u) => (
          <button key={u.name} className="btn sm" onClick={() => addUnit(u.name)}>
            {u.name}
          </button>
        ))}
      </div>
      <h3>支援</h3>
      <div className="grid g2">
        {SUPPORT_SOURCES.map((s) => (
          <button key={s.name} className="btn sm" onClick={() => addSupport(s.name)}>
            {s.name}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** 人力：EMTP（高級）、EMT-2（中級） */
export function crewText(v: Vehicle): string {
  return `EMTP ${v.emtp ?? 0}｜EMT-2 ${v.emt2 ?? 0}`;
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
  const sub = [vehicleCountdown(v, now), v.trips > 0 ? `已 ${v.trips} 趟` : ''].filter(Boolean).join('｜');
  return (
    <button className={`vcard ${v.status}`} onClick={onClick}>
      <span className="name">
        {v.name} <span className="crew">{crewText(v)}</span>
      </span>
      <span className={`st status-${v.status}`}>{VEHICLE_STATUS_NAME[v.status]}</span>
      {sub && <span className="sub">{sub}</span>}
    </button>
  );
}

export function VehicleSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const v = useStore((s) => s.vehicles.find((x) => x.id === id));
  const now = useStore((s) => s.now);
  const setStatus = useStore((s) => s.setVehicleStatus);
  const adjustEta = useStore((s) => s.adjustEta);
  const del = useStore((s) => s.deleteVehicle);
  const adjustCrew = useStore((s) => s.adjustCrew);
  if (!v) return null;
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <h2>
        {v.name} <span className={`status-${v.status}`}>{VEHICLE_STATUS_NAME[v.status]}</span>
      </h2>
      <p className="muted" style={{ marginTop: -4 }}>
        {v.unit}｜已完成 {v.trips} 趟
        <br />
        {vehicleCountdown(v, now)}
        {v.contaminated && v.status !== 'decon' ? '｜⚠ 已污染，返場後需除污' : ''}
      </p>
      <div className="grid">
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
      </div>
      <h3>人力</h3>
      <div className="setrow">
        <span>EMTP（高級）</span>
        <Stepper min={0} max={6} value={v.emtp ?? 0} onChange={(n) => adjustCrew(v.id, 'emtp', n - (v.emtp ?? 0))} format={(n) => `${n}人`} />
      </div>
      <div className="setrow">
        <span>EMT-2（中級）</span>
        <Stepper min={0} max={6} value={v.emt2 ?? 0} onChange={(n) => adjustCrew(v.id, 'emt2', n - (v.emt2 ?? 0))} format={(n) => `${n}人`} />
      </div>
      {(v.status === 'enroute' || v.status === 'transport') && (
        <>
          <h3>{v.status === 'enroute' ? '到場時間修正' : '返場時間修正'}</h3>
          <div className="grid g4">
            {[-5, -1, 1, 5].map((d) => (
              <button key={d} className="btn sm" onClick={() => adjustEta(v.id, d)}>
                {d > 0 ? `＋${d}` : `−${-d}`}分
              </button>
            ))}
          </div>
        </>
      )}
      <div className="grid g2" style={{ marginTop: 12 }}>
        {v.status !== 'offline' ? (
          <button className="btn warn" onClick={act(() => setStatus(v.id, 'offline'))}>
            離線（改派／故障）
          </button>
        ) : (
          <span />
        )}
        <DoubleTapButton onConfirm={act(() => del(v.id))}>刪除車輛</DoubleTapButton>
      </div>
    </Sheet>
  );
}
