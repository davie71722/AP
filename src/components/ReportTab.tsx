import { useState } from 'react';
import { buildReport, buildSummary, caseLog, download, logToCsv, patientsToCsv } from '../report/report';
import { DoubleTapButton } from './common';
import { fmtClock } from '../engine/actions';
import { useStore } from '../store/store';
import { ShareSection } from './ShareSection';

export function ReportTab() {
  const incident = useStore((s) => s.incident);
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const runtime = useStore((s) => s.runtime);
  const now = useStore((s) => s.now);
  const [copied, setCopied] = useState(false);
  const text = buildReport(incident, patients, vehicles, runtime, now);
  const stamp = new Date(now).toISOString().slice(0, 16).replace(/[:T]/g, '');
  const entries = caseLog(incident);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 舊瀏覽器退回
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <section className="section">
        <h2>回報文字</h2>
        <div className="report">{text}</div>
        <button className="btn primary full" style={{ marginTop: 10 }} onClick={copy}>
          {copied ? '✔ 已複製' : '📋 複製回報文字'}
        </button>
      </section>
      <EndSection />
      <ShareSection />
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

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
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
  const [copied, setCopied] = useState(false);
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
      <button
        className="btn primary full"
        style={{ marginTop: 10 }}
        onClick={async () => {
          await copyText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? '✔ 已複製' : '📋 複製案件總結'}
      </button>
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <DoubleTapButton className="sm del-sm" armedText="再按一次重新開啟" onConfirm={reopen}>
          重新開啟案件
        </DoubleTapButton>
      </div>
    </section>
  );
}
