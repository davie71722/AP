# 用 Google Apps Script（GAS）免費部署

GAS 內建地圖服務（Maps）：**不需要 Google 地圖金鑰、不用綁信用卡**，用一般 Google 帳號就能查地標、地址、車程與展開 Google 地圖短網址。

本資料夾：

| 檔案 | 用途 |
|---|---|
| `Code.gs` | 後端：網頁入口與地圖服務（地點搜尋、短網址展開、車程） |
| `appsscript.json` | 專案設定（台北時區、網頁應用程式任何人可開啟） |
| `index.html` | 整個 App 的單一檔案版（`npm run build:gas` 產生） |

## 兩種部署方式

| | A. 全部放在 GAS（建議先用） | B. 網頁放靜態網站＋GAS 只查地圖 |
|---|---|---|
| 需要的帳號 | Google 帳號 | Google 帳號＋GitHub Pages 或 Cloudflare Pages |
| 費用 | 免費 | 免費 |
| 店家／地標搜尋、車程 | ✅ | ✅ |
| 斷網使用（離線） | ❌ 需連網開啟 | ✅ 首次開啟後可離線 |
| 手機 GPS 定位 | 不確定（GAS 網頁在 iframe 中，請實測） | ✅ |
| 加入手機主畫面 | 可（書籤捷徑） | ✅ 可安裝為 App |

## A. 全部放在 GAS

1. 到 <https://script.google.com> →「新專案」，命名「竹縣大傷後送小幫手」。
2. 左側「專案設定」→ 勾選「在編輯器中顯示 appsscript.json」，把本資料夾的 `appsscript.json` 內容貼上覆蓋。
3. `Code.gs`：把本資料夾的 `Code.gs` 內容貼上覆蓋。
4. 左側「檔案 ＋」→「HTML」，命名 `index`（會變成 index.html），把本資料夾的 `index.html` 整份貼上。
5. 上方函式選 `test` →「執行」，依畫面完成授權（地圖、外部連線、快取）。記錄中看到地點與車程結果即正常。
6. 右上「部署」→「新增部署作業」→ 類型「網頁應用程式」：執行身分「我」，存取權「任何人」→ 部署。
7. 複製網頁應用程式網址（`https://script.google.com/macros/s/…/exec`），用手機開啟即可使用。

程式更新時：重新執行 `npm run build:gas`，把新的 `index.html`、`Code.gs` 貼上後，「部署」→「管理部署作業」→ 編輯 → 版本選「新版本」。網址不變。

## B. 網頁放靜態網站，GAS 只查地圖

1. 依 A 的步驟 1–3、5–7 建立 GAS（不需要 `index.html`）。
2. 專案根目錄建立 `.env`：
   ```
   VITE_ROUTES_PROXY_URL=https://script.google.com/macros/s/…/exec
   ```
3. `npm run build`，把 `dist/` 放到 GitHub Pages 或 Cloudflare Pages。

## 防止網址被濫用（選用）

GAS「專案設定 → 指令碼屬性」新增 `TOKEN`（任意長字串）；App 建置時 `.env` 加上 `VITE_MAP_TOKEN=同一個字串`。未帶正確 TOKEN 的請求會被拒絕。這只是降低風險：TOKEN 會包含在網頁程式中，有心人仍可取得。

## 額度與省額度設計

事故地點一確定就固定，所以車程**每起事件只查一次**：

- 現場 → 24 家醫院（回程沿用同一時間）
- 21 個分隊＋3 個支援來源 → 現場（新增車輛時直接用查好的到場時間）
- 合計約 48 筆路線查詢；地點變更或在「派遣」分頁點「車程 ↻」才會重查
- 查詢結果另暫存在 GAS（車程 10 分鐘、地點 6 小時）
- 查詢失敗或額度用完時，App 自動改用離線估算，畫面標示「離線估算」

GAS 免費帳號的地圖服務、外部連線有每日次數上限（以 Google「Apps Script 配額」頁面為準，建議部署後以一次演練實測）。

## 與 Cloudflare＋Google 金鑰版的差別

| | GAS（免費） | Cloudflare Worker＋Google 金鑰 |
|---|---|---|
| 金鑰／信用卡 | 不需要 | 需要（Google Cloud 帳單） |
| 地標搜尋 | Geocoder（地址佳；店家名稱較弱） | Places 搜尋（店家、地標較準） |
| 車程 | 逐筆路線查詢，含路況（若有） | Routes 矩陣，即時路況 |
| 查詢時機 | 地點確定時一次 | 地點確定時一次 |

## 交接 QR Code／多人同步

`Code.gs` 內含同步端點（`{ sync: 'create' | 'get' | 'put' }`），不需額外設定：

- 更新 `Code.gs` 後務必「部署 → 管理部署作業 → 編輯 → 版本：新版本 → 部署」，網址不變。
- QR Code 內容為本 GAS 網址加上 `?room=房號&k=交接碼`；可操作碼與唯讀碼不同，唯讀碼送出的修改會被伺服器拒絕。
- 資料存在 CacheService（每段 25,000 字分段儲存，LockService 避免同時寫入衝突），有人使用就延長，6 小時無人使用自動失效。
- 每台手機約每 3 秒同步一次（`google.script.run`），一般大傷規模（數十位病人、數支手機）在免費額度內。
