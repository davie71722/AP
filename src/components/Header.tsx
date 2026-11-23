import { useEffect, useState } from 'react';
import { INCIDENT_TYPE_BY_ID } from '../data/incidentTypes';
import { useStore } from '../store/store';
import { SyncBadge } from './ShareSection';
import { useTriage } from '../store/usePlan';
import type { Color } from '../types';

export function Header() {
  const incident = useStore((s) => s.incident);
  const patients = useStore((s) => s.patients);
  const now = useStore((s) => s.now);
  const online = useStore((s) => s.online);
  const theme = useStore((s) => s.theme);
  const { names } = useTriage();
  const setTheme = useStore((s) => s.setTheme);

  const elapsed = incident.startAt ? Math.max(0, (incident.endAt ?? now) - incident.startAt) : 0;
  const mm = Math.floor(elapsed / 60000);
  const ss = Math.floor((elapsed % 60000) / 1000);
  const hh = Math.floor(mm / 60);
  const clock =
    hh > 0
      ? `${hh}:${String(mm % 60).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
      : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  const types = incident.types.map((t) => INCIDENT_TYPE_BY_ID[t]?.name).join('＋');

  const chip = (c: Color, name: string) => {
    const all = patients.filter((p) => p.color === c);
    const waiting = all.filter((p) => p.status === 'waiting').length;
    return (
      <span className={`chip ${c}`} key={c}>
        {name}
        {name.length > 1 ? ' ' : ''}
        {c === 'K' ? all.length : `${waiting}/${all.length}`}
      </span>
    );
  };

  return (
    <header className="topbar">
      <div className="r1">
        <span className="clock">{incident.startAt ? clock : '--:--'}</span>
        <span className="meta">
          {incident.name?.trim() ? <b className="case-title">{incident.name.trim()}</b> : types || '未設定案件'}｜{incident.location?.label ?? '未選地點'}
        </span>
        <button className="theme-btn" aria-label="切換日間／夜間模式" onClick={() => setTheme(theme === 'day' ? 'night' : 'day')}>
          {theme === 'day' ? '☾' : '☀'}
        </button>
        <EnvBadge />
        <SyncBadge />
        <span className="online">
          <i style={{ background: online ? 'var(--green)' : 'var(--red)' }} />
          {online ? '連線' : '離線'}
        </span>
      </div>
      <div className="counts">
        {chip('R', names.R)}
        {chip('Y', names.Y)}
        {chip('G', names.G)}
        {chip('K', names.K)}
      </div>
    </header>
  );
}

/** 正式勤務／演練測試：連按兩下切換 */
function EnvBadge() {
  const mode = useStore((s) => s.incident.drill);
  const drill = !!mode;
  const started = useStore((s) => !!s.incident.startAt);
  const setDrill = useStore((s) => s.setDrill);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  if (mode === undefined) return <span className="env-badge unset">未設定</span>;
  return (
    <button
      className={`env-badge ${drill ? 'drill' : 'real'}`}
      disabled={!started}
      title="連按兩下切換正式勤務／演練測試"
      onClick={() => (armed ? (setDrill(!drill), setArmed(false)) : setArmed(true))}
    >
      {armed ? `改為${drill ? '正式' : '演練'}？` : drill ? '演練' : '正式'}
    </button>
  );
}
