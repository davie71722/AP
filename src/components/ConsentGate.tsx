// 進入系統前：保密暨資通安全使用聲明（必填真實姓名＋勾選同意），進入後全畫面動態浮水印
import { useEffect, useState, type ReactNode } from 'react';
import { fetchIp, lastName, useConsent, validName } from '../security/consent';
import { useStore } from '../store/store';

const LEAVE_URL = 'https://www.hcfd.gov.tw/';

export function ConsentGate({ children }: { children: ReactNode }) {
  const operator = useConsent((s) => s.operator);
  const drill = useStore((s) => !!s.incident.drill);
  if (!operator) return <ConsentModal />;
  return (
    <>
      {children}
      <Watermark name={operator.name} ip={operator.ip} drill={drill} />
    </>
  );
}

function ConsentModal() {
  const agree = useConsent((s) => s.agree);
  // 同意畫面在 App 之前顯示，需自行套用日間／夜間主題
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const [name, setName] = useState(lastName());
  const [checked, setChecked] = useState(false);
  const [ip, setIp] = useState<string | null>(null);
  useEffect(() => {
    void fetchIp().then(setIp);
  }, []);
  const nameOk = validName(name);
  const ready = nameOk && checked;
  return (
    <div className="consent-bg">
      <div className="consent">
        <h1>新竹縣政府消防局大量傷病患資訊系統 — 保密暨資通安全使用聲明</h1>
        <div className="consent-body">
          <p>歡迎使用本系統。為嚴格保護傷病患隱私權益、落實緊急醫療救護倫理，並符合國家資通安全與公務保密規範，於進入及操作本系統前，請詳閱並同意以下事項：</p>
          <ol>
            <li>
              <b>法令遵循與敏感醫療個資保護</b>
              <p>
                本系統所登錄、顯示及產出之資訊，包括但不限於傷病患姓名、身分證字號、傷勢評估、緊急醫療處置及後送去向等內容，均屬受《個人資料保護法》第 6 條（特種個資）、《醫療法》第 72 條及《緊急醫療救護法》第 37 條嚴格保護之敏感性個人與醫療機密資料。使用者僅限於執行公務、救護演練及緊急醫療交接之必要範圍內查閱與操作，嚴禁為任何職務以外之目的蒐集、處理或利用。
              </p>
            </li>
            <li>
              <b>嚴禁對外洩漏予媒體及透過第三方通訊軟體轉傳</b>
              <p>非經本局權責長官正式核准，嚴禁以任何形式對外揭露本系統之任何內容，尤其嚴禁私自提供、爆料或洩漏予新聞媒體、記者或無關第三人。</p>
              <p>
                亦嚴禁透過任何第三方即時通訊軟體（包括但不限於 LINE、Messenger、WhatsApp、Telegram、WeChat 等）、電子郵件或社群平台，轉傳、分享本系統所產出之任何文字訊息、統計數據、報表、螢幕截圖、翻拍照片或影音檔案。
              </p>
              <p className="consent-except">
                <b>例外：</b>本系統內建之 LINE 分享功能（發車通報、通報醫院文字、傷病患合成照片等），係經本局權責長官核准之大量傷病患事故通報管道，僅限傳送至指定之收治醫院或本局指揮群組，嚴禁轉傳其他個人、群組或對象，亦不得另行截圖、翻拍或下載後再轉傳。
              </p>
            </li>
            <li>
              <b>違規之刑事、民事及行政懲處責任</b>
              <p>
                凡違反本聲明之保密及資安規定者，一經查獲，除依《公務人員考績法》、《公務員懲戒法》及消防人員獎懲標準從嚴追究行政違失責任（最重予以記過、免職或停職處分）外，並將依法移送司法機關追究下列法律責任：
              </p>
              <ul>
                <li>
                  刑事責任：涉犯《刑法》第 132 條（公務員洩漏國防以外秘密罪，最重處三年以下有期徒刑）、《刑法》第 318 條之 1（無故洩漏因利用電腦設備知悉之他人秘密罪），以及《個人資料保護法》第 41 條（違法蒐集、處理或利用特種個資罪，最重處五年以下有期徒刑，得併科新臺幣一百萬元以下罰金）。
                </li>
                <li>民事責任：依《個人資料保護法》第 28 條及《民法》侵權行為規定，違規人員須對被害人負損害賠償責任（含非財產上之精神慰撫金），本局亦得依法行使求償權。</li>
              </ul>
            </li>
            <li>
              <b>操作者實名登記、防翻拍浮水印及 IP 全程稽核留存</b>
              <p>
                為確保資通安全與資料可歸責性，本系統依據《資通安全管理法》建置完整稽核軌跡（Audit Log）。使用者進入系統前須填寫真實姓名，系統將於所有操作畫面自動生成包含「操作者姓名、連線 IP 位址及當下時間」之防翻拍動態浮水印，並於後端自動記錄使用者之姓名、操作時間、查閱及異動紀錄、連線裝置識別碼及網際網路位址（IP Address）。上述紀錄將永久保存並作為資安稽核、政風調查及司法追訴之直接證據。
              </p>
            </li>
            <li>
              <b>勤務與演練模式嚴格區隔</b>
              <p>操作人員進入系統後應立即確認當前環境（正式勤務／演練測試），演練結束後應依規定辦理資料清整，嚴禁將演練測試畫面外流造成社會大眾誤解或恐慌。</p>
            </li>
          </ol>
        </div>

        <label className="consent-field">
          <span>操作人員真實姓名（必填，將顯示於畫面浮水印）</span>
          <input value={name} placeholder="請輸入中文全名（例如：王小明）" maxLength={20} onChange={(e) => setName(e.target.value)} />
          {name && !nameOk && <small>請輸入真實姓名（2–20 字，不可為純數字或特殊符號）</small>}
        </label>

        <label className="consent-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>我已詳閱上述病患個資保護、嚴禁洩漏媒體與通訊軟體轉傳之規範，並完全同意記錄本人姓名、IP 與操作軌跡，願負一切法律與行政責任。</span>
        </label>

        <div className="consent-actions">
          <a className="btn" href={LEAVE_URL} target="_top" rel="noreferrer">
            不同意（離開）
          </a>
          <button className="btn go" disabled={!ready || ip === null} onClick={() => agree(name, ip ?? 'IP未取得')}>
            {ip === null ? '取得連線資訊…' : '同意並進入系統'}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmt(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 防翻拍動態浮水印：操作者姓名、連線 IP、當下時間（每分鐘更新），斜向重複鋪滿畫面，不影響操作 */
function Watermark({ name, ip, drill }: { name: string; ip: string; drill: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const text = `${drill ? '【演練】' : ''}${name} ${ip} ${fmt(now)}`;
  const esc = text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200"><text x="10" y="120" transform="rotate(-25 170 100)" font-family="sans-serif" font-size="15" font-weight="700" fill="rgba(128,128,128,0.22)">${esc}</text></svg>`;
  return <div className="watermark" aria-hidden="true" style={{ backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")` }} />;
}
