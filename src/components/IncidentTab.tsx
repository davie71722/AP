import { useState, type ReactNode } from 'react';
import { INCIDENT_TYPES } from '../data/incidentTypes';
import { FREEWAY_SEGMENTS, nearestTownship, TOWNSHIPS } from '../data/places';
import { useStore } from '../store/store';
import { DoubleTapButton, Stepper } from './common';

export function IncidentTab() {
  const incident = useStore((s) => s.incident);
  const toggleType = useStore((s) => s.toggleType);
  const setLocation = useStore((s) => s.setLocation);
  const start = useStore((s) => s.startIncident);
  const update = useStore((s) => s.updateSettings);
  const clear = useStore((s) => s.clearIncident);
  const [gpsMsg, setGpsMsg] = useState('');
  const [showFreeway, setShowFreeway] = useState(false);
  const st = incident.settings;
  const loc = incident.location;

  const useGps = () => {
    if (!navigator.geolocation) return setGpsMsg('此手機不支援定位');
    setGpsMsg('定位中…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const tw = nearestTownship(lat, lng);
        setLocation({ kind: 'pin', label: `GPS（近${tw}）`, lat, lng, township: tw });
        setGpsMsg(`已定位 ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      },
      (err) => setGpsMsg(`定位失敗：${err.message}`),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <>
      {!incident.startAt && (
        <div className="muted small" style={{ textAlign: 'center', marginBottom: 8 }}>
          竹縣大傷後送小幫手｜決策支援工具，派遣由後送官決定
        </div>
      )}

      <section className="section">
        <h2>① 事件類型（可複選）</h2>
        <div className="grid g2">
          {INCIDENT_TYPES.map((t) => (
            <button key={t.id} className={`btn ${incident.types.includes(t.id) ? 'on' : ''}`} onClick={() => toggleType(t.id)}>
              {incident.types.includes(t.id) ? '✔ ' : ''}
              {t.name}
            </button>
          ))}
        </div>
        {incident.startAt ? <p className="muted small">進行中改類型會立即重算未送出的傷患。</p> : null}
      </section>

      <section className="section">
        <h2>
          ② 事發地點 {loc && <span className="muted small">目前：{loc.label}</span>}
        </h2>
        <div className="grid g3">
          {Object.entries(TOWNSHIPS).map(([name, [lat, lng]]) => (
            <button
              key={name}
              className={`btn sm ${loc?.kind === 'township' && loc.label === name ? 'on' : ''}`}
              onClick={() => setLocation({ kind: 'township', label: name, lat, lng, township: name })}
            >
              {name}
            </button>
          ))}
          <button className="btn sm" onClick={useGps}>
            📍GPS
          </button>
          <button className={`btn sm ${showFreeway || loc?.kind === 'freeway' ? 'on' : ''}`} onClick={() => setShowFreeway(!showFreeway)}>
            🛣 國道
          </button>
        </div>
        {gpsMsg && <p className="muted small">{gpsMsg}</p>}
        {(showFreeway || loc?.kind === 'freeway') && (
          <>
            <h3>國道路段（座標約略值，待校正）</h3>
            <div className="grid g2">
              {FREEWAY_SEGMENTS.map((f) => (
                <button
                  key={f.id}
                  className={`btn sm ${loc?.kind === 'freeway' && loc.label === f.label ? 'on' : ''}`}
                  onClick={() => setLocation({ kind: 'freeway', label: f.label, lat: f.lat, lng: f.lng, township: f.township })}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="section">
        {incident.startAt ? (
          <p style={{ margin: 0 }}>
            ③ 事件已於 <b>{new Date(incident.startAt).toLocaleTimeString('zh-TW')}</b> 開始
          </p>
        ) : (
          <button className="btn go full" style={{ minHeight: 72, fontSize: 22 }} onClick={start}>
            ③ ▶ 開始（記錄起始時間）
          </button>
        )}
      </section>

      <section className="section">
        <h2>設定</h2>
        <SetRow label="裝載時間">
          <Stepper value={st.loadMin} min={0} onChange={(v) => update({ loadMin: v })} format={(v) => `${v}分`} />
        </SetRow>
        <SetRow label="交接時間">
          <Stepper value={st.handoverMin} min={0} step={5} onChange={(v) => update({ handoverMin: v })} format={(v) => `${v}分`} />
        </SetRow>
        <SetRow label="長程門檻">
          <Stepper value={st.longHaulMin} min={10} step={5} onChange={(v) => update({ longHaulMin: v })} format={(v) => `${v}分`} />
        </SetRow>
        <SetRow label="縣內保留車">
          <Stepper value={st.reserveVehicles} min={0} onChange={(v) => update({ reserveVehicles: v })} format={(v) => `${v}台`} />
        </SetRow>
        <SetRow label="綠傷每車">
          <div className="seg">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} className={`btn sm ${st.greensPerVehicle === n ? 'on' : ''}`} onClick={() => update({ greensPerVehicle: n })}>
                {n}人
              </button>
            ))}
          </div>
        </SetRow>
        <SetRow label="離線車程倍率">
          <div className="seg">
            {[1.0, 1.3, 1.6].map((f) => (
              <button key={f} className={`btn sm ${st.trafficFactor === f ? 'on' : ''}`} onClick={() => update({ trafficFactor: f })}>
                ×{f.toFixed(1)}
              </button>
            ))}
          </div>
        </SetRow>
        <SetRow label="新車預設 EMTP">
          <Stepper value={st.defaultEmtp} min={0} max={4} onChange={(v) => update({ defaultEmtp: v })} format={(v) => `${v}人`} />
        </SetRow>
        <SetRow label="新車預設 EMT-2">
          <Stepper value={st.defaultEmt2} min={0} max={4} onChange={(v) => update({ defaultEmt2: v })} format={(v) => `${v}人`} />
        </SetRow>
        <SetRow label="化災：車輛每趟需除污">
          <div className="seg">
            <button className={`btn sm ${!st.hazmatVehicleDecon ? 'on' : ''}`} onClick={() => update({ hazmatVehicleDecon: false })}>
              否
            </button>
            <button className={`btn sm ${st.hazmatVehicleDecon ? 'on' : ''}`} onClick={() => update({ hazmatVehicleDecon: true })}>
              是
            </button>
          </div>
        </SetRow>
        <SetRow label="畫面">
          <ThemeToggle />
        </SetRow>
        <SetRow label="醫院容量（日／夜）">
          <div className="seg">
            <button className={`btn sm ${!st.nightMode ? 'on' : ''}`} onClick={() => update({ nightMode: false })}>
              日間
            </button>
            <button className={`btn sm ${st.nightMode ? 'on' : ''}`} onClick={() => update({ nightMode: true })}>
              夜間
            </button>
          </div>
        </SetRow>
      </section>

      <section className="section">
        <h2>清除事件</h2>
        <p className="muted small">清除所有傷患、車輛與紀錄（建議先到「回報」匯出）。</p>
        <DoubleTapButton className="full" onConfirm={clear} armedText="⚠ 再按一次確認清除">
          清除事件
        </DoubleTapButton>
      </section>
    </>
  );
}

export function ThemeToggle() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  return (
    <div className="seg">
      <button className={`btn sm ${theme === 'day' ? 'on' : ''}`} onClick={() => setTheme('day')}>
        ☀ 日間
      </button>
      <button className={`btn sm ${theme === 'night' ? 'on' : ''}`} onClick={() => setTheme('night')}>
        ☾ 夜間
      </button>
    </div>
  );
}

function SetRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="setrow">
      <span>{label}</span>
      {children}
    </div>
  );
}
