import { useState, type ReactNode } from 'react';
import { INCIDENT_TYPES } from '../data/incidentTypes';
import { googleMapsUrl, isMapsShortLink, isUrl, parseCoords, pinLocation } from '../data/geo';
import { FREEWAY_SEGMENTS, TOWNSHIPS } from '../data/places';
import { geocodeAddress, resolveShortLink, ROUTES_PROXY_URL } from '../travel/routes';
import type { IncidentLocation } from '../types';
import { useStore } from '../store/store';
import { DoubleTapButton, Stepper } from './common';

export function IncidentTab() {
  const incident = useStore((s) => s.incident);
  const toggleType = useStore((s) => s.toggleType);
  const setLocation = useStore((s) => s.setLocation);
  const start = useStore((s) => s.startIncident);
  const update = useStore((s) => s.updateSettings);
  const clear = useStore((s) => s.clearIncident);
  const [showFreeway, setShowFreeway] = useState(false);
  const st = incident.settings;
  const loc = incident.location;

  return (
    <>
      <section className="section">
        <h2>事件類型</h2>
        <div className="grid g2">
          {INCIDENT_TYPES.map((t) => (
            <button key={t.id} className={`btn ${incident.types.includes(t.id) ? 'on' : ''}`} onClick={() => toggleType(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>事發地點</h2>
        {loc && (
          <div className="loc-now">
            <span>
              <b>{loc.label}</b>
              {loc.unit && <span className="chip dim" style={{ marginLeft: 8 }}>{loc.unit}分隊轄區</span>}
            </span>
            <a className="btn sm" href={googleMapsUrl(loc.lat, loc.lng)} target="_blank" rel="noreferrer">
              🗺
            </a>
          </div>
        )}
        <LocationInput onPick={setLocation} />
        <button className={`btn sm full ${showFreeway ? 'on' : ''}`} style={{ marginTop: 8 }} onClick={() => setShowFreeway(!showFreeway)}>
          鄉鎮／國道 {showFreeway ? '▲' : '▼'}
        </button>
        {showFreeway && (
          <>
            <div className="grid g3" style={{ marginTop: 8 }}>
              {Object.entries(TOWNSHIPS).map(([name, [lat, lng]]) => (
                <button
                  key={name}
                  className={`btn sm ${loc?.kind === 'township' && loc.label === name ? 'on' : ''}`}
                  onClick={() => setLocation({ kind: 'township', label: name, lat, lng, township: name })}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="grid g2" style={{ marginTop: 8 }}>
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
            開始 <b>{new Date(incident.startAt).toLocaleTimeString('zh-TW', { hour12: false })}</b>
          </p>
        ) : (
          <button className="btn go full" style={{ minHeight: 72, fontSize: 22 }} onClick={start}>
            ▶ 開始
          </button>
        )}
      </section>

      <section className="section">
        <h2>設定</h2>
        <SetRow label="檢傷系統">
          <div className="seg">
            <button className={`btn sm ${st.triageSystem === 'START' ? 'on' : ''}`} onClick={() => update({ triageSystem: 'START' })}>
              START
            </button>
            <button className={`btn sm ${st.triageSystem === 'TST' ? 'on' : ''}`} onClick={() => update({ triageSystem: 'TST' })}>
              TST
            </button>
          </div>
        </SetRow>
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
        <SetRow label="醫院容量">
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

/** 地址／座標／Google 地圖連結／GPS */
function LocationInput({ onPick }: { onPick: (l: IncidentLocation) => void }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const online = useStore((s) => s.online);

  const done = (l: IncidentLocation) => {
    onPick(l);
    setText('');
    setMsg('');
  };

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    const c = parseCoords(t);
    if (c) return done(pinLocation(c.lat, c.lng));
    if (!ROUTES_PROXY_URL) return setMsg('未設定地圖服務：請改用座標、地圖連結或 GPS');
    if (!online) return setMsg(isUrl(t) ? '離線：請改貼含座標的地圖連結' : '離線：請改用座標、GPS 或鄉鎮');
    setBusy(true);
    try {
      if (isMapsShortLink(t)) {
        const full = await resolveShortLink(t);
        const c2 = parseCoords(full);
        if (c2) return done(pinLocation(c2.lat, c2.lng));
        return setMsg('連結中找不到座標');
      }
      const g = await geocodeAddress(t);
      if (g) return done(pinLocation(g.lat, g.lng, g.label.replace(/^\d+台灣/, '').replace(/^台灣/, '')));
      setMsg('查無此地址');
    } catch {
      setMsg('查詢失敗');
    } finally {
      setBusy(false);
    }
  };

  const gps = () => {
    if (!navigator.geolocation) return setMsg('無法定位');
    setMsg('定位中…');
    navigator.geolocation.getCurrentPosition(
      (pos) => done(pinLocation(pos.coords.latitude, pos.coords.longitude, 'GPS')),
      (err) => setMsg(`定位失敗：${err.message}`),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <>
      <form
        className="loc-input"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="地址・座標・地圖連結"
          inputMode="text"
          enterKeyHint="go"
        />
        <button className="btn primary" disabled={busy || !text.trim()}>
          {busy ? '…' : '定位'}
        </button>
      </form>
      <div className="grid g2" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={gps}>
          📍 GPS
        </button>
        <a className="btn sm" href={googleMapsUrl()} target="_blank" rel="noreferrer">
          🗺 Google 地圖
        </a>
      </div>
      {msg && <p className="small" style={{ color: 'var(--orange)', margin: '6px 0 0' }}>{msg}</p>}
    </>
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
