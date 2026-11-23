import { lazy, Suspense, useState } from 'react';

const BodyMap = lazy(() => import('./BodyMap').then((m) => ({ default: m.BodyMap })));
import { HOSPITAL_BY_ID, HOSPITALS } from '../data/hospitals';
import { effectiveCap, effectiveTravel } from '../engine/plan';
import { brigadeOrder, FIRE_UNITS, SUPPORT_SOURCES, unitsOf } from '../data/places';
import { manualFactor, sourceEtaMin, useStore } from '../store/store';
import { usePlan, useRules, useTriage } from '../store/usePlan';
import { holdUnlocked, otherVehicleName, PATIENT_TAGS, RED_CLASSES, VEHICLE_STATUS_NAME, injuryText, type Color, type Patient, type Vehicle } from '../types';
import { DoubleTapButton, Sheet, Stepper, clockAfter } from './common';
import { fmtClock } from '../engine/actions';
import { KeyFlags, TraumaPicker, TraumaWarnings } from './TraumaPicker';
import { traumaWarnings } from '../data/traumaRules';
import { keyFlags } from '../data/trauma';
import { PhotoSection } from './Photos';
import { lastAssessed, reassessDue, tourniquets, TQ_ALERT_MIN, TQ_WARN_MIN } from '../engine/care';
import { decodeQrFromFile, patNoFromQr } from './qr';

