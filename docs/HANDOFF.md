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

5. **第二輪（使用者回饋）**：
   - 關西轄區：桃園國軍優先（各色，紅傷也列入第一層），其次東元、台大生醫竹北（`weights.ts` 的 `AreaRule.bonus`／`tier1`）。
   - 藥物防呆（依 2026 新竹縣到院前救護作業流程手冊）：`drugBlock`（`traumaRules.ts`）。Nalbuphine（P3）：未滿18／兒童、懷孕、GCS<14、明顯頭部或軀幹鈍挫傷不可選；骨盆骨折已移除 Nalbuphine。Transamin（T0 註6）：需休克徵象（血壓<90／心跳>120／出血性休克）、IV／IO、受傷 3 小時內、成人。已給藥後才出現禁忌會提醒。病人視窗新增「兒童／未滿18／孕婦」標籤。
   - 進階呼吸道（插管、i-gel、環甲切）只選一次：已在某傷勢記錄後，其他傷勢不再顯示。
   - 受困按鈕只留在派車面板（病人視窗不再出現）。
   - 回報頁：回報文字下方「後送病患傷情初步報告」（醫院、後送時間、由誰後送、傷情；`buildTransportReport`）；案件結束移到交接 QR Code 下方。

6. **兒童送醫**：創傷事件的兒童送外傷重度級醫院（`pedsTrauma`），不因兒科標籤加分；兒科醫院加分只用於非創傷（兒童內科）。顏面創傷、連枷胸／穿刺傷、骨盆骨折維持排除 Nalbuphine（使用者確認）。

7. **留守車鎖定**：留守車預設不可派、不可解除留守，待送（非黑）剩最後 2 位傷患時才開放（`holdUnlocked`、`HOLD_RELEASE_AT`）。派車面板留守車按鈕停用並顯示說明；store 的 `dispatchManual`、`releaseHold` 也擋下。

## 可再考慮

- 多人同步時，其他裝置收到「案件結束」不會自動存檔（只有按結束的裝置會存）。

## 慣例與防呆原則（使用者要求）

- 只做手機版；所有彈出視窗下方左「← 返回（不存檔）」、右「✔ 確認」，點視窗外等於確認（`Sheet` in `src/components/common.tsx`）。
- 回報、總結採條列式，沒有的項目不寫；交接註解用連接詞（併、與、及），見 `src/data/narrative.ts`。
- 創傷與處置規則：`src/data/trauma.ts`（傷勢資料）、`src/data/traumaRules.ts`（防呆）、`src/components/TraumaPicker.tsx`。紅黃各五個情境的回歸測試在 `src/data/scenarios.test.ts`（snapshot）。
- 案件經過不列標籤變動、車程查詢等系統紀錄。

## 建置與交付流程

```bash
npx tsc --noEmit -p . && npx vitest run      # 型別與測試（目前 112 項）
npm run build:gas                            # 產生 gas/index.html（GAS 單檔）
```

- 交付給使用者：傳送 `gas/index.html`（`gas/Code.gs` 有改時也要傳），請使用者貼到 GAS 後「部署 → 管理部署作業 → 編輯 → 新版本」。
- 手機預覽版（claude.ai Artifact）：`npx vite build --base ./ --outDir <暫存>/mobile-new`，把新的 `index-*.js/css`、`BodyMap-*.js` 放進 artifact 並更新 `app.html` 的檔名，再發布到同一個連結。
- 手機 e2e：Playwright（`devices['iPhone 13']`），`npx vite preview --port 4173`。
- commit 訊息結尾需加上本 session 規定的 Co-Authored-By 與 Claude-Session 兩行。
