// 現場：加救護車、加病人、選病人＋註解＋選車 → 建議醫院 → 出發
import { useMemo, useState } from 'react';
import { HOSPITAL_BY_ID, HOSPITALS } from '../data/hospitals';
import { brigadeOrder, FIRE_UNITS, SUPPORT_SOURCES, unitsOf } from '../data/places';
import { computePlan } from '../engine/plan';
import { manualFactor, sourceEtaMin, useStore } from '../store/store';
import { useRules, useTriage } from '../store/usePlan';
import { useSync } from '../sync/client';
import { dispatchOrder, HOLD_RELEASE_AT, OTHER_VEHICLES, holdUnlocked, injuryText, standbyMin, type Patient, type Vehicle } from '../types';
import { dispatchShareText, headcountText } from '../report/report';
import { keyFlags } from '../data/trauma';
import { KeyFlags, TraumaWarnings } from './TraumaPicker';
import { traumaWarnings } from '../data/traumaRules';
import { DoubleTapButton, PhotoActions, SentCounts, ShareButtons, Sheet } from './common';
import { fmtClock } from '../engine/actions';
import { PatientChip, PatientSheet, TriagePad, VehicleSheet } from './InputTab';
import { useStoredComposites } from './Photos';

export function SceneTab() {
  const rules = useRules();
  const [selected, setSelected] = useState<string[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const viewOnly = useSync((s) => s.role === 'view');
  const patients = useStore((s) => s.patients);
  const waiting = patients.filter((p) => p.status === 'waiting' && p.color !== 'K');
  const sel = selected.filter((id) => waiting.some((p) => p.id === id));
  const toggle = (id: string) => setSelected((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const now = useStore((s) => s.now);
  const blackName = useTriage().names.K;
  // 紅傷待送逾 10 分（自檢傷起算）
  const overdue = waiting
    .filter((p) => p.color === 'R' && !p.trapped)
    .map((p) => ({ p, min: Math.floor((now - (p.history[0]?.at ?? now)) / 60000) }))
    .filter((x) => x.min >= 10);
  const trapped = waiting.filter((p) => p.trapped);
  const [justSent, setJustSent] = useState<string[] | null>(null);

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
      <Milestones />
      <VehicleBar />
      {!viewOnly && <TriagePad />}
      <section className="section">
        <h2>
          待送 <span className="muted small">點選病人派車</span>
          <span className="spacer" />
          {patients.length > 0 && <span className="muted small headcount">{headcountText(patients, blackName)}</span>}
        </h2>
        {overdue.length > 0 && (
          <p className="warn-line">⏱ 紅傷待送逾 10 分：{overdue.map((x) => `${x.p.label} ${x.min}′`).join('、')}</p>
        )}
        {trapped.length > 0 && <p className="warn-line trap">⛓ 受困中：{trapped.map((p) => p.label).join('、')}</p>}
        <div className="ptags">
          {waiting.map((p) => (
            <SelectableChip key={p.id} p={p} on={sel.includes(p.id)} onClick={() => toggle(p.id)} />
          ))}
        </div>
      </section>
      {justSent && <JustSent ids={justSent} onClose={() => setJustSent(null)} />}
      <MorgueSection />
      {sel.length > 0 && !viewOnly && (
        <DispatchPanel
          ids={sel}
          onDone={(sent) => {
            setSelected([]);
            setJustSent(sent);
          }}
        />
      )}
    </>
  );
}

/** 指揮節點時間戳記 */
function Milestones() {
  const ms = useStore((s) => s.incident.milestones ?? {});
  const mark = useStore((s) => s.markMilestone);
  const at = ms['大隊抵達'];
  const viewOnly = useSync((s) => s.role === 'view');
  if (viewOnly) return at ? <div className="milestones"><span className="ms-done">🚒 大隊抵達 {fmtClock(at)}</span></div> : null;
  return (
    <div className="milestones">
      {at ? (
        <>
          <span className="ms-done">🚒 大隊抵達 {fmtClock(at)}</span>
          <DoubleTapButton className="sm" armedText="再按一次更新時間" onConfirm={() => mark('大隊抵達')}>
            重記
          </DoubleTapButton>
        </>
      ) : (
        <button className="btn primary full" onClick={() => mark('大隊抵達')}>
          🚒 大隊抵達（記錄時間）
        </button>
      )}
    </div>
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
  const viewOnly = useSync((s) => s.role === 'view');
  const active = vehicles.filter((v) => v.status !== 'offline');
  const tp = active.reduce((n, v) => n + (v.emtp ?? 0), 0);
  const t2 = active.reduce((n, v) => n + (v.emt2 ?? 0), 0);
  return (
    <section className="section">
      <h2>
        救護車 <span className="muted small">{vehicles.length} 台｜TP {tp}｜T2 {t2}</span>
        <span className="spacer" />
        {!viewOnly && (
          <button className="btn sm primary" onClick={() => setAdding(true)}>
            ＋救護車
          </button>
        )}
      </h2>
      <div className="vchips">
        {vehicleRowOrder(vehicles).map((v) => (
          <VehicleChip key={v.id} v={v} onClick={() => setOpen(v.id)} />
        ))}
      </div>
      {adding && <AddVehicleSheet onClose={() => setAdding(false)} />}
      {open && <VehicleSheet id={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** 車輛列：可派車（待命最久在前）→ 留守 → 運送中（先返場在前）→ 待除污 → 離線 */
function vehicleRowOrder(vehicles: Vehicle[]): Vehicle[] {
  const first = dispatchOrder(vehicles);
  const rest = vehicles
    .filter((v) => !first.includes(v))
    .sort(
      (a, b) =>
        ['transport', 'decon', 'offline'].indexOf(a.status) - ['transport', 'decon', 'offline'].indexOf(b.status) ||
        (a.returnAt ?? 0) - (b.returnAt ?? 0),
    );
  // 留守車（dispatchOrder 已排在可派車之後）
  return [...first, ...rest];
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
  const m = standbyMin(v, now);
  return { text: m !== null && m > 0 ? `待命 ${m}′` : '待命', cls: 'standby' };
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
        brigadeOrder(loc?.unit).map((b) => (
          <div key={b}>
            <h3>{b}</h3>
            <div className="grid g4">{unitsOf(b, loc?.unit).map((u) => unitBtn(u.name))}</div>
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
/** 黑牌（死亡）區：獨立計數、警方接管狀態、暫置區位置與看守人員 */
function MorgueSection() {
  const patients = useStore((s) => s.patients);
  const morgue = useStore((s) => s.incident.morgue ?? {});
  const setMorgue = useStore((s) => s.setMorgue);
  const logMorgue = useStore((s) => s.logMorgue);
  const setPolice = useStore((s) => s.setPolice);
  const viewOnly = useSync((s) => s.role === 'view');
  const { names } = useTriage();
  const ks = patients.filter((p) => p.color === 'K');
  if (!ks.length) return null;
  const handed = ks.filter((p) => p.policeAt).length;
  const noGuard = !morgue.guard?.trim();
  return (
    <section className={`section morgue ${noGuard ? 'warn' : ''}`}>
      <h2>
        {names.K}牌區 <span className="muted small">{ks.length} 位｜待警察接管 {ks.length - handed}｜已移交 {handed}</span>
      </h2>
      {noGuard && <p className="warn-line">⚠ 尚未指定看守人員，避免成為無人管理的死角</p>}
      {!morgue.location?.trim() && <p className="warn-line">⚠ 尚未記錄暫置區位置</p>}
      <div className="morgue-inputs">
        <input
          value={morgue.location ?? ''}
          placeholder="暫置區位置（例：收費站南側空地）"
          disabled={viewOnly}
          onChange={(e) => setMorgue({ location: e.target.value.slice(0, 60) })}
          onBlur={logMorgue}
        />
        <input
          value={morgue.guard ?? ''}
          placeholder="看守人員（例：竹北分隊 王小明）"
          disabled={viewOnly}
          onChange={(e) => setMorgue({ guard: e.target.value.slice(0, 40) })}
          onBlur={logMorgue}
        />
      </div>
      <div className="grid g2" style={{ marginTop: 8 }}>
        {ks.map((p) => (
          <button key={p.id} className={`btn sm k-item ${p.policeAt ? 'on' : ''}`} disabled={viewOnly} onClick={() => setPolice(p.id, !p.policeAt)}>
            <b>{p.label}</b>
            <span className="small">{p.policeAt ? `✔ 已移交警方 ${fmtClock(p.policeAt)}` : '待警察接管'}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** 剛發車：分享檢傷、精簡傷勢與 ETA 到 LINE */
function JustSent({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const ps = patients.filter((p) => ids.includes(p.id) && p.status === 'sent');
  const text = dispatchShareText(ps, vehicles);
  const { files, previews } = useStoredComposites(ids, (pid) => patients.find((x) => x.id === pid)?.label ?? 'photo');
  if (!ps.length) return null;
  return (
    <section className="section just-sent">
      <h2>
        ✔ 已發車
        <span className="spacer" />
        <button className="btn sm" onClick={onClose}>
          ✕
        </button>
      </h2>
      {previews.length > 0 && (
        <>
          <div className="composites">
            {previews.map((u, i) => (
              <img key={i} src={u} alt="合成照片" className="composite" />
            ))}
          </div>
          <PhotoActions files={files} />
        </>
      )}
      <div className="tr-sub" style={{ marginTop: 10 }}>發車文字</div>
      <div className="report">{text}</div>
      <ShareButtons className="mt8" copyLabel="📋 複製" text={text} />
    </section>
  );
}

function DispatchPanel({ ids, onDone }: { ids: string[]; onDone: (sent: string[]) => void }) {
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const runtime = useStore((s) => s.runtime);
  const travel = useStore((s) => s.travel.byHospital);
  const settings = useStore((s) => s.incident.settings);
  const loc = useStore((s) => s.incident.location);
  const now = useStore((s) => s.now);
  const setNote = useStore((s) => s.setPatientNote);
  const dispatch = useStore((s) => s.dispatchManual);
  const setTrapped = useStore((s) => s.setTrapped);
  const otherTransport = useStore((s) => s.otherTransport);
  const [other, setOther] = useState<string | null>(null);
  const startAt = useStore((s) => s.incident.startAt);
  const rules = useRules();
  const { names } = useTriage();
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
  // 待命最久者先派；留守車排最後、不預設選取
  const ordered = dispatchOrder(vehicles);
  const ready = ordered.filter((v) => !v.held);
  const held = ordered.filter((v) => v.held);
  // 留守車預設不可派，剩最後 2 位傷患才開放
  const holdOpen = holdUnlocked(patients);
  const picked = vehicleId ? vehicles.find((v) => v.id === vehicleId) : undefined;
  const vid = (picked && !(picked.held && !holdUnlocked(patients)) ? vehicleId : null) ?? ready[0]?.id ?? null;
  const trappedSel = chosen.filter((p) => p.trapped);
  // 其他車輛（勤務車、民間救護車、巴士）僅限全部為綠牌
  const allGreen = chosen.length > 0 && chosen.every((p) => p.color === 'G');
  const otherKind = allGreen ? other : null;
  const vSub = (v: Vehicle) => {
    if (v.held) return '留守';
    if (v.status === 'enroute') return '趕赴';
    const m = standbyMin(v, now);
    return m !== null ? `待命 ${m}′` : '';
  };
  const top = ranking.slice(0, 3);
  // 其他醫院：依當下預估車程由短至長
  const rest = ranking.slice(3).sort((a, b) => a.goMin - b.goMin);

  const hospBtn = (r: (typeof ranking)[number]) => {
    const h = HOSPITAL_BY_ID[r.hospitalId];
    const rt = runtime[h.id];
    return (
      <button key={h.id} className={`btn hit ${hid === h.id ? 'on' : ''}`} disabled={!r.fits} onClick={() => setHospitalId(h.id)}>
        <b>
          {h.short} <span className="muted">{Math.round(r.goMin)}′</span>
          {r.hospitalId === best && <span className="chip G" style={{ marginLeft: 6, fontSize: 12 }}>建議</span>}
        </b>
        <span className="small">
          <SentCounts rt={rt} names={names} />
          {(rt.strain ?? 0) > 0 && <span className="chip R" style={{ marginLeft: 6, fontSize: 12 }}>{rt.strain === 2 ? '滿載' : '吃緊'}</span>}
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
          <button className={`btn sm trap-btn ${p.trapped ? 'on' : ''}`} onClick={() => setTrapped(p.id, !p.trapped)}>
            {p.trapped ? '⛓受困' : '受困?'}
          </button>
          <button className="btn sm" onClick={() => setEdit(p.id)}>
            傷勢
          </button>
          {(p.trauma?.length || p.wounds?.length) ? (
            <div className="wound-text span3">
              <KeyFlags flags={keyFlags(p.trauma)} />
              {injuryText({ trauma: p.trauma, wounds: p.wounds, color: p.color })}
              <TraumaWarnings items={traumaWarnings(p.trauma, p.wounds, { tags: p.tags, age: p.personal?.age, startAt, now })} />
            </div>
          ) : null}
        </div>
      ))}

      <h3>車輛</h3>
      {ready.length === 0 && held.length === 0 && <p className="muted small">尚無可派車輛，先按「＋救護車」</p>}
      <div className="grid g3">
        {[...ready, ...held].map((v) => (
          <button
            key={v.id}
            className={`btn sm vpick ${!otherKind && vid === v.id ? 'on' : ''}`}
            disabled={v.held && !holdOpen}
            onClick={() => (setVehicleId(v.id), setOther(null))}
          >
            {v.name}
            {vSub(v) && <span className="muted"> {vSub(v)}</span>}
          </button>
        ))}
      </div>

      {allGreen && (
        <>
          <h3>其他車輛 <span className="muted small">限綠牌</span></h3>
          <div className="grid g3">
            {OTHER_VEHICLES.map((k) => (
              <button key={k} className={`btn sm ${otherKind === k ? 'on' : ''}`} onClick={() => setOther(otherKind === k ? null : k)}>
                {k}
              </button>
            ))}
          </div>
        </>
      )}
      {held.length > 0 && !holdOpen && <p className="muted small">留守車剩最後 {HOLD_RELEASE_AT} 位傷患時才開放派車</p>}

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

      {trappedSel.length > 0 && (
        <div className="trap-block">
          <p>⛓ {trappedSel.map((p) => p.label).join('、')} 受困中，脫困後才能派車</p>
          <div className="grid g2">
            {trappedSel.map((p) => (
              <button key={p.id} className="btn sm go" onClick={() => setTrapped(p.id, false)}>
                ✔ {p.label} 已脫困
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        className="btn go full"
        style={{ marginTop: 12, minHeight: 64 }}
        disabled={(!otherKind && !vid) || !hid || trappedSel.length > 0}
        onClick={() => {
          if (otherKind) otherTransport(ids, hid!, otherKind);
          else dispatch(ids, vid!, hid!);
          setVehicleId(null);
          setHospitalId(null);
          setOther(null);
          onDone(ids);
        }}
      >
        出發
        {hid && (otherKind || vid) ? `：${otherKind ?? vehicles.find((v) => v.id === vid)?.name} ➔ ${HOSPITAL_BY_ID[hid].short}` : ''}
      </button>
      {edit && <PatientSheet id={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}
