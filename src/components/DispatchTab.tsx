import { useState } from 'react';
import { HOSPITAL_BY_ID } from '../data/hospitals';
import { hazmatNotifyList } from '../engine/actions';
import type { Suggestion } from '../engine/plan';
import { useStore } from '../store/store';
import { usePlan, useRules } from '../store/usePlan';
import { clockAfter, fmtMin } from './common';
import { crewText, VehicleSheet } from './InputTab';

export function DispatchTab() {
  const plan = usePlan();
  const rules = useRules();
  const now = useStore((s) => s.now);
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const runtime = useStore((s) => s.runtime);
  const travel = useStore((s) => s.travel);
  const location = useStore((s) => s.incident.location);
  const undoStack = useStore((s) => s.undoStack);
  const undo = useStore((s) => s.undo);
  const [vehicleSheet, setVehicleSheet] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const waiting = (c: string) => patients.filter((p) => p.status === 'waiting' && p.color === c).length;
  const notify = rules.hazmat ? hazmatNotifyList(patients, runtime) : [];
  const alerts = rules.alerts;
  const shownAlerts = alertsOpen ? alerts : alerts.slice(0, 2);

  return (
    <>
      {!location && <div className="alert red">尚未設定事發地點，請到「事件」分頁選擇。</div>}

      {notify.length > 0 && (
        <div className="alert red">
          ⚠ 化災：請通知收治醫院
          <ul>
            {notify.map((n) => (
              <li key={n.hospitalId}>
                {HOSPITAL_BY_ID[n.hospitalId]?.short}：{n.labels.join('、')} 未除污即送達
              </li>
            ))}
          </ul>
        </div>
      )}

      {alerts.length > 0 && (
        <button className="alert" onClick={() => setAlertsOpen(!alertsOpen)}>
          事件提醒（{alerts.length}）{alerts.length > 2 && <span className="muted small">{alertsOpen ? '▲ 收合' : '▼ 全部'}</span>}
          <ul>
            {shownAlerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </button>
      )}

      {plan.needReinforcement && <div className="alert red">⚠ 紅傷無車可派：請求增援車輛</div>}

      <section className="section">
        <div className="stats">
          <Stat k="待送 紅/黃/綠" v={`${waiting('R')}/${waiting('Y')}/${waiting('G')}`} />
          <Stat k="現場可用車／總車" v={`${plan.availableNow}／${vehicles.filter((v) => v.status !== 'offline').length}`} />
          <Stat
            k="預估現場清空"
            v={plan.clearMin === null ? '—' : clockAfter(now, plan.clearMin)}
            sub={plan.clearMin === null ? '' : `約 ${Math.round(plan.clearMin)} 分後`}
          />
          <Stat
            k="車程"
            v={travel.source === 'online' ? '即時' : '離線估算'}
            sub={
              travel.updatedAt
                ? `更新 ${new Date(travel.updatedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}${travel.error ? '｜即時查詢失敗' : ''}`
                : ''
            }
          />
        </div>
        {plan.reservedVehicleIds.length > 0 && (
          <p className="muted small">保留不抽調：{plan.reservedVehicleIds.map((id) => vehicles.find((v) => v.id === id)?.name).join('、')}</p>
        )}
        {undoStack.length > 0 && (
          <button className="btn warn full" style={{ marginTop: 8 }} onClick={undo}>
            ↶ 撤銷上一筆（{undoStack[undoStack.length - 1].label}）
          </button>
        )}
      </section>

      <h2 style={{ margin: '4px 2px 8px', fontSize: 18 }}>派遣建議（{plan.suggestions.length}）</h2>
      {plan.suggestions.length === 0 && <div className="section empty">目前沒有可派遣的建議</div>}
      {plan.suggestions.map((s) => (
        <SuggestionCard key={s.key} s={s} onMarkArrived={() => setVehicleSheet(s.vehicleId)} />
      ))}

      {plan.unassigned.length > 0 && (
        <section className="section" style={{ marginTop: 10 }}>
          <h2>未分配（{plan.unassigned.reduce((n, u) => n + u.patientIds.length, 0)}）</h2>
          {plan.unassigned.map((u) => (
            <div key={u.patientIds.join('+')} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
              {u.patientIds.map((id) => (
                <span key={id} className={`chip ${u.color}`}>
                  {patients.find((x) => x.id === id)?.label}
                </span>
              ))}
              <span style={{ color: u.reason === 'needsDecon' ? 'var(--purple)' : 'var(--orange)', fontWeight: 700 }}>
                {{ noVehicle: '無車', noCapacity: '無量能', needsDecon: '未除污' }[u.reason]}
              </span>
            </div>
          ))}
        </section>
      )}

      <p className="muted small">本系統為決策支援工具，最終派遣決定由現場指揮官／後送官負責。</p>
      {vehicleSheet && <VehicleSheet id={vehicleSheet} onClose={() => setVehicleSheet(null)} />}
    </>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  );
}

function SuggestionCard({ s, onMarkArrived }: { s: Suggestion; onMarkArrived: () => void }) {
  const patients = useStore((st) => st.patients);
  const vehicle = useStore((st) => st.vehicles.find((v) => v.id === s.vehicleId));
  const now = useStore((st) => st.now);
  const confirm = useStore((st) => st.confirm);
  const h = HOSPITAL_BY_ID[s.hospitalId];
  const labels = s.patientIds.map((id) => patients.find((p) => p.id === id)?.label ?? '?');
  return (
    <div className={`sug ${s.color} ${s.confirmable ? '' : 'pre'}`}>
      <div className="line1">
        {labels.map((l) => (
          <span key={l} className={`chip ${s.color}`} style={{ fontSize: 17 }}>
            {l}
          </span>
        ))}
        <span className="arrow">➔</span>
        <span>
          {vehicle?.name}
          <span className="muted small">（第{s.tripNo}趟）</span>
        </span>
        <span className="arrow">➔</span>
        <span>{h.short}</span>
      </div>
      {vehicle && <div className="note">{crewText(vehicle)}</div>}
      <div className="times">
        <div>
          出發<b>{clockAfter(now, s.departMin)}</b>
        </div>
        <div>
          抵院（{fmtMin(s.goMin)}）<b>{clockAfter(now, s.arriveMin)}</b>
        </div>
        <div>
          返場<b>{clockAfter(now, s.returnMin)}</b>
        </div>
      </div>
      {s.warnings.length > 0 && (
        <div>
          {s.warnings.map((w) => (
            <span key={w.kind} className={`warn-tag ${w.kind}`}>
              {w.text}
            </span>
          ))}
        </div>
      )}
      <div className="act">
        {s.confirmable ? (
          <button className="btn go full" onClick={() => confirm(s)}>
            ✔ 確認出發
          </button>
        ) : s.needsArrivalMark ? (
          <button className="btn full" onClick={onMarkArrived}>
            {vehicle?.name} 已到場？點此確認
          </button>
        ) : (
          <span className="pre-label">預排｜車約 {Math.ceil(s.availableMin)} 分後可用</span>
        )}
      </div>
    </div>
  );
}
