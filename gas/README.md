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

GAS 免費帳號的地圖服務、外部連線有每日次數上限（官方額度請以 Google「Apps Script 配額」頁面為準，部署後建議實測）。本程式的省額度設計：

- 車程只查「現場 → 各醫院」（約 24 次），回程沿用同一時間；趕赴中車輛另查。
- 查詢結果暫存：車程 10 分鐘、地點 6 小時，同一地點重複查詢不再耗用額度。
- 使用 GAS 時車程每 30 分鐘才更新一次（Cloudflare＋金鑰版為 5 分鐘）。
- 額度用完或查詢失敗時，App 自動改用離線估算，畫面標示「離線估算」。

估計用量：一起 3 小時的事件約 150–200 次路線查詢、數次地點搜尋。

## 與 Cloudflare＋Google 金鑰版的差別

| | GAS（免費） | Cloudflare Worker＋Google 金鑰 |
|---|---|---|
| 金鑰／信用卡 | 不需要 | 需要（Google Cloud 帳單） |
| 地標搜尋 | Geocoder（地址佳；店家名稱較弱） | Places 搜尋（店家、地標較準） |
| 車程 | 逐筆路線查詢，含路況（若有） | Routes 矩陣，即時路況 |
| 更新頻率 | 30 分鐘 | 5 分鐘 |
