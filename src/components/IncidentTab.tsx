import { useEffect, useState, type ReactNode } from 'react';
import { leave } from '../sync/client';
import { INCIDENT_TYPES } from '../data/incidentTypes';
import { googleMapsUrl, mapsShortLink, parseCoords, pinLocation, shareName } from '../data/geo';
import { FREEWAY_SEGMENTS, TOWNSHIPS } from '../data/places';
import { mapServiceConfigured, resolveShortLink, searchPlaces, type PlaceHit } from '../travel/routes';
import type { IncidentLocation } from '../types';
import { useStore } from '../store/store';
import { CopyButton, DoubleTapButton, Stepper } from './common';
import { deleteArchive, listArchives, type ArchiveRow } from '../store/db';
import type { Persisted } from '../store/store';
import { buildSummary, download } from '../report/report';
import { fmtClock } from '../engine/actions';

export function IncidentTab() {
  const incident = useStore((s) => s.incident);
  const toggleType = useStore((s) => s.toggleType);
  const setLocation = useStore((s) => s.setLocation);
  const start = useStore((s) => s.startIncident);
  const update = useStore((s) => s.updateSettings);
  const clear = useStore((s) => s.clearIncident);
  const [showFreeway, setShowFreeway] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const st = incident.settings;
  const loc = incident.location;

  return (
    <>
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
        <h2>事件類型 <span className="muted small">選填</span></h2>
        <div className="grid g2">
          {INCIDENT_TYPES.map((t) => (
            <button key={t.id} className={`btn ${incident.types.includes(t.id) ? 'on' : ''}`} onClick={() => toggleType(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        {incident.startAt ? (
          <p style={{ margin: 0 }}>
            開始 <b>{new Date(incident.startAt).toLocaleTimeString('zh-TW', { hour12: false })}</b>
          </p>
        ) : (
          <button className="btn go full" style={{ minHeight: 72, fontSize: 22 }} onClick={() => start()}>
            確認事件 ➔
          </button>
        )}
      </section>

      <section className="section">
        <button className={`btn sm full ${showSettings ? 'on' : ''}`} onClick={() => setShowSettings(!showSettings)}>
          進階設定 {showSettings ? '▲' : '▼'}
        </button>
        {showSettings && (
        <div style={{ marginTop: 8 }}>
        <SetRow label="綠傷群送（巴士）">
          <div className="seg">
            <button className={`btn sm ${!st.groupTransport ? 'on' : ''}`} onClick={() => update({ groupTransport: false })}>
              關
            </button>
            <button className={`btn sm ${st.groupTransport ? 'on' : ''}`} onClick={() => update({ groupTransport: true })}>
              開
            </button>
          </div>
        </SetRow>
        <SetRow label="第 1 輛到場車留守">
          <div className="seg">
            <button className={`btn sm ${!st.firstVehicleHold ? 'on' : ''}`} onClick={() => update({ firstVehicleHold: false })}>
              否
            </button>
            <button className={`btn sm ${st.firstVehicleHold ? 'on' : ''}`} onClick={() => update({ firstVehicleHold: true })}>
              是
            </button>
          </div>
        </SetRow>
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
        <SetRow label="黃傷併載綠傷">
          <div className="seg">
            <button className={`btn sm ${!st.yellowPlusGreen ? 'on' : ''}`} onClick={() => update({ yellowPlusGreen: false })}>
              否
            </button>
            <button className={`btn sm ${st.yellowPlusGreen ? 'on' : ''}`} onClick={() => update({ yellowPlusGreen: true })}>
              是
            </button>
          </div>
        </SetRow>
        <SetRow label="車程時段">
          <div className="seg">
            <button className={`btn sm ${st.trafficAuto ? 'on' : ''}`} onClick={() => update({ trafficAuto: true })}>
              自動
            </button>
            {[1.0, 1.3, 1.6].map((f) => (
              <button key={f} className={`btn sm ${!st.trafficAuto && st.trafficFactor === f ? 'on' : ''}`} onClick={() => update({ trafficAuto: false, trafficFactor: f })}>
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
        </div>
        )}
      </section>

      <section className="section">
        <DoubleTapButton className="full" onConfirm={() => (leave(), clear())} armedText="⚠ 再按一次確認清除（會先自動存檔）">
          清除事件
        </DoubleTapButton>
      </section>

      <ArchiveList />
    </>
  );
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${fmtClock(ts)}`;
}

/** 歷史案件：看總結（可複製）、匯出 JSON、刪除、載入為目前案件 */
function ArchiveList() {
  const rev = useStore((s) => s.archiveRev);
  const bump = useStore((s) => s.bumpArchives);
  const load = useStore((s) => s.loadArchive);
  const currentStart = useStore((s) => s.incident.startAt);
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let alive = true;
    void listArchives().then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, [rev]);

  return (
    <section className="section">
      <button className={`btn sm full ${open ? 'on' : ''}`} onClick={() => setOpen(!open)}>
        歷史案件（{rows.length}）{open ? '▲' : '▼'}
      </button>
      {msg && <p className="small" style={{ color: 'var(--orange)', margin: '6px 0 0' }}>{msg}</p>}
      {open && rows.length === 0 && <div className="empty">尚無存檔；案件結束或清除事件時會自動存檔</div>}
      {open &&
        rows.map((r) => {
          const d = r.data as Persisted;
          const expanded = openId === r.id;
          const summary = expanded ? buildSummary(d.incident, d.patients, d.vehicles, d.runtime, r.endAt ?? r.savedAt) : '';
          return (
            <div key={r.id} className="archive">
              <button className="archive-head" onClick={() => setOpenId(expanded ? null : r.id)}>
                <b>{fmtDate(r.startAt)}</b>
                {r.startAt === currentStart && <span className="chip G" style={{ fontSize: 12 }}>目前</span>}
                {!r.endAt && <span className="chip dim" style={{ fontSize: 12 }}>未結束</span>}
                <span className="spacer" />
                <span className="muted small">{r.total} 人 {expanded ? '▲' : '▼'}</span>
                <span className="muted small archive-title">{r.title}</span>
              </button>
              {expanded && (
                <>
                  <div className="report">{summary}</div>
                  <div className="grid g2" style={{ marginTop: 8 }}>
                    <CopyButton className="sm primary" label="📋 複製總結" text={summary} />
                    <button
                      className="btn sm"
                      onClick={() =>
                        download(
                          `mci-${new Date(r.startAt).toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`,
                          JSON.stringify({ exportedAt: Date.now(), ...d }, null, 2),
                          'application/json',
                        )
                      }
                    >
                      匯出 JSON
                    </button>
                    <DoubleTapButton
                      className="sm"
                      armedText="再按一次刪除"
                      onConfirm={async () => {
                        await deleteArchive(r.id);
                        setOpenId(null);
                        bump();
                      }}
                    >
                      刪除
                    </DoubleTapButton>
                    <DoubleTapButton
                      className="sm"
                      armedText="再按一次（取代本機資料）"
                      onConfirm={async () => {
                        leave();
                        const ok = await load(r.id);
                        setMsg(ok ? '' : '載入失敗');
                      }}
                    >
                      載入為目前案件
                    </DoubleTapButton>
                  </div>
                </>
              )}
            </div>
          );
        })}
    </section>
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

// 嵌在其他頁面（如分享連結）時瀏覽器不提供定位
const EMBEDDED = (() => {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
})();

/** 地址／座標／Google 地圖連結／GPS */
function LocationInput({ onPick }: { onPick: (l: IncidentLocation) => void }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const canGps = !EMBEDDED && 'geolocation' in navigator;
  const online = useStore((s) => s.online);

  const done = (l: IncidentLocation) => {
    onPick(l);
    setText('');
    setMsg('');
    setHits([]);
  };

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setHits([]);
    const name = shareName(t);
    const c = parseCoords(t);
    if (c) return done(pinLocation(c.lat, c.lng, name && !parseCoords(name) ? name : undefined));
    if (!mapServiceConfigured()) return setMsg('地標搜尋未啟用：請貼座標（Google 地圖長按取得）');
    if (!online) return setMsg('離線：請貼座標');
    setBusy(true);
    try {
      const short = mapsShortLink(t);
      if (short) {
        const c2 = parseCoords(await resolveShortLink(short));
        if (c2) return done(pinLocation(c2.lat, c2.lng, name || undefined));
        if (!name) return setMsg('連結中找不到座標');
      }
      const q = short ? name : t;
      const found = await searchPlaces(q);
      if (found.length === 1 && !found[0].approximate) return done(pinLocation(found[0].lat, found[0].lng, found[0].name));
      if (found.length === 0) return setMsg('找不到地點');
      setHits(found);
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
          placeholder="座標・地標・地圖連結"
          inputMode="text"
          enterKeyHint="go"
        />
        <button className="btn primary" disabled={busy || !text.trim()}>
          {busy ? '…' : '定位'}
        </button>
      </form>
      <div className={`grid ${canGps ? 'g2' : ''}`} style={{ marginTop: 8 }}>
        {canGps && (
          <button className="btn sm" onClick={gps}>
            📍 GPS
          </button>
        )}
        <a className="btn sm" href={googleMapsUrl()} target="_blank" rel="noreferrer">
          🗺 Google 地圖
        </a>
      </div>
      {hits.length > 0 && (
        <div className="grid" style={{ marginTop: 8 }}>
          {hits.map((h) => (
            <button key={`${h.lat},${h.lng}`} className="btn sm hit" onClick={() => done(pinLocation(h.lat, h.lng, h.name))}>
              <b>{h.name}</b>
              <span className="muted small">{h.address.replace(/^\d{3,6}/, '').replace(/^台灣/, '')}</span>
              {h.approximate && <span className="small" style={{ color: 'var(--orange)' }}>概略位置：建議在 Google 地圖長按取座標</span>}
            </button>
          ))}
        </div>
      )}
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
