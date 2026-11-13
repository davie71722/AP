import { useState } from 'react';
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
  const st = incident.settings;
  const loc = incident.location;

  const useGps = () => {
    if (!navigator.geolocation) return setGpsMsg('此裝置不支援定位');
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
      <section className="section">
        <h2>① 事件類型（可複選）</h2>
        <div className="grid cols-wide">
          {INCIDENT_TYPES.map((t) => (
            <button
              key={t.id}
              className={`btn ${incident.types.includes(t.id) ? 'on' : ''}`}
              style={{ minHeight: 72, fontSize: 20 }}
              onClick={() => toggleType(t.id)}
            >
              {incident.types.includes(t.id) ? '✔ ' : ''}
              {t.name}
            </button>
          ))}
        </div>
        {incident.startAt ? <p className="muted small">事件進行中改類型會立即重算尚未送出的傷患。</p> : null}
      </section>

      <section className="section">
        <h2>
          ② 事發地點 <span className="muted small">{loc ? `目前：${loc.label}` : ''}</span>
        </h2>
        <h3>新竹縣鄉鎮市</h3>
        <div className="grid cols-auto">
          {Object.entries(TOWNSHIPS).map(([name, [lat, lng]]) => (
            <button
              key={name}
              className={`btn ${loc?.kind === 'township' && loc.label === name ? 'on' : ''}`}
              onClick={() => setLocation({ kind: 'township', label: name, lat, lng, township: name })}
            >
              {name}
            </button>
          ))}
        </div>
        <h3>國道路段（座標為約略值，待校正）</h3>
        <div className="grid cols-wide">
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
        <h3>定位</h3>
        <div className="row">
          <button className="btn" onClick={useGps}>
            📍 使用平板 GPS
          </button>
          <span className="muted small">{gpsMsg}</span>
        </div>
      </section>

      <section className="section">
        <h2>③ 開始</h2>
        {incident.startAt ? (
          <p>
            事件已於 <b>{new Date(incident.startAt).toLocaleTimeString('zh-TW')}</b> 開始。
          </p>
        ) : (
          <button className="btn go" style={{ width: '100%', minHeight: 80, fontSize: 24 }} onClick={start}>
            ▶ 開始（記錄事件起始時間）
          </button>
        )}
      </section>

      <section className="section">
        <h2>設定</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          <Setting label="裝載時間">
            <Stepper value={st.loadMin} min={0} onChange={(v) => update({ loadMin: v })} format={(v) => `${v} 分`} />
          </Setting>
          <Setting label="醫院交接時間">
            <Stepper value={st.handoverMin} min={0} step={5} onChange={(v) => update({ handoverMin: v })} format={(v) => `${v} 分`} />
          </Setting>
          <Setting label="長程後送門檻">
            <Stepper value={st.longHaulMin} min={10} step={5} onChange={(v) => update({ longHaulMin: v })} format={(v) => `${v} 分`} />
          </Setting>
          <Setting label="紅傷等候警示">
            <Stepper value={st.redWaitAlertMin} min={10} max={60} step={5} onChange={(v) => update({ redWaitAlertMin: v })} format={(v) => `${v} 分`} />
          </Setting>
          <Setting label="縣內保留車數">
            <Stepper value={st.reserveVehicles} min={0} onChange={(v) => update({ reserveVehicles: v })} format={(v) => `${v} 台`} />
          </Setting>
          <Setting label="綠傷每車人數">
            <div className="row">
              {([1, 2, 3] as const).map((n) => (
                <button key={n} className={`btn ${st.greensPerVehicle === n ? 'on' : ''}`} onClick={() => update({ greensPerVehicle: n })}>
                  {n} 人
                </button>
              ))}
            </div>
          </Setting>
          <Setting label="離線車程倍率">
            <div className="row">
              {[1.0, 1.3, 1.6].map((f) => (
                <button key={f} className={`btn ${st.trafficFactor === f ? 'on' : ''}`} onClick={() => update({ trafficFactor: f })}>
                  ×{f.toFixed(1)}
                </button>
              ))}
            </div>
          </Setting>
          <Setting label="醫院容量">
            <div className="row">
              <button className={`btn ${!st.nightMode ? 'on' : ''}`} onClick={() => update({ nightMode: false })}>
                ☀ 日間
              </button>
              <button className={`btn ${st.nightMode ? 'on' : ''}`} onClick={() => update({ nightMode: true })}>
                ☾ 夜間／假日
              </button>
            </div>
          </Setting>
        </div>
      </section>

      <section className="section">
        <h2>清除事件</h2>
        <p className="muted small">清除所有傷患、車輛與紀錄（建議先到「回報」分頁匯出紀錄）。</p>
        <DoubleTapButton onConfirm={clear} armedText="⚠ 再按一次確認清除">
          清除事件
        </DoubleTapButton>
      </section>
    </>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}
