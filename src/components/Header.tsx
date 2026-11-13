import { INCIDENT_TYPE_BY_ID } from '../data/incidentTypes';
import { useStore } from '../store/store';
import type { Color } from '../types';

export function Header() {
  const incident = useStore((s) => s.incident);
  const patients = useStore((s) => s.patients);
  const now = useStore((s) => s.now);
  const online = useStore((s) => s.online);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  const elapsed = incident.startAt ? Math.max(0, now - incident.startAt) : 0;
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
        {c === 'K' ? all.length : `${waiting}/${all.length}`}
      </span>
    );
  };

  return (
    <header className="topbar">
      <div className="r1">
        <span className="clock">{incident.startAt ? clock : '--:--'}</span>
        <span className="meta">
          {types || '未選類型'}｜{incident.location?.label ?? '未選地點'}
        </span>
        <button className="theme-btn" aria-label="切換日間／夜間模式" onClick={() => setTheme(theme === 'day' ? 'night' : 'day')}>
          {theme === 'day' ? '☾' : '☀'}
        </button>
        <span className="online">
          <i style={{ background: online ? 'var(--green)' : 'var(--red)' }} />
          {online ? '連線' : '離線'}
        </span>
      </div>
      <div className="counts">
        {chip('R', '紅')}
        {chip('Y', '黃')}
        {chip('G', '綠')}
        {chip('K', '黑')}
      </div>
    </header>
  );
}
