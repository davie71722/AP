// 交接 QR Code：可操作（編輯）／唯讀（檢視）
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { leave, shareUrl, startShare, syncAvailable, useSync, type Role } from '../sync/client';
import { useStore } from '../store/store';
import { DoubleTapButton } from './common';

export function ShareSection() {
  const room = useSync((s) => s.room);
  const role = useSync((s) => s.role);
  const keys = useSync((s) => s.keys);
  const url = useSync((s) => s.url);
  const error = useSync((s) => s.error);
  const lastOk = useSync((s) => s.lastOk);
  const now = useStore((s) => s.now);
  const [mode, setMode] = useState<Role>('edit');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState('');
  const [copied, setCopied] = useState(false);
  const m: Role = role === 'view' ? 'view' : mode;
  const link = room ? shareUrl(m) : '';

  useEffect(() => {
    if (!show || !link) return setImg('');
    QRCode.toDataURL(link, { width: 520, margin: 2, errorCorrectionLevel: 'M' })
      .then(setImg)
      .catch(() => setImg(''));
  }, [show, link, url, keys]);

  if (!syncAvailable()) {
    return (
      <section className="section">
        <h2>交接 QR Code</h2>
        <p className="muted small">需在 GAS 版（Google Apps Script 網址）開啟才能產生交接 QR Code 與多人同步。</p>
      </section>
    );
  }

  const gen = async () => {
    setBusy(true);
    try {
      if (!room) await startShare();
      setShow(true);
    } catch (e) {
      useSync.setState({ error: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 忽略 */
    }
  };
  const ago = lastOk ? Math.max(0, Math.round((now - lastOk) / 1000)) : null;

  return (
    <section className="section share">
      <h2>
        交接 QR Code
        {room && (
          <span className={`chip ${error ? 'R' : 'G'}`} style={{ marginLeft: 8, fontSize: 13 }}>
            {error ? '同步異常' : `同步中${ago !== null ? `・${ago} 秒前` : ''}`}
          </span>
        )}
      </h2>
      {role !== 'view' && (
        <div className="grid g2">
          <button className={`btn ${mode === 'edit' ? 'on' : ''}`} onClick={() => setMode('edit')}>
            ✎ 可操作
            <small className="muted">後送官、協同人員</small>
          </button>
          <button className={`btn ${mode === 'view' ? 'on' : ''}`} onClick={() => setMode('view')}>
            👁 唯讀
            <small className="muted">指揮官、醫師、醫院</small>
          </button>
        </div>
      )}
      <button className="btn primary full" style={{ marginTop: 8 }} disabled={busy} onClick={show ? () => setShow(false) : gen}>
        {busy ? '產生中…' : show ? '收起 QR Code' : `產生交接 QR Code（${m === 'edit' ? '可操作' : '唯讀'}）`}
      </button>
      {show && link && (
        <div className="qr-box">
          {img ? <img src={img} alt="交接 QR Code" /> : <div className="empty">產生中…</div>}
          <div className={`qr-mode ${m}`}>{m === 'edit' ? '✎ 可操作：掃描後可一起派車、記錄' : '👁 唯讀：掃描後只能即時觀看'}</div>
          <button className="btn sm full" onClick={copy}>
            {copied ? '✔ 已複製連結' : '複製連結'}
          </button>
        </div>
      )}
      {error && <p className="small" style={{ color: 'var(--red)' }}>{error}</p>}
      {room && (
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <DoubleTapButton className="sm del-sm" armedText="再按一次離開" onConfirm={() => (leave(), setShow(false))}>
            離開共享
          </DoubleTapButton>
        </div>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>
        多人同時操作即時同步（約 3 秒）；同一位病人或車輛兩人同時修改時，以較晚者為準。
      </p>
    </section>
  );
}

/** 頁首：同步／唯讀狀態 */
export function SyncBadge() {
  const room = useSync((s) => s.room);
  const role = useSync((s) => s.role);
  const error = useSync((s) => s.error);
  if (!room) return null;
  return <span className={`sync-badge ${error ? 'err' : ''} ${role ?? ''}`}>{role === 'view' ? '👁 唯讀' : '⇄ 共享'}</span>;
}
