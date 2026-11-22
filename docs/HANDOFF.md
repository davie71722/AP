# 交接說明（給下一個對話）

專案：竹縣大傷後送小幫手（手機直式網頁，繁體中文）。分支 `claude/quirky-edison-cs983x`。
架構與功能說明見 `README.md`、`gas/README.md`。

## 已完成（本輪）

1. **車輛依待命時間排序**：`Vehicle.standbySince`（`setVehicleStatus` 進入待命時設定、`addVehicle` 到場時設定、派車清除）。`dispatchOrder()`（`src/types.ts`）：待命最久 → 趕赴中 → 留守車（可多輛）最後。派車面板預設選第一台非留守車並顯示「待命 N′」；車輛列同序；派遣建議（`plan.ts`）同時可用時也先派待命最久者。
2. **受困／脫困**：`Patient.trapped`、`extricatedAt`；`setTrapped`（`actions.ts`）。派車面板每位病人有「受困?」鍵，受困中擋下出發並可一鍵「已脫困」；病人視窗可標記。代碼顯示 ⛓受困／脫困HH:MM；交接註解前綴「受困中。」或「受困，HH:MM 脫困。」；回報列「受困中」、總結列「受困」。
3. **後送官改善**：
   - 送醫進度每趟「📋 複製通報醫院文字」（`hospitalNotice`）。
   - 人數核對：總數＝已送＋離開＋待送＋黑（`headcountText`），顯示在現場待送標題、回報、總結。
   - 紅傷待送逾 10 分提醒（現場頁）。
4. **案件存檔**：Dexie v2 `archives` 表（`src/store/db.ts`）；案件結束自動存檔、回報頁手動「💾 存檔案件」、清除事件前自動存檔（同一案件以 `case-<startAt>` 覆寫）。事件頁「歷史案件」：總結（可複製）、匯出 JSON、刪除、載入為目前案件（皆按兩次；載入前先存檔目前案件）。

## 可再考慮

- 多人同步時，其他裝置收到「案件結束」不會自動存檔（只有按結束的裝置會存）。

## 慣例與防呆原則（使用者要求）

- 只做手機版；所有彈出視窗下方左「← 返回（不存檔）」、右「✔ 確認」，點視窗外等於確認（`Sheet` in `src/components/common.tsx`）。
- 回報、總結採條列式，沒有的項目不寫；交接註解用連接詞（併、與、及），見 `src/data/narrative.ts`。
- 創傷與處置規則：`src/data/trauma.ts`（傷勢資料）、`src/data/traumaRules.ts`（防呆）、`src/components/TraumaPicker.tsx`。紅黃各五個情境的回歸測試在 `src/data/scenarios.test.ts`（snapshot）。
- 案件經過不列標籤變動、車程查詢等系統紀錄。

## 建置與交付流程

```bash
npx tsc --noEmit -p . && npx vitest run      # 型別與測試（目前 105 項）
npm run build:gas                            # 產生 gas/index.html（GAS 單檔）
```

- 交付給使用者：傳送 `gas/index.html`（`gas/Code.gs` 有改時也要傳），請使用者貼到 GAS 後「部署 → 管理部署作業 → 編輯 → 新版本」。
- 手機預覽版（claude.ai Artifact）：`npx vite build --base ./ --outDir <暫存>/mobile-new`，把新的 `index-*.js/css`、`BodyMap-*.js` 放進 artifact 並更新 `app.html` 的檔名，再發布到同一個連結。
- 手機 e2e：Playwright（`devices['iPhone 13']`），`npx vite preview --port 4173`。
- commit 訊息結尾需加上本 session 規定的 Co-Authored-By 與 Claude-Session 兩行。
