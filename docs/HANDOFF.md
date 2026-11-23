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

8. **其他車輛（限綠牌）**：派車面板選的病人全為綠牌時出現「勤務車／民間救護車／巴士」，有紅黃就不出現（`OTHER_VEHICLES`、store `otherTransport`，一筆撤銷）。病人記錄 `byKind`；回報、總結、傷情初步報告、送醫進度顯示車種。

9. **選車大隊順序**：救護車到場／新增車輛視窗，事發轄區所屬大隊排最上方（轄區分隊排第一），其餘依大隊順序（`brigadeOrder`、`unitsOf`）。芎林改為第三大隊。

10. **分享**：所有複製處改為「📋 複製／📤 分享／LINE」（`ShareButtons`）。分享用系統分享面板（`navigator.share`），GAS 嵌入頁可能被擋，擋下時改為複製；LINE 用 `line.me/R/share?text=` 連結。確認發車後現場頁出現「✔ 已發車」卡片（`dispatchShareText`：車輛、醫院、ETA、檢傷、精簡傷勢 `briefInjury`）。
11. **黑牌區**：`Patient.policeAt`（已移交警方時間；未設定＝待警察接管）、`Incident.morgue`（暫置區位置、看守人員，已加入同步欄位）。現場頁「黑牌區」：計數、逐位切換移交、位置與看守輸入（離開輸入框時記入案件經過），未指定看守／位置時警示。回報「黑牌區」、總結列出移交狀態與暫置區。

12. **個案照片**：病人視窗「📷 拍照」，上限 2 張（`MAX_PHOTOS`），以原始大小存在本機 Dexie `photos` 表（v3；JPEG／PNG／WebP 存原檔，HEIC 等轉原尺寸 JPEG；點縮圖全螢幕檢視），**不同步**（GAS CacheService 單筆上限 100KB）。發車卡片與每趟通報醫院的「📤 分享」連同照片送出（`navigator.share` files）；LINE 鍵只帶文字。刪除歷史案件時一併刪照片（`src/components/Photos.tsx`）。
13. **個案備註**：`Patient.personal`（姓名、年齡、性別、電話、拍拍尺號碼，可空白），病人視窗「🔒 個案備註（不分享）」。不出現在任何分享／回報／總結文字（有測試）；只在傷患清單 CSV 與 JSON 匯出。年齡 <18 也會擋 Nalbuphine／Transamin。

14. **拍拍尺號碼**：從個案備註移出，病人視窗獨立欄位（存在 `personal.patNo`），**會**出現在發車分享與通報醫院（`patTag`）。「📷 掃 QR」拍照解碼（`src/components/qr.ts`：BarcodeDetector，否則 jsQR）；網址取最後查詢值或路徑段（`patNoFromQr`）。實際拍拍尺 QR 內容格式未確認，必要時調整 `patNoFromQr`。

15. **照片加工**：分享時照片下方加資訊欄（不遮住照片，原解析度）：代碼（拍拍尺）、車輛 ➔ 醫院、出發｜ETA、精簡傷勢與註解（`photoCaption`、`annotatePhoto`、`useAnnotatedFiles`）。不含姓名等個案備註。發車卡片顯示加工後預覽；每趟通報醫院同樣附加工照片。

16. **照片一／照片二與合成照片**（取代第 15 項的單張資訊欄）：病人視窗兩格，各自「📷 拍照一／二」開相機、可重拍與刪除（`PhotoRow.slot`）。照片一、二同高並排合成一張，下方資訊欄：牌色色塊（紅牌 紅1-C）、性別｜年齡、拍拍尺、醫院、送醫時間（出發｜ETA）、車輛、傷勢（`photoPanel`、`composePhotos`、`useComposites`）。病人視窗即時預覽；發車卡片與通報醫院分享每位病人一張合成照片。姓名、電話不出現；性別、年齡依使用者要求出現在合成照片。

17. **LINE 分享照片**：合成照片下方「LINE 分享照片」（`LinePhotoButton`）：開系統分享面板（選 LINE）；被擋（GAS 嵌入頁）時存到手機（檔名 `MCI-R1-C.jpg`，`asciiName`）並提示從 LINE 傳。出現在病人視窗、發車卡片、每趟通報醫院。拍完照片即自動合成。

18. **合成照片保存與簡化**：背景 `CompositeKeeper`（掛在 App）在照片或病人資訊變動時自動重新合成，存入 Dexie `composites` 表（v4，每位病人一張，key 相同不重做）；各處以 `useStoredComposites` 讀取。合成照片動作統一為 `PhotoActions`（LINE 分享照片＋💾 存到手機）。案件結束區與歷史案件顯示本案全部合成照片，可全部分享或存檔；刪除歷史案件一併刪除。病人視窗照片與拍拍尺移到最上方。文字分享鍵只帶文字、照片鍵只帶照片。

19. **出發即分享**：`Settings.autoShare`（預設是，進階設定可關）。派車面板預先合成「假設已出發」的合成照片（醫院、出發、ETA；`usePreparedComposites`），按「出發」同一下呼叫 `systemShare(文字, 合成照片)`，選 LINE 一次送出；取消即不分享。
20. **照片二**：選用；照片一拍完後「📷 接著拍照片二」橘色閃動提醒。照片二說明（`personal.photo2Note`，可辨識細節）標在合成照片「照片二」列。只拍照片一也會合成。

