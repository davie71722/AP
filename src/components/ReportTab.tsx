import { useState } from 'react';
import { buildReport, download, logToCsv, patientsToCsv } from '../report/report';
import { useStore } from '../store/store';

export function ReportTab() {
  const incident = useStore((s) => s.incident);
  const patients = useStore((s) => s.patients);
  const vehicles = useStore((s) => s.vehicles);
  const runtime = useStore((s) => s.runtime);
  const now = useStore((s) => s.now);
  const [copied, setCopied] = useState(false);
  const text = buildReport(incident, patients, vehicles, runtime, now);
  const stamp = new Date(now).toISOString().slice(0, 16).replace(/[:T]/g, '');

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
      <section className="section">
        <h2>匯出（事後檢討）</h2>
        <div className="grid">
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
            完整 JSON
          </button>
          <button className="btn" onClick={() => download(`mci-log-${stamp}.csv`, logToCsv(incident), 'text/csv')}>
            操作紀錄 CSV
          </button>
          <button className="btn" onClick={() => download(`mci-patients-${stamp}.csv`, patientsToCsv(patients), 'text/csv')}>
            傷患清單 CSV
          </button>
        </div>
      </section>
      <section className="section">
        <h2>操作紀錄（{incident.log.length}）</h2>
        <div className="log">
          {[...incident.log].reverse().map((l, i) => (
            <div key={i}>
              <time>{new Date(l.at).toLocaleTimeString('zh-TW')}</time>
              {l.text}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
