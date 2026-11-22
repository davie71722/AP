import { useState } from 'react';
import { buildReport, buildSummary, buildTransportReport, caseLog, download, logToCsv, patientsToCsv } from '../report/report';
import { CaseComposites, DoubleTapButton, ShareButtons } from './common';
import { useStoredComposites } from './Photos';
import { fmtClock } from '../engine/actions';
import { useStore } from '../store/store';
import { ShareSection } from './ShareSection';

export function ReportTab() {
  const incident = useStore((s) => s.incident);
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const runtime = useStore((s) => s.runtime);
  const now = useStore((s) => s.now);
  const text = buildReport(incident, patients, vehicles, runtime, now);
  const stamp = new Date(now).toISOString().slice(0, 16).replace(/[:T]/g, '');
  const entries = caseLog(incident);

  return (
    <>
      <section className="section">
        <h2>回報文字</h2>
        <div className="report">{text}</div>
        <ShareButtons className="mt8" copyLabel="📋 複製回報" text={text} />
      </section>
      <TransportReport />
      <ShareSection />
      <EndSection />
      <section className="section">
        <h2>案件經過（{entries.length}）</h2>
        <div className="log">
          {[...entries].reverse().map((l, i) => (
            <div key={i}>
              <time>{fmtClock(l.at)}</time>
              {l.text}
            </div>
          ))}
        </div>
      </section>
      <section className="section">
        <h2>匯出（事後檢討）</h2>
        <div className="grid">
          <ArchiveButton />
          <button className="btn" onClick={() => download(`案件經過-${stamp}.csv`, logToCsv(incident), 'text/csv')}>
            案件經過 CSV
          </button>
          <button className="btn" onClick={() => download(`傷患清單-${stamp}.csv`, patientsToCsv(patients, vehicles), 'text/csv')}>
            傷患清單 CSV
          </button>
          <button
            className="btn"
            onClick={() =>
              download(
                `mci-${stamp}.json`,
                JSON.stringify({ exportedAt: now, incident, patients, vehicles, runtime }, null, 2),
                'application/json',
              )
            }
          >
            完整資料 JSON
          </button>
        </div>
      </section>
    </>
  );
}

/** 案件結束與戰況統整 */
function EndSection() {
  const incident = useStore((s) => s.incident);
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const runtime = useStore((s) => s.runtime);
  const now = useStore((s) => s.now);
  const end = useStore((s) => s.endIncident);
  const reopen = useStore((s) => s.reopenIncident);
  if (!incident.startAt) return null;
  const waiting = patients.filter((p) => p.status === 'waiting' && p.color !== 'K').length;
  const enroute = vehicles.filter((v) => v.status === 'transport').length;

  if (!incident.endAt) {
    return (
      <section className="section">
        <h2>案件結束</h2>
        {(waiting > 0 || enroute > 0) && (
          <p className="small" style={{ color: 'var(--orange)', fontWeight: 800, marginTop: 0 }}>
            ⚠ {[waiting ? `尚有 ${waiting} 位未後送` : '', enroute ? `${enroute} 台車運送中` : ''].filter(Boolean).join('、')}
          </p>
        )}
        <DoubleTapButton className="full end-btn" armedText="再按一次確認結束案件" onConfirm={end}>
          🏁 案件結束
        </DoubleTapButton>
      </section>
    );
  }
  const text = buildSummary(incident, patients, vehicles, runtime, now);
  return (
    <section className="section end-sec">
      <h2>案件總結</h2>
      <div className="report">{text}</div>
      <ShareButtons className="mt8" copyLabel="📋 複製總結" text={text} />
      <EndComposites />
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <DoubleTapButton className="sm del-sm" armedText="再按一次重新開啟" onConfirm={reopen}>
          重新開啟案件
        </DoubleTapButton>
      </div>
    </section>
  );
}

/** 手動存檔到「歷史案件」（同一案件覆寫） */
function ArchiveButton() {
  const startAt = useStore((s) => s.incident.startAt);
  const archivedAt = useStore((s) => s.archivedAt);
  const archive = useStore((s) => s.archiveCurrent);
  const [msg, setMsg] = useState('');
  if (!startAt) return null;
  return (
    <button
      className="btn primary"
      onClick={async () => {
        const ok = await archive();
        setMsg(ok ? '✔ 已存檔' : '存檔失敗');
        setTimeout(() => setMsg(''), 2000);
      }}
    >
      {msg || `💾 存檔案件${archivedAt ? `（上次 ${fmtClock(archivedAt)}）` : ''}`}
    </button>
  );
}

/** 後送病患傷情初步報告（回報文字下方） */
function TransportReport() {
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const text = buildTransportReport(patients, vehicles);
  return (
    <section className="section">
      <h2>後送病患傷情初步報告</h2>
      {text ? (
        <>
          <div className="report">{text}</div>
          <ShareButtons className="mt8" copyLabel="📋 複製報告" text={text} />
        </>
      ) : (
        <div className="empty">尚無後送病患</div>
      )}
    </section>
  );
}

/** 案件結束：本案所有合成照片（可全部分享或存到手機） */
function EndComposites() {
  const patients = useStore((s) => s.patients);
  const { previews, files } = useStoredComposites(
    patients.map((p) => p.id),
    (pid) => patients.find((p) => p.id === pid)?.label ?? 'photo',
  );
  return <CaseComposites previews={previews} files={files} />;
}
