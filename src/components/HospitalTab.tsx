// 醫院細節（負荷、車程修正、自行到院、除污、關閉）
import { HOSPITAL_BY_ID } from '../data/hospitals';
import { effectiveTravel } from '../engine/plan';
import { useStore } from '../store/store';
import { useTriage } from '../store/usePlan';
import { LEVEL_NAME, type TransportColor } from '../types';
import { SentCounts, Sheet, Stepper } from './common';

const TC: TransportColor[] = ['R', 'Y', 'G'];

export function HospitalSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const h = HOSPITAL_BY_ID[id];
  const rt = useStore((s) => s.runtime[id]);
  const settings = useStore((s) => s.incident.settings);
  const travel = useStore((s) => s.travel.byHospital[id]);
  const adjustTravel = useStore((s) => s.adjustTravel);
  const adjustSelf = useStore((s) => s.adjustSelfPresented);
  const toggleDecon = useStore((s) => s.toggleDecon);
  const setStrain = useStore((s) => s.setStrain);
  const toggleBypass = useStore((s) => s.toggleBypass);
  const tr = effectiveTravel(travel, rt, settings);
  const { names } = useTriage();

  return (
    <Sheet onClose={onClose}>
      <h2>
        {h.short} <span className={`badge ${h.level}`}>{LEVEL_NAME[h.level]}級</span>
      </h2>

      <h3>已後送</h3>
      <div className="sent-big">
        <SentCounts rt={rt} names={names} />
      </div>

      <h3>負荷</h3>
      <div className="grid g3">
        {(['正常', '吃緊', '滿載'] as const).map((name, lv) => (
          <button
            key={name}
            className={`btn sm ${(rt.strain ?? 0) === lv ? (lv === 2 ? 'chip R' : lv === 1 ? 'chip Y' : 'on') : ''}`}
            onClick={() => setStrain(id, lv as 0 | 1 | 2)}
          >
            {name}
          </button>
        ))}
      </div>

      <h3>車程 {tr ? Math.round(tr.go) : '—'} 分</h3>
      <div className="setrow">
        <span>修正</span>
        <Stepper value={rt.travelAdjustMin} step={5} onChange={(v) => adjustTravel(id, v - rt.travelAdjustMin)} format={(v) => `${v > 0 ? '+' : ''}${v}分`} />
      </div>

      <h3>自行到院</h3>
      {TC.map((c) => (
        <div className="setrow" key={c}>
          <span className={`chip ${c}`}>{names[c]}傷</span>
          <Stepper min={0} value={rt.selfPresented[c]} onChange={(v) => adjustSelf(id, c, v - rt.selfPresented[c])} />
        </div>
      ))}

      <div className="grid g2" style={{ marginTop: 12 }}>
        <button className={`btn ${rt.decon ? 'on' : ''}`} onClick={() => toggleDecon(id)}>
          除污能力：{rt.decon ? '有' : '無'}
        </button>
        <button className={`btn ${rt.bypass ? 'go' : 'danger'}`} onClick={() => toggleBypass(id)}>
          {rt.bypass ? '重新開啟' : '關閉醫院'}
        </button>
      </div>
    </Sheet>
  );
}