export function InputTab() {
  const patients = useStore((s) => s.patients);
  const [openPatient, setOpenPatient] = useState<string | null>(null);
  const [showSent, setShowSent] = useState(false);

  const waiting = patients.filter((p) => p.status === 'waiting');
  const sent = patients.filter((p) => p.status !== 'waiting');

  return (
    <>
      <TriagePad />

      <section className="section">
        <h2>
          待送
        </h2>
        
        <div className="ptags">
          {waiting.map((p) => (
            <PatientChip key={p.id} p={p} onClick={() => setOpenPatient(p.id)} />
          ))}
        </div>
        {sent.length > 0 && (
          <>
            <button className="btn sm full" style={{ marginTop: 8 }} onClick={() => setShowSent(!showSent)}>
              已送出／離開 {sent.length} {showSent ? '▲' : '▼'}
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

export function TriagePad() {
  const patients = useStore((s) => s.patients);
  const addPatient = useStore((s) => s.addPatient);
  const removeLast = useStore((s) => s.removeLastPatient);
  const { names, sub } = useTriage();
  const count = (c: Color) => patients.filter((p) => p.color === c).length;
  const canUndo = (c: Color) => patients.some((p) => p.color === c && p.status === 'waiting');
  const undoBtn = (c: Color) => (
    <button className="triage-undo" disabled={!canUndo(c)} onClick={() => removeLast(c)}>
      −1 撤銷
    </button>
  );
  return (
    <section className="section">
      <div className="red-block">
        <div className="red-head">
          <span>
            ＋{names.R}
            {sub.R && <small> {sub.R}</small>}
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

/** 綠傷：自行離開、勤務車載走 */
function GreenActions({ id, onDone }: { id: string; onDone: () => void }) {
  const [pickHospital, setPickHospital] = useState(false);
  const setLeft = useStore((s) => s.setLeft);
  const duty = useStore((s) => s.dutyTransport);
  const runtime = useStore((s) => s.runtime);
  const travel = useStore((s) => s.travel.byHospital);
  const settings = useStore((s) => s.incident.settings);
  const options = HOSPITALS.filter(
    (h) =>
      (h.county === '新竹縣' || h.county === '新竹市') &&
      h.level !== 'heavy' &&
      !runtime[h.id]?.bypass &&
      effectiveCap(h, runtime[h.id], settings).G - runtime[h.id].used.G - runtime[h.id].selfPresented.G > 0,
  )
    .map((h) => ({ h, go: effectiveTravel(travel[h.id], runtime[h.id], settings)?.go ?? 99 }))
    .sort((a, b) => a.go - b.go)
    .slice(0, 6);
  return (
    <>
      <div className="grid g2">
        <button
          className="btn"
          onClick={() => {
            setLeft(id, true);
            onDone();
          }}
        >
          自行離開
        </button>
        <button className={`btn ${pickHospital ? 'on' : ''}`} onClick={() => setPickHospital(!pickHospital)}>
          勤務車載走
        </button>
      </div>
      {pickHospital && (
        <div className="grid g2" style={{ marginTop: 8 }}>
          {options.map(({ h, go }) => (
            <button
              key={h.id}
              className="btn sm"
              onClick={() => {
                duty(id, h.id);
                onDone();
              }}
            >
              {h.short} <span className="muted">{Math.round(go)}′</span>
            </button>
          ))}
          <button
            className="btn sm"
            onClick={() => {
              duty(id, undefined);
              onDone();
            }}
          >
            未定
          </button>
        </div>
      )}
    </>
  );
}

export function PatientChip({ p, onClick }: { p: Patient; onClick: () => void }) {
  const tagNames = p.tags.map((t) => PATIENT_TAGS.find((x) => x.id === t)?.name ?? t);
  const sub =
    p.status === 'left'
      ? '離開'
      : p.status === 'sent'
        ? `${p.byDuty ? otherVehicleName(p)[0] : ''}➔${p.hospitalId ? HOSPITAL_BY_ID[p.hospitalId]?.short : ''}`
      : [
          p.trapped ? '⛓受困' : p.extricatedAt ? `脫困${fmtClock(p.extricatedAt)}` : '',
          p.prevLabels.length ? `←${p.prevLabels[p.prevLabels.length - 1]}` : '',
          tagNames.join('·'),
        ]
          .filter(Boolean)
          .join(' ');
  const flagged = keyFlags(p.trauma).length > 0;
  const now = useStore((s) => s.now);
  const settings = useStore((s) => s.incident.settings);
  const tq = p.status === 'left' ? [] : tourniquets(p, now);
  const tqMax = tq.reduce((m, t) => Math.max(m, t.min), -1);
  const due = reassessDue(p, settings, now);
  return (
    <button className={`ptag ${p.color} ${p.status !== 'waiting' ? 'sent' : ''} ${p.trapped ? 'trapped' : ''}`} onClick={onClick}>
      {flagged && <i className="kf-dot" />}
      {due !== null && due <= 0 && <i className="re-dot" title="待再評估" />}
      {p.label}
      {tqMax >= 0 && <small className={`tq-badge ${tqMax >= TQ_ALERT_MIN ? 'alert' : tqMax >= TQ_WARN_MIN ? 'warn' : ''}`}>TQ {tqMax}′</small>}
      {sub && <small>{sub}</small>}
    </button>
  );
}

export function PatientSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const p = useStore((s) => s.patients.find((x) => x.id === id));
  const toggleTag = useStore((s) => s.toggleTag);
  const retriage = useStore((s) => s.retriage);
  const setRedClass = useStore((s) => s.setRedClass);
  const setLeft = useStore((s) => s.setLeft);
  const { names } = useTriage();
  const setNote = useStore((s) => s.setPatientNote);
  const setWounds = useStore((s) => s.setWounds);
  const setTrauma = useStore((s) => s.setTrauma);
  const [showMap, setShowMap] = useState(false);
  const del = useStore((s) => s.deletePatient);
  const startAt = useStore((s) => s.incident.startAt);
  const now = useStore((s) => s.now);
  const rules = useRules();
  if (!p) return null;
  return (
    <Sheet onClose={onClose}>
      <h2>
        <span className={`chip ${p.color}`} style={{ fontSize: 22 }}>
          {p.label}
        </span>
        {p.prevLabels.length > 0 && <span className="muted small">原：{p.prevLabels.join('→')}</span>}
        {p.status === 'sent' && <span className="muted small">已送出 ➔ {HOSPITAL_BY_ID[p.hospitalId ?? '']?.short}</span>}
      </h2>

      {/* 照片與拍拍尺放最上方：到病人身邊先拍照、掃拍拍尺 */}
      {p.color !== 'K' && (
        <>
          <PhotoSection patientId={p.id} />
          <PatNoField p={p} />
        </>
      )}

      {p.status === 'waiting' && p.color !== 'R' && (
        <div className="upgrade-red">
          <div className="ur-title">⬆ 升級為{names.R}（危急）</div>
          <div className="grid g4">
            {RED_CLASSES.map((rc) => (
              <button key={rc.id} className="triage-btn R abcd" onClick={() => retriage(p.id, 'R', rc.id)}>
                <span className="l">{rc.id}</span>
                <span className="nm">{rc.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <CareTimers p={p} />

      {p.color === 'G' && p.status === 'waiting' && !p.trapped && <GreenActions id={p.id} onDone={onClose} />}

      {rules.hazmat && (
        <button className={`btn full ${p.tags.includes('decontaminated') ? 'on' : ''}`} style={{ marginTop: 8 }} onClick={() => toggleTag(p.id, 'decontaminated')}>
          {p.tags.includes('decontaminated') ? '✔ 已除污' : '已除污'}
        </button>
      )}

      {p.color !== 'K' && (
        <>
          <h3>創傷與處置</h3>
          <div className="grid g3 ptag-row">
            {(['peds', 'minor', 'pregnant'] as const).map((t) => (
              <button key={t} className={`btn sm ${p.tags.includes(t) ? 'on' : ''}`} onClick={() => toggleTag(p.id, t)}>
                {p.tags.includes(t) ? '✔ ' : ''}
                {PATIENT_TAGS.find((x) => x.id === t)?.name}
              </button>
            ))}
          </div>
          <TraumaPicker color={p.color} value={p.trauma ?? []} onChange={(t) => setTrauma(p.id, t)} tags={p.tags} age={p.personal?.age} />
        </>
      )}

      <h3>傷口部位</h3>
      <button className={`btn full ${showMap ? 'on' : ''}`} onClick={() => setShowMap(!showMap)}>
        🧍 人形圖{p.wounds?.length ? `（${p.wounds.length} 處）` : '：點部位記錄傷口'} {showMap ? '▲' : '▼'}
      </button>
      {showMap && (
        <Suspense fallback={<div className="empty">載入人形圖…</div>}>
          <BodyMap
            wounds={p.wounds ?? []}
            onChange={(w) => setWounds(p.id, w)}
            color={p.color}
            trauma={p.trauma ?? []}
            onTrauma={(t) => setTrauma(p.id, t)}
            tags={p.tags}
            age={p.personal?.age}
          />
        </Suspense>
      )}

      <input
        className="note-input"
        value={p.note ?? ''}
        placeholder="其他註解（例：意識模糊、疑似骨盆骨折）"
        onChange={(e) => setNote(p.id, e.target.value)}
      />
      {injuryText(p) && (
        <div className="tr-out">
          <TraumaWarnings items={traumaWarnings(p.trauma, p.wounds, { tags: p.tags, age: p.personal?.age, startAt, now })} />
          <div className="tr-sub">交接註解</div>
          <KeyFlags flags={keyFlags(p.trauma)} />
          {injuryText(p)}
        </div>
      )}

      {p.status === 'waiting' && (
        <>
          {p.color === 'R' && (
            <>
              <h3>ABCD</h3>
              <div className="grid g4">
                {RED_CLASSES.map((rc) => (
                  <button key={rc.id} className={`btn sm ${p.redClass === rc.id ? 'on' : ''}`} onClick={() => setRedClass(p.id, rc.id)}>
                    {rc.id} {rc.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <h3>再檢傷</h3>
          <div className="grid g3">
            {(['Y', 'G', 'K'] as Color[]).map((c) => (
              <button key={c} className={`btn sm chip ${c}`} disabled={p.color === c} onClick={() => retriage(p.id, c)}>
                改{names[c]}
              </button>
            ))}
          </div>
        </>
      )}

      {p.status === 'left' && (
        <button className="btn full" style={{ marginTop: 12 }} onClick={() => setLeft(p.id, false)}>
          ↶ 恢復待送
        </button>
      )}

      <PersonalSection p={p} />

      <h3>紀錄</h3>
      <div className="log">
        {p.history.map((h, i) => (
          <div key={i}>
            <time>{fmtClock(h.at)}</time>
            {h.action}
          </div>
        ))}
      </div>

      {p.status === 'waiting' && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <DoubleTapButton
            className="sm del-sm"
            onConfirm={() => {
              del(p.id);
              onClose();
            }}
          >
            刪除
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
  const loc = useStore((s) => s.incident.location);
  const factor = useStore((s) => manualFactor(s.incident.settings));
  const travel = useStore((s) => s.travel);
  // 依到場時間排序的鄰近分隊（轄區分隊排第一）
  const near = loc
    ? FIRE_UNITS.map((u) => ({ u, eta: sourceEtaMin(u.name, loc, travel, factor)?.min ?? 99 }))
        .sort((a, b) => Number(b.u.name === loc.unit) - Number(a.u.name === loc.unit) || a.eta - b.eta)
        .slice(0, 6)
    : [];
  return (
    <Sheet onClose={onClose}>
      <h2>
        新增車輛 {last && <span className="chip dim">{last.name}</span>}
      </h2>
      {near.length > 0 && (
        <>
          <h3>鄰近分隊</h3>
          <div className="grid g3">
            {near.map(({ u, eta }) => (
              <button key={u.name} className={`btn sm ${u.name === loc?.unit ? 'on' : ''}`} onClick={() => addUnit(u.name)}>
                {u.name} <span className="muted">{Math.round(eta)}′</span>
              </button>
            ))}
          </div>
        </>
      )}
      {brigadeOrder(loc?.unit).map((b) => (
        <div key={b}>
          <h3>{b}</h3>
          <div className="grid g4">
            {unitsOf(b, loc?.unit).map((u) => (
              <button key={u.name} className="btn sm" onClick={() => addUnit(u.name)}>
                {u.name}
              </button>
            ))}
          </div>
        </div>
      ))}
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
  const willHold = usePlan().pendingHoldId === v.id;
  const sub = [vehicleCountdown(v, now), v.trips > 0 ? `已 ${v.trips} 趟` : ''].filter(Boolean).join('｜');
  return (
    <button className={`vcard ${v.status}`} onClick={onClick}>
      <span className="name">
        {v.name} <span className="crew">{crewText(v)}</span>
      </span>
      <span className={`st status-${v.held ? 'transport' : v.status}`}>{v.held ? '留守' : willHold ? '到場後留守' : VEHICLE_STATUS_NAME[v.status]}</span>
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
  const releaseHold = useStore((s) => s.releaseHold);
  const holdOpen = useStore((s) => holdUnlocked(s.patients));
  const setHold = useStore((s) => s.setHold);
  if (!v) return null;
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <h2>
        {v.name} <span className={`status-${v.held ? 'transport' : v.status}`}>{v.held ? '留守（指揮）' : VEHICLE_STATUS_NAME[v.status]}</span>
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>
        第 {v.trips} 趟完成
        {v.status === 'standby' && <>｜待命 {Math.max(0, Math.floor((now - (v.standbySince ?? v.addedAt)) / 60000))} 分</>}
        {vehicleCountdown(v, now) && <>｜{vehicleCountdown(v, now)}</>}
        {v.contaminated && v.status !== 'decon' ? '｜⚠ 已污染，返場後需除污' : ''}
      </p>
      <div className="grid">
        {v.held && (
          <button className="btn go" disabled={!holdOpen} onClick={act(() => releaseHold(v.id))}>
            {holdOpen ? '解除留守，重新派車' : '留守中（剩最後 2 位傷患才開放派車）'}
          </button>
        )}
        {!v.held && v.status === 'standby' && (
          <button className="btn" onClick={act(() => setHold(v.id, true))}>
            設為留守
          </button>
        )}
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

/** 個案備註：姓名、年齡、性別、電話、拍拍尺號碼（皆可空白；不列入任何分享或回報文字） */
function PersonalSection({ p }: { p: Patient }) {
  const setPersonal = useStore((s) => s.setPersonal);
  const v = p.personal ?? {};
  const [open, setOpen] = useState(!!(v.name || v.age || v.sex || v.phone));
  const field = (k: 'name' | 'age' | 'phone', label: string, mode: 'text' | 'numeric' | 'tel' = 'text', max = 30) => (
    <label className="pf">
      <span>{label}</span>
      <input value={v[k] ?? ''} inputMode={mode} onChange={(e) => setPersonal(p.id, { [k]: e.target.value.slice(0, max) })} />
    </label>
  );
  return (
    <>
      <button className={`btn sm full ${open ? 'on' : ''}`} style={{ marginTop: 12 }} onClick={() => setOpen(!open)}>
        🔒 個案備註（姓名、電話不分享）{v.name ? `：${v.name}` : ''} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="personal">
          {field('name', '姓名')}
          <div className="pf-row">
            {field('age', '年齡', 'numeric', 3)}
            <div className="pf">
              <span>性別</span>
              <div className="seg">
                {(['男', '女'] as const).map((x) => (
                  <button key={x} className={`btn sm ${v.sex === x ? 'on' : ''}`} onClick={() => setPersonal(p.id, { sex: v.sex === x ? undefined : x })}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {field('phone', '電話', 'tel', 20)}
          <p className="muted small" style={{ margin: 0 }}>可留白。姓名、電話只存在系統內；性別、年齡會標在合成照片上。</p>
        </div>
      )}
    </>
  );
}

/** 拍拍尺號碼：可手填或拍 QR Code 帶入；會隨發車分享與通報醫院 */
function PatNoField({ p }: { p: Patient }) {
  const setPersonal = useStore((s) => s.setPersonal);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const scan = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setMsg('');
    try {
      const text = await decodeQrFromFile(f);
      if (!text) return setMsg('讀不到 QR Code，請靠近一點、對準再拍，或直接輸入號碼');
      setPersonal(p.id, { patNo: patNoFromQr(text) });
      setMsg(`✔ 已帶入（QR 內容：${text.slice(0, 40)}）`);
    } catch {
      setMsg('照片讀取失敗');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h3>
        拍拍尺號碼 <span className="muted small">隨發車分享</span>
      </h3>
      <div className="patno">
        <input
          value={p.personal?.patNo ?? ''}
          placeholder="輸入或掃描"
          onChange={(e) => setPersonal(p.id, { patNo: e.target.value.slice(0, 30) })}
        />
        <label className={`btn sm ${busy ? 'dim' : ''}`}>
          {busy ? '讀取中…' : '📷 掃 QR'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              void scan(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {msg && <p className="small" style={{ margin: '4px 0 0', color: msg.startsWith('✔') ? 'var(--green)' : 'var(--orange)' }}>{msg}</p>}
    </>
  );
}

/** 止血帶經過時間與再評估（待送病人） */
function CareTimers({ p }: { p: Patient }) {
  const now = useStore((s) => s.now);
  const settings = useStore((s) => s.incident.settings);
  const mark = useStore((s) => s.markReassessed);
  const tq = tourniquets(p, now);
  const due = reassessDue(p, settings, now);
  const last = lastAssessed(p);
  if (!tq.length && due === null) return null;
  return (
    <div className="care-timers">
      {tq.map((t, i) => (
        <div key={i} className={`tq-line ${t.level}`}>
          ⏱ 止血帶{t.side ? ` ${t.side}` : ''} {fmtClock(t.at)}｜已 {t.min} 分{t.level === 'alert' ? '（逾 2 小時）' : t.level === 'warn' ? '（逾 1 小時）' : ''}
        </div>
      ))}
      {due !== null && last !== null && (
        <div className="re-line">
          <span>
            🩺 {p.reassessedAt ? '上次再評估' : '檢傷'} {fmtClock(last)}｜{due <= 0 ? <b className="over">已逾 {-due} 分</b> : `${due} 分後再評估`}
          </span>
          <button className={`btn sm ${due <= 0 ? 'go' : ''}`} onClick={() => mark(p.id)}>
            ✔ 已再評估
          </button>
        </div>
      )}
    </div>
  );
}
