import { useEffect } from 'react';
import { Header } from './components/Header';
import { IncidentTab } from './components/IncidentTab';
import { ProgressTab } from './components/ProgressTab';
import { ReportTab } from './components/ReportTab';
import { SceneTab } from './components/SceneTab';
import { useStore, type Tab } from './store/store';
import { bootSync, useSync } from './sync/client';

const TABS: { id: Tab; name: string; ic: string }[] = [
  { id: 'incident', name: '事件', ic: '⚑' },
  { id: 'scene', name: '現場', ic: '＋' },
  { id: 'progress', name: '送醫進度', ic: '🚑' },
  { id: 'report', name: '回報', ic: '📋' },
];

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const tick = useStore((s) => s.tick);
  const refreshTravel = useStore((s) => s.refreshTravel);
  const theme = useStore((s) => s.theme);
  const role = useSync((s) => s.role);
  const ended = useStore((s) => !!s.incident.endAt);
  const enRoute = useStore((s) => s.vehicles.filter((v) => v.status === 'transport').length);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'day' ? '#ffffff' : '#000000');
  }, [theme]);

  useEffect(() => {
    void useStore.getState().hydrate();
    const t = setInterval(tick, 1000);
    // 恢復連線時補查（同一地點已查過則略過）
    const onNet = () => {
      tick();
      void refreshTravel();
    };
    window.addEventListener('online', onNet);
    window.addEventListener('offline', tick);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', tick);
    };
  }, [tick, refreshTravel]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshTravel();
    void bootSync(() => window.confirm('加入交接的案件，會取代本機目前的資料。確定加入？'));
  }, [hydrated, refreshTravel]);

  if (!hydrated) return <div className="empty">載入中…</div>;


  return (
    <div className={`app ${role === 'view' ? 'readonly' : ''}`}>
      <Header />
      <main className="main">
        {ended && tab !== 'report' && <div className="ended-bar">🏁 案件已結束｜總結在「回報」</div>}
        {role === 'view' && <div className="readonly-bar">👁 唯讀模式：即時觀看，無法操作</div>}
        {tab === 'incident' && <IncidentTab />}
        {tab === 'scene' && <SceneTab />}
        {tab === 'progress' && <ProgressTab />}
        {tab === 'report' && <ReportTab />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="ic">{t.ic}</span>
            {t.name}
            {t.id === 'progress' && enRoute > 0 && <span className="badge-n">{enRoute}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