21. **保密暨資通安全使用聲明**（`src/components/ConsentGate.tsx`、`src/security/consent.ts`）：全螢幕強制同意（使用者提供之聲明全文），必填真實姓名（`validName`）＋勾選同意才可進入；「不同意（離開）」連到 https://www.hcfd.gov.tw/（target=_top）。同一分頁內同意一次，重新開啟需再同意（姓名預填）。進入後全畫面斜向浮水印：姓名＋IP＋時間（演練時加【演練】）。IP 由瀏覽器查 api.ipify.org（GAS 看不到使用者 IP），查不到顯示「IP未取得」。`LogEntry.by` 記錄操作者，案件經過與 CSV 顯示。稽核 `audit()`：同意、查閱分頁、異動（每筆案件經過）、複製、分享、LINE、存到手機、匯出；本機留 500 筆，GAS 版批次送 `{audit}` 到 Code.gs `audit_` 寫入試算表（`setupAudit()` 建立，ID 在指令碼屬性 AUDIT_SHEET_ID）。標頭「正式／演練」連按兩下切換（`Incident.drill`，同步），回報與總結標題加【演練】。
    - 使用者選 (A)：聲明第 2 條後加「例外」段，LINE 分享為經權責長官核准之通報管道，僅限指定收治醫院或指揮群組；所有分享按鈕下方顯示 `ShareNotice` 提醒。
    - 同意畫面在 App 前顯示，自行套用日間／夜間主題（已實測兩種主題各頁面）。

22. **刪除所有演練案件**：歷史案件清單標示「演練」（`ArchiveRow.drill`／`isDrillArchive`），「🗑 刪除所有演練案件」按兩次：刪除所有演練存檔（含照片、合成照片），目前案件若為演練也直接清除且不存檔（store `deleteAllDrills`），寫入稽核。正式案件保留。
23. 第 7 項（姓名真偽驗證）使用者決定維持現狀（只檢查格式）。

24. **案件設定（開始前必填）**：事件頁最上方「案件設定」：真實事件／演練（`Incident.drill`，未選＝undefined）、案件名稱（`name`）、日期（`date`，預設今天）。`caseMissing` 未完成時「確認事件」停用，`startIncident` 回傳 false，新增傷患／車輛／大隊抵達等隱含開始也被擋；現場頁顯示「尚未建立案件」。名稱、日期、演練已加入同步欄位，交接 QR Code 加入者看到同一場事件。標頭顯示案件名稱與正式／演練（未選顯示「未設定」，開始後才可連按切換）。`caseTitle` 帶入回報、總結、通報醫院、發車分享（演練加【演練】）、合成照片（「案件」列，演練色塊加「演練｜」）、歷史案件標題。

25. **止血帶時間警示**（`src/engine/care.ts` `tourniquets`）：由「已上止血帶(HH:MM)」算經過分鐘（跨午夜處理），≥60 分橘色、≥120 分紅色。現場頁待送區「⏱ 止血帶」列（含運送中未抵院者）、病人代碼「TQ N′」、病人視窗、送醫進度未抵院趟次皆顯示。
26. **再評估計時**（`reassessDue`、`Patient.reassessedAt`、`Settings.reassessMin` 預設紅 15／黃 30／綠 60 分，進階設定可調）：自檢傷或上次再評估起算，逾時者列在現場頁「🩺 待再評估」，點一下記錄（病人紀錄與案件經過「紅1-A 再評估 HH:MM」）；病人代碼左上藍點；病人視窗顯示上次時間與倒數並可記錄。

27. **後送官畫面精簡（只做記錄與分配）**：再評估提醒預設關閉（`Settings.reassessOn`，進階設定可開）；現場頁移除止血帶大提醒（病人代碼仍有小字「TQ N′」）。現場頁順序：救護車 → 檢傷鍵 → 待送（受困、紅傷逾 10 分小字）→ 派車 → 已發車 → （再評估，若開啟）→ 黑牌區 → 大隊抵達 → 事件提醒。病人視窗順序：升級紅傷／ABCD／再檢傷 → 綠傷動作、除污 → 拍拍尺、照片 → 註解與交接註解 → 「🩹 創傷與處置、人形圖（交接用，選填）」預設收合 → 個案備註 → 止血帶／再評估 → 紀錄。

## 可再考慮

- 多人同步時，其他裝置收到「案件結束」不會自動存檔（只有按結束的裝置會存）。
- 照片只在拍照的手機上；如需跨裝置，需改存 Google Drive（GAS 端 DriveApp）。

## 慣例與防呆原則（使用者要求）

- 只做手機版；所有彈出視窗下方左「← 返回（不存檔）」、右「✔ 確認」，點視窗外等於確認（`Sheet` in `src/components/common.tsx`）。
- 回報、總結採條列式，沒有的項目不寫；交接註解用連接詞（併、與、及），見 `src/data/narrative.ts`。
- 創傷與處置規則：`src/data/trauma.ts`（傷勢資料）、`src/data/traumaRules.ts`（防呆）、`src/components/TraumaPicker.tsx`。紅黃各五個情境的回歸測試在 `src/data/scenarios.test.ts`（snapshot）。
- 案件經過不列標籤變動、車程查詢等系統紀錄。

## 建置與交付流程

```bash
npx tsc --noEmit -p . && npx vitest run      # 型別與測試（目前 132 項）
npm run build:gas                            # 產生 gas/index.html（GAS 單檔）
```

- 交付給使用者：傳送 `gas/index.html`（`gas/Code.gs` 有改時也要傳），請使用者貼到 GAS 後「部署 → 管理部署作業 → 編輯 → 新版本」。
- 手機預覽版（claude.ai Artifact）：`npx vite build --base ./ --outDir <暫存>/mobile-new`，把新的 `index-*.js/css`、`BodyMap-*.js` 放進 artifact 並更新 `app.html` 的檔名，再發布到同一個連結。
- 手機 e2e：Playwright（`devices['iPhone 13']`），`npx vite preview --port 4173`。
- commit 訊息結尾需加上本 session 規定的 Co-Authored-By 與 Claude-Session 兩行。
