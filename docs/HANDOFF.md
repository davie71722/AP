# 交接說明（給下一個對話）

專案：竹縣大傷後送小幫手（手機直式網頁，繁體中文）。分支 `claude/quirky-edison-cs983x`。
架構與功能說明見 `README.md`、`gas/README.md`。

## 尚未完成的需求（使用者最後一次提出）

1. **回來車輛依待命時間排序**：除留守車外，優先派遣「待命最久」的車。
   - 車輛需新增 `standbySince`（到場、返場、除污完成、恢復待命時設定），見 `src/engine/actions.ts` 的 `setVehicleStatus`、`src/store/store.ts` 的 `addVehicle`。
   - 派車面板（`src/components/SceneTab.tsx` 的 `DispatchPanel`）可派車輛依 `standbySince` 由早到晚排序，預設選第一台，並顯示「待命 N′」；車輛列也同樣排序。
   - **留守車可以不只一輛**（`setHold` 已可把任何待命車設為留守，第 1 輛到場車自動留守）。留守車一律排在最後、不預設選取，但仍可手動選來派車。
2. **受困／脫困標註**：病人可標「受困中」，脫困時記錄時間（`已脫困 HH:MM`）。
   - 病人代碼顯示受困標記；受困中派車要擋下並提示（防呆）；寫入案件經過、交接註解與案件總結。
3. **以資深後送官角度提出並實作改善**：例如每趟車一鍵複製「通報醫院」文字（車號、預估抵院時間、病人與交接註解）、人數核對（總數＝已送＋離開＋待送＋黑）等。
4. **案件存檔**：
   - Dexie（`src/store/db.ts`）新增 `archives` 表；案件結束時自動存檔，也可手動存檔；清除事件前若未存檔自動存檔。
   - 「事件」頁新增「歷史案件」清單：看總結（可複製，用 `buildSummary`）、匯出 JSON、刪除（按兩次）、載入為目前案件（按兩次，會取代本機資料）。

## 慣例與防呆原則（使用者要求）

- 只做手機版；所有彈出視窗下方左「← 返回（不存檔）」、右「✔ 確認」，點視窗外等於確認（`Sheet` in `src/components/common.tsx`）。
- 回報、總結採條列式，沒有的項目不寫；交接註解用連接詞（併、與、及），見 `src/data/narrative.ts`。
- 創傷與處置規則：`src/data/trauma.ts`（傷勢資料）、`src/data/traumaRules.ts`（防呆）、`src/components/TraumaPicker.tsx`。紅黃各五個情境的回歸測試在 `src/data/scenarios.test.ts`（snapshot）。
- 案件經過不列標籤變動、車程查詢等系統紀錄。

## 建置與交付流程

```bash
npx tsc --noEmit -p . && npx vitest run      # 型別與測試（目前 95 項）
npm run build:gas                            # 產生 gas/index.html（GAS 單檔）
```

- 交付給使用者：傳送 `gas/index.html`（`gas/Code.gs` 有改時也要傳），請使用者貼到 GAS 後「部署 → 管理部署作業 → 編輯 → 新版本」。
- 手機預覽版（claude.ai Artifact）：`npx vite build --base ./ --outDir <暫存>/mobile-new`，把新的 `index-*.js/css`、`BodyMap-*.js` 放進 artifact 並更新 `app.html` 的檔名，再發布到同一個連結。
- 手機 e2e：Playwright（`devices['iPhone 13']`），`npx vite preview --port 4173`。
- commit 訊息結尾需加上本 session 規定的 Co-Authored-By 與 Claude-Session 兩行。
