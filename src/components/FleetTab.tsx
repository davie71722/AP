// 現況：現場病患、EMT 人力量能、醫院量能、救護車清單
import { COUNTY_ORDER, HOSPITALS } from '../data/hospitals';
import { capacityOf } from '../engine/plan';
import { useStore } from '../store/store';
import { usePlan, useTriage } from '../store/usePlan';
import { RED_CLASSES, type Color, type TransportColor, type Vehicle, type VehicleStatus } from '../types';
import { VehiclesSection } from './InputTab';

const TC: TransportColor[] = ['R', 'Y', 'G'];

export function FleetTab() {
  return (
    <>
      <PatientSummary />
      <CrewSummary />
      <HospitalSummary />
      <VehiclesSection />
    </>
  );
}

function PatientSummary() {
  const patients = useStore((s) => s.patients);
  const { names } = useTriage();
  const redWaiting = patients.filter((p) => p.color === 'R' && p.status === 'waiting');
  const count = (c: Color, st?: 'waiting' | 'sent') =>
    patients.filter((p) => p.color === c && (!st || p.status === st)).length;
  return (
    <section className="section">
      <h2>現場病患（共 {patients.length}）</h2>
      <table className="tbl">
        <thead>
          <tr>
            <th />
            {(['R', 'Y', 'G', 'K'] as Color[]).map((c) => (
              <th key={c}>
                <span className={`chip ${c}`}>{names[c]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>現場待送</td>
            {(['R', 'Y', 'G'] as Color[]).map((c) => (
              <td key={c} className="big">
                {count(c, 'waiting')}
              </td>
            ))}
            <td className="big">{count('K')}</td>
          </tr>
          <tr>
            <td>已後送</td>
            {(['R', 'Y', 'G'] as Color[]).map((c) => (
              <td key={c}>{count(c, 'sent')}</td>
            ))}
            <td>—</td>
          </tr>
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 8 }}>
        {RED_CLASSES.map((rc) => (
          <span key={rc.id} className="chip R">
            {rc.id} {redWaiting.filter((p) => p.redClass === rc.id).length}
          </span>
        ))}
      </div>
    </section>
  );
}

const STATUS_ROWS: { st: VehicleStatus; name: string }[] = [
  { st: 'standby', name: '現場待命' },
  { st: 'enroute', name: '趕赴中' },
  { st: 'transport', name: '運送中' },
  { st: 'decon', name: '待除污' },
  { st: 'offline', name: '離線' },
];

function CrewSummary() {
  const vehicles = useStore((s) => s.vehicles);
  const sum = (vs: Vehicle[], k: 'emtp' | 'emt2') => vs.reduce((n, v) => n + (v[k] ?? 0), 0);
  const active = vehicles.filter((v) => v.status !== 'offline');
  const arrived = vehicles.filter((v) => v.status !== 'enroute').length;
  return (
    <section className="section">
      <h2>救護車與 EMT 量能</h2>
      <div className="stats" style={{ marginBottom: 8 }}>
        <div className="stat">
          <div className="k">到場／總車</div>
          <div className="v">
            {arrived}／{vehicles.length}
          </div>
        </div>
        <div className="stat">
          <div className="k">人力</div>
          <div className="v" style={{ fontSize: 20 }}>
            EMTP {sum(active, 'emtp')}
            <br />
            EMT-2 {sum(active, 'emt2')}
          </div>
        </div>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>狀態</th>
            <th>車</th>
            <th>EMTP</th>
            <th>EMT-2</th>
          </tr>
        </thead>
        <tbody>
          {STATUS_ROWS.map(({ st, name }) => {
            const vs = vehicles.filter((v) => v.status === st);
            if (!vs.length && (st === 'decon' || st === 'offline')) return null;
            return (
              <tr key={st}>
                <td className={`status-${st}`}>{name}</td>
                <td>{vs.length}</td>
                <td>{sum(vs, 'emtp')}</td>
                <td>{sum(vs, 'emt2')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function HospitalSummary() {
  const { names } = useTriage();
  const runtime = useStore((s) => s.runtime);
  const night = useStore((s) => s.incident.settings.nightMode);
  const setTab = useStore((s) => s.setTab);
  const plan = usePlan();
  const planned: Record<string, Record<TransportColor, number>> = {};
  for (const s of plan.suggestions) {
    planned[s.hospitalId] ??= { R: 0, Y: 0, G: 0 };
    planned[s.hospitalId][s.color] += s.patientIds.length;
  }
  const closed = HOSPITALS.filter((h) => runtime[h.id]?.bypass);
  const rows = COUNTY_ORDER.map((county) => {
    const hs = HOSPITALS.filter((h) => h.county === county && !runtime[h.id]?.bypass);
    const remain = { R: 0, Y: 0, G: 0 };
    const total = { R: 0, Y: 0, G: 0 };
    for (const h of hs) {
      const cap = capacityOf(h, runtime[h.id], night);
      const rt = runtime[h.id];
      for (const c of TC) {
        total[c] += cap[c];
        remain[c] += Math.max(0, cap[c] - rt.used[c] - rt.selfPresented[c] - (planned[h.id]?.[c] ?? 0));
      }
    }
    return { county, remain, total };
  });
  return (
    <section className="section">
      <h2>
        醫院剩餘量能 <span className="chip dim">{night ? '夜' : '日'}</span>
      </h2>
      <table className="tbl">
        <thead>
          <tr>
            <th />
            {TC.map((c) => (
              <th key={c}>
                <span className={`chip ${c}`}>{names[c]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.county}>
              <td>{r.county}</td>
              {TC.map((c) => (
                <td key={c} className={r.remain[c] === 0 ? 'zero' : ''}>
                  <b>{r.remain[c]}</b>
                  <span className="muted small">/{r.total[c]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {closed.length > 0 && <p className="small" style={{ color: 'var(--red)' }}>關閉：{closed.map((h) => h.short).join('、')}</p>}
      <button className="btn sm full" style={{ marginTop: 8 }} onClick={() => setTab('hospital')}>
        各醫院 ›
      </button>
    </section>
  );
}
