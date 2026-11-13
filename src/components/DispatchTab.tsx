import { useState } from 'react';
import { HOSPITAL_BY_ID } from '../data/hospitals';
import { hazmatNotifyList } from '../engine/actions';
import type { Suggestion } from '../engine/plan';
import { useStore } from '../store/store';
import { usePlan, useRules } from '../store/usePlan';
import { COLOR_NAME } from '../types';
import { clockAfter, fmtMin } from './common';
import { VehicleSheet } from './InputTab';

export function DispatchTab() {
  const plan = usePlan();
  const rules = useRules();
  const now = useStore((s) => s.now);
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const runtime = useStore((s) => s.runtime);
  const travel = useStore((s) => s.travel);
  const startAt = useStore((s) => s.incident.startAt);
  const location = useStore((s) => s.incident.location);
  const undoStack = useStore((s) => s.undoStack);
  const undo = useStore((s) => s.undo);
  const [vehicleSheet, setVehicleSheet] = useState<string | null>(null);

  const waiting = (c: string) => patients.filter((p) => p.status === 'waiting' && p.color === c).length;
  const notify = rules.hazmat ? hazmatNotifyList(patients, runtime) : [];
  const elapsed = startAt ? (now - startAt) / 60000 : 0;

  return (
    <>
      {!location && <div className="alert red">尚未設定事發地點，車程無法計算。請到「事件」分頁選擇地點。</div>}
      {travel.updatedAt && (
        <div className="muted small" style={{ marginBottom: 8 }}>
          車程：{travel.source === 'online' ? '即時路況（Google Routes）' : '離線估算'}｜最後更新{' '}
          {new Date(travel.updatedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
          {travel.error && <span style={{ color: 'var(--orange)' }}>｜即時查詢失敗，使用離線估算</span>}
        </div>
      )}

      {(rules.alerts.length > 0 || notify.length > 0) && (
        <div className="alert">
          事件提醒
          <ul>
            {rules.alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
            {notify.map((n) => (
              <li key={n.hospitalId} style={{ color: '#ffb3b3' }}>
                請通知 {HOSPITAL_BY_ID[n.hospitalId]?.short}：{n.labels.join('、')} 未除污即送達（該院無除污能力）
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.needReinforcement && <div className="alert red">⚠ 紅傷等候過久或無車可派：請求增援車輛</div>}

      <section className="section">
        <div className="stats">
          <Stat k="待送 紅/黃/綠" v={`${waiting('R')}/${waiting('Y')}/${waiting('G')}`} />
          <Stat k="可用車（現場）" v={`${plan.availableNow}`} />
          <Stat k="總車數" v={`${vehicles.filter((v) => v.status !== 'offline').length}`} />
          <Stat
            k="預估現場清空"
            v={plan.clearMin === null ? '—' : clockAfter(now, plan.clearMin)}
            sub={plan.clearMin === null ? '' : `約 ${Math.round(plan.clearMin)} 分後｜事件第 ${Math.round(elapsed + plan.clearMin)} 分`}
          />
        </div>
        {plan.reservedVehicleIds.length > 0 && (
          <p className="muted small">
            保留不抽調：{plan.reservedVehicleIds.map((id) => vehicles.find((v) => v.id === id)?.name).join('、')}
          </p>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn warn" disabled={undoStack.length === 0} onClick={undo}>
            ↶ 撤銷上一筆{undoStack.length ? `（${undoStack[undoStack.length - 1].label}）` : ''}
          </button>
        </div>
      </section>

      <section className="section">
        <h2>派遣建議（{plan.suggestions.length}）</h2>
        {plan.suggestions.length === 0 && <div className="empty">目前沒有可派遣的建議</div>}
        {plan.suggestions.map((s) => (
          <SuggestionRow key={s.key} s={s} onMarkArrived={() => setVehicleSheet(s.vehicleId)} />
        ))}
      </section>

      {plan.unassigned.length > 0 && (
        <section className="section">
          <h2>未分配（{plan.unassigned.reduce((n, u) => n + u.patientIds.length, 0)}）</h2>
          {plan.unassigned.map((u) => (
            <div key={u.patientIds.join('+')} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
              {u.patientIds.map((id) => {
                const p = patients.find((x) => x.id === id);
                return (
                  <span key={id} className={`chip ${u.color}`}>
                    {p?.label}
                  </span>
                );
              })}
              <span style={{ color: u.reason === 'needsDecon' ? 'var(--purple)' : 'var(--orange)', fontWeight: 700 }}>
                {{ noVehicle: '無車', noCapacity: '無量能', needsDecon: '未除污' }[u.reason]}
              </span>
              <span className="muted small">{u.detail}</span>
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

function SuggestionRow({ s, onMarkArrived }: { s: Suggestion; onMarkArrived: () => void }) {
  const patients = useStore((st) => st.patients);
  const vehicle = useStore((st) => st.vehicles.find((v) => v.id === s.vehicleId));
  const now = useStore((st) => st.now);
  const confirm = useStore((st) => st.confirm);
  const h = HOSPITAL_BY_ID[s.hospitalId];
  const labels = s.patientIds.map((id) => patients.find((p) => p.id === id)?.label ?? '?');
  return (
    <div className={`sug ${s.color} ${s.confirmable ? '' : 'pre'}`}>
      <div>
        <div className="line1">
          {labels.map((l) => (
            <span key={l} className={`chip ${s.color}`}>
              {l}
            </span>
          ))}
          <span className="arrow">➔</span>
          <span>
            {vehicle?.name}
            <span className="muted small">（第 {s.tripNo} 趟）</span>
          </span>
          <span className="arrow">➔</span>
          <span>{h.short}</span>
        </div>
        <div className="times">
          出發 <b>{clockAfter(now, s.departMin)}</b>｜抵院 <b>{clockAfter(now, s.arriveMin)}</b>（車程 {fmtMin(s.goMin)}）｜返場{' '}
          <b>{clockAfter(now, s.returnMin)}</b>
          {!s.confirmable && s.availableMin > 0.5 && <span>｜車約 {Math.ceil(s.availableMin)} 分後可用</span>}
        </div>
        <div>
          {s.warnings.map((w) => (
            <span key={w.kind} className={`warn-tag ${w.kind}`}>
              {w.text}
            </span>
          ))}
        </div>
      </div>
      <div className="act">
        {s.confirmable ? (
          <button className="btn go" onClick={() => confirm(s)}>
            ✔ 確認出發
          </button>
        ) : s.needsArrivalMark ? (
          <button className="btn" onClick={onMarkArrived}>
            車已到場？
          </button>
        ) : (
          <span className="muted small" style={{ textAlign: 'center' }}>
            預排
            <br />
            {COLOR_NAME[s.color]}傷
          </span>
        )}
      </div>
    </div>
  );
}
