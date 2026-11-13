import { useEffect } from 'react';
import { DispatchTab } from './components/DispatchTab';
import { FleetTab } from './components/FleetTab';
import { Header } from './components/Header';
import { HospitalTab } from './components/HospitalTab';
import { IncidentTab } from './components/IncidentTab';
import { InputTab } from './components/InputTab';
import { ReportTab } from './components/ReportTab';
import { useStore, type Tab } from './store/store';
import { usePlan } from './store/usePlan';

const TABS: { id: Tab; name: string; ic: string }[] = [
  { id: 'incident', name: '事件', ic: '⚑' },
  { id: 'input', name: '檢傷', ic: '＋' },
  { id: 'fleet', name: '現況', ic: '📊' },
  { id: 'dispatch', name: '派遣', ic: '🚑' },
  { id: 'hospital', name: '醫院', ic: '🏥' },
  { id: 'report', name: '回報', ic: '📋' },
];

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const tick = useStore((s) => s.tick);
  const refreshTravel = useStore((s) => s.refreshTravel);
  const plan = usePlan();
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'day' ? '#ffffff' : '#000000');
  }, [theme]);

  useEffect(() => {
    void useStore.getState().hydrate();
    const t = setInterval(tick, 1000);
    // 每 5 分鐘更新即時車程
    const r = setInterval(() => void refreshTravel(), 60000);
    const onNet = () => {
      tick();
      void refreshTravel(true);
    };
    window.addEventListener('online', onNet);
    window.addEventListener('offline', tick);
    return () => {
      clearInterval(t);
      clearInterval(r);
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', tick);
    };
  }, [tick, refreshTravel]);

  useEffect(() => {
    if (hydrated) void refreshTravel();
  }, [hydrated, refreshTravel]);

  if (!hydrated) return <div className="empty">載入中…</div>;

  const confirmable = plan.suggestions.filter((s) => s.confirmable).length;

  return (
    <div className="app">
      <Header />
      <main className="main">
        {tab === 'incident' && <IncidentTab />}
        {tab === 'input' && <InputTab />}
        {tab === 'fleet' && <FleetTab />}
        {tab === 'dispatch' && <DispatchTab />}
        {tab === 'hospital' && <HospitalTab />}
        {tab === 'report' && <ReportTab />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="ic">{t.ic}</span>
            {t.name}
            {t.id === 'dispatch' && confirmable > 0 && <span className="badge-n">{confirmable}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
