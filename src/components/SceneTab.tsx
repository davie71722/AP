// 現場：加救護車、加病人、選病人＋註解＋選車 → 建議醫院 → 出發
import { useMemo, useState } from 'react';
import { HOSPITAL_BY_ID, HOSPITALS } from '../data/hospitals';
import { BRIGADES, FIRE_UNITS, SUPPORT_SOURCES } from '../data/places';
import { capacityOf, computePlan } from '../engine/plan';
import { manualFactor, sourceEtaMin, useStore } from '../store/store';
import { useRules } from '../store/usePlan';
import type { Patient, Vehicle } from '../types';
import { Sheet } from './common';
import { PatientChip, PatientSheet, TriagePad, VehicleSheet } from './InputTab';

export function SceneTab() {
  const rules = useRules();
  const [selected, setSelected] = useState<string[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const patients = useStore((s) => s.patients);
  const waiting = patients.filter((p) => p.status === 'waiting' && p.color !== 'K');
  const sel = selected.filter((id) => waiting.some((p) => p.id === id));
  const toggle = (id: string) => setSelected((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  return (
    <>
      {rules.alerts.length > 0 && (
        <button className="alert" onClick={() => setAlertsOpen(!alertsOpen)}>
          事件提醒 {alertsOpen ? '▲' : `▼ ${rules.alerts.length}`}
          {alertsOpen && (
            <ul>
              {rules.alerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </button>
      )}
      <VehicleBar />
      <TriagePad />
      <section className="section">
        <h2>
          待送 <span className="muted small">點選病人派車</span>
        </h2>
        <div className="ptags">
          {waiting.map((p) => (
            <SelectableChip key={p.id} p={p} on={sel.includes(p.id)} onClick={() => toggle(p.id)} />
          ))}
        </div>
      </section>
      {sel.length > 0 && <DispatchPanel ids={sel} onDone={() => setSelected([])} />}
    </>
  );
}

function SelectableChip({ p, on, onClick }: { p: Patient; on: boolean; onClick: () => void }) {
  return (
    <div className={`selwrap ${on ? 'on' : ''}`}>
      <PatientChip p={p} onClick={onClick} />
    </div>
  );
}

// ---------- 救護車 ----------
function VehicleBar() {
  const vehicles = useStore((s) => s.vehicles);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const active = vehicles.filter((v) => v.status !== 'offline');
  const tp = active.reduce((n, v) => n + (v.emtp ?? 0), 0);
  const t2 = active.reduce((n, v) => n + (v.emt2 ?? 0), 0);
  return (
    <section className="section">
      <h2>
        救護車 <span className="muted small">{vehicles.length} 台｜TP {tp}｜T2 {t2}</span>
        <span className="spacer" />
        <button className="btn sm primary" onClick={() => setAdding(true)}>
          ＋救護車
        </button>
      </h2>
      <div className="vchips">
        {vehicles.map((v) => (
          <VehicleChip key={v.id} v={v} onClick={() => setOpen(v.id)} />
        ))}
      </div>
      {adding && <AddVehicleSheet onClose={() => setAdding(false)} />}
      {open && <VehicleSheet id={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function crew(v: Vehicle) {
  return `${v.emtp ? `TP${v.emtp > 1 ? '×' + v.emtp : ''}` : ''}${v.emtp && v.emt2 ? '＋' : ''}${v.emt2 ? `T2${v.emt2 > 1 ? '×' + v.emt2 : ''}` : ''}` || '—';
}

function vehicleState(v: Vehicle, now: number): { text: string; cls: string } {
  if (v.held) return { text: '留守', cls: 'held' };
  if (v.status === 'transport') {
    const left = v.returnAt ? Math.ceil((v.returnAt - now) / 60000) : 0;
    return { text: left > 0 ? `返場 ${left}′` : '應已返場', cls: 'transport' };
  }
  if (v.status === 'enroute') return { text: '趕赴中', cls: 'enroute' };
  if (v.status === 'decon') return { text: '待除污', cls: 'decon' };
  if (v.status === 'offline') return { text: '離線', cls: 'offline' };
  return { text: '待命', cls: 'standby' };
}

function VehicleChip({ v, onClick }: { v: Vehicle; onClick: () => void }) {
  const now = useStore((s) => s.now);
  const st = vehicleState(v, now);
  return (
    <button className={`vchip ${st.cls}`} onClick={onClick}>
      <b>{v.name}</b>
      <span>{crew(v)}</span>
      <span className="st">{st.text}</span>
    </button>
  );
}

function AddVehicleSheet({ onClose }: { onClose: () => void }) {
  const add = useStore((s) => s.addVehicle);
  const vehicles = useStore((s) => s.vehicles);
  const loc = useStore((s) => s.incident.location);
  const travel = useStore((s) => s.travel);
  const factor = useStore((s) => manualFactor(s.incident.settings));
  const [unit, setUnit] = useState<string | null>(null);
  const [num, setNum] = useState<number | null>(null);
  const [tp, setTp] = useState(0);
  const [t2, setT2] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);

  const isSupport = !!unit && SUPPORT_SOURCES.some((s) => s.name === unit);
  const prefix = unit ? (FIRE_UNITS.find((u) => u.name === unit)?.name ?? SUPPORT_SOURCES.find((s) => s.name === unit)?.prefix ?? '') : '';
  const nums = isSupport ? [1, 2, 3, 4] : [91, 92, 93];
  const taken = (n: number) => vehicles.some((v) => v.name === `${prefix}${n}`);
  const near = loc
    ? FIRE_UNITS.map((u) => ({ u, eta: sourceEtaMin(u.name, loc, travel, factor)?.min ?? 99 }))
        .sort((a, b) => Number(b.u.name === loc.unit) - Number(a.u.name === loc.unit) || a.eta - b.eta)
        .slice(0, 6)
    : [];

  const pickUnit = (name: string) => {
    setUnit(name);
    const sup = SUPPORT_SOURCES.find((s) => s.name === name);
    const pre = sup ? sup.prefix : name;
    const first = (sup ? [1, 2, 3, 4] : [91, 92, 93]).find((n) => !vehicles.some((v) => v.name === `${pre}${n}`));
    setNum(first ?? null);
  };
  const save = () => {
    if (!unit || num === null || tp + t2 === 0) return;
    add(unit, num, tp, t2);
    setSaved((xs) => [...xs, `${prefix}${num} ${crew({ emtp: tp, emt2: t2 } as Vehicle)}`]);
    setUnit(null);
    setNum(null);
    setTp(0);
    setT2(0);
  };
  const unitBtn = (name: string, extra?: string) => (
    <button key={name} className={`btn sm ${unit === name ? 'on' : ''}`} onClick={() => pickUnit(name)}>
      {name}
      {extra && <span className="muted"> {extra}</span>}
    </button>
  );

  return (
    <Sheet onClose={onClose}>
      <h2>
        救護車到場 {saved.map((s) => <span key={s} className="chip dim">{s}</span>)}
      </h2>
      {near.length > 0 && (
        <>
          <h3>鄰近分隊</h3>
          <div className="grid g3">{near.map(({ u, eta }) => unitBtn(u.name, `${Math.round(eta)}′`))}</div>
        </>
      )}
      {!unit &&
        BRIGADES.map((b) => (
          <div key={b}>
            <h3>{b}</h3>
            <div className="grid g4">{FIRE_UNITS.filter((u) => u.brigade === b).map((u) => unitBtn(u.name))}</div>
          </div>
        ))}
      {!unit && (
        <>
          <h3>支援</h3>
          <div className="grid g2">{SUPPORT_SOURCES.map((s) => unitBtn(s.name))}</div>
        </>
      )}
      {unit && (
        <>
          <h3>車號</h3>
          <div className="grid g4">
            {nums.map((n) => (
              <button key={n} className={`btn ${num === n ? 'on' : ''}`} disabled={taken(n)} onClick={() => setNum(n)}>
                {prefix}
                {n}
              </button>
            ))}
          </div>
          <h3>人員（按幾次就幾人）</h3>
          <div className="grid g3">
            <button className="btn crew-btn" onClick={() => setTp(tp + 1)}>
              TP <b>{tp}</b>
            </button>
            <button className="btn crew-btn" onClick={() => setT2(t2 + 1)}>
              T2 <b>{t2}</b>
            </button>
            <button className="btn sm" onClick={() => (setTp(0), setT2(0))}>
              重設
            </button>
          </div>
          <button className="btn go full" style={{ marginTop: 10 }} disabled={num === null || tp + t2 === 0} onClick={save}>
            存入 {num !== null ? `${prefix}${num}` : ''}
          </button>
          <button className="btn sm full" style={{ marginTop: 8 }} onClick={() => setUnit(null)}>
            換分隊
          </button>
        </>
      )}
    </Sheet>
  );
}

// ---------- 派車 ----------
function DispatchPanel({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const runtime = useStore((s) => s.runtime);
  const travel = useStore((s) => s.travel.byHospital);
  const settings = useStore((s) => s.incident.settings);
  const loc = useStore((s) => s.incident.location);
  const now = useStore((s) => s.now);
  const setNote = useStore((s) => s.setPatientNote);
  const dispatch = useStore((s) => s.dispatchManual);
  const rules = useRules();
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);

  const chosen = patients.filter((p) => ids.includes(p.id));
  const ranking = useMemo(
    () =>
      computePlan({ now, patients, vehicles, hospitals: HOSPITALS, runtime, travel, settings, rules, area: loc?.area ?? loc?.township, rankFor: ids })
        .ranking ?? [],
    // 時鐘每秒更新不需重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patients, vehicles, runtime, travel, settings, rules, loc, ids.join(',')],
  );
  const best = ranking[0]?.hospitalId ?? null;
  const hid = hospitalId ?? best;
  const ready = vehicles.filter((v) => (v.status === 'standby' || v.status === 'enroute') && !v.held);
  const held = vehicles.filter((v) => v.held);
  const vid = vehicleId ?? ready[0]?.id ?? null;
  const top = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  const hospBtn = (r: (typeof ranking)[number]) => {
    const h = HOSPITAL_BY_ID[r.hospitalId];
    const rt = runtime[h.id];
    const cap = capacityOf(h, rt, settings.nightMode);
    const left = (c: 'R' | 'Y' | 'G') => cap[c] - rt.used[c] - rt.selfPresented[c];
    return (
      <button key={h.id} className={`btn hit ${hid === h.id ? 'on' : ''}`} disabled={!r.fits} onClick={() => setHospitalId(h.id)}>
        <b>
          {h.short} <span className="muted">{Math.round(r.goMin)}′</span>
          {r.hospitalId === best && <span className="chip G" style={{ marginLeft: 6, fontSize: 12 }}>建議</span>}
        </b>
        <span className="muted small">
          剩 紅{left('R')} 黃{left('Y')} 綠{left('G')}
          {(rt.strain ?? 0) > 0 ? `｜${rt.strain === 2 ? '滿載' : '吃緊'}` : ''}
        </span>
      </button>
    );
  };

  return (
    <section className="section dispatch-panel">
      <h2>派車</h2>
      {chosen.map((p) => (
        <div key={p.id} className="note-row">
          <span className={`chip ${p.color}`}>{p.label}</span>
          <input
            id={`note-${p.id}`}
            value={p.note ?? ''}
            placeholder="註解"
            onChange={(e) => setNote(p.id, e.target.value)}
          />
          <button className="btn sm" onClick={() => setEdit(p.id)}>
            ⋯
          </button>
        </div>
      ))}

      <h3>車輛</h3>
      {ready.length === 0 && held.length === 0 && <p className="muted small">尚無可派車輛，先按「＋救護車」</p>}
      <div className="grid g3">
        {ready.map((v) => (
          <button key={v.id} className={`btn sm ${vid === v.id ? 'on' : ''}`} onClick={() => setVehicleId(v.id)}>
            {v.name}
          </button>
        ))}
        {held.map((v) => (
          <button key={v.id} className={`btn sm ${vid === v.id ? 'on' : ''}`} onClick={() => setVehicleId(v.id)}>
            {v.name} <span className="muted">留守</span>
          </button>
        ))}
      </div>

      <h3>醫院</h3>
      <div className="grid">{top.map(hospBtn)}</div>
      {rest.length > 0 && (
        <>
          <button className="btn sm full" style={{ marginTop: 8 }} onClick={() => setShowAll(!showAll)}>
            其他醫院 {showAll ? '▲' : '▼'}
          </button>
          {showAll && <div className="grid" style={{ marginTop: 8 }}>{rest.map(hospBtn)}</div>}
        </>
      )}

      <button
        className="btn go full"
        style={{ marginTop: 12, minHeight: 64 }}
        disabled={!vid || !hid}
        onClick={() => {
          dispatch(ids, vid!, hid!);
          setVehicleId(null);
          setHospitalId(null);
          onDone();
        }}
      >
        出發{vid && hid ? `：${vehicles.find((v) => v.id === vid)?.name} ➔ ${HOSPITAL_BY_ID[hid].short}` : ''}
      </button>
      {edit && <PatientSheet id={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}
