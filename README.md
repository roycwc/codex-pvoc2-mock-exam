# 大偈研習室

[公開操題網站](https://roycwc.github.io/codex-pvoc2-mock-exam/) · 香港二級遊樂船操作人甲乙部 MC。

專案：`codex-pvoc2-mock-exam` — Mock Exam For HK PVOC 2 created by Codex。

- **360 題**：甲部航駛、船藝及安全 180 題；乙部輪機知識 180 題。
- 每題有四個選項、答案、解釋和官方手冊實際頁碼；43 題另連結到相同知識點的公開官方樣本題號。
- 航海計算、潮汐水深、避碰規則、VHF、浮標、氣象、應變及輪機；13 個原創 SVG 識別圖。
- 可選甲部、乙部或全題庫，按考點練習 10／20／全部題目；錯題重溫及本機學習記錄。
- 模擬甲部、乙部或甲乙雙卷。每卷 **40 題、45 分鐘、24 題合格**，雙卷共 80 題，兩卷須分別合格。
- 甲部交卷即鎖定，乙部須另外按開始；兩卷時間不共用，卷間休息不算考試用時。雙卷完成後才顯示答案。
- 可改答、標記、跳題；到時提交當前一卷。刷新和背景分頁依原截止時間繼續，關閉分頁不會提早啟動未開始的乙部。
- 無帳戶、後端、追蹤碼或套件依賴，記錄留在 localStorage；手機響應式版面。相對資產路徑可直接部署至 GitHub Pages 子路徑。

## 官方依據

1. [海事處考試手冊，2021 年 5 月版](https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/pvoc_guide_c.pdf)：甲、乙部知識與逐題頁碼。
2. [甲部公開模擬卷](https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/PVOC_exam_A_c.pdf)及[乙部公開模擬卷](https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/PVOC_exam_B_c.pdf)：題型、考點及卷末答案。
3. [海事處考試規則，2025 年 6 月版](https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/examrules_ploc_c.pdf)：第 7.1 節的形式，第 8.1 節的完整甲乙部考綱。
4. [高峰考試指南，2026 年 9 月起適用](https://www.peak.edu.hk/exam/doc/md_ExamHandbook_chi_202609.pdf)：第 2.3–2.4 節，每部獨立計時及合格；兩部須於兩年內通過。

核對日期：2026-09-10。雙卷是網站連續練習安排，正式考試可分開報考；本站沒有聲稱官方是一份合計評分的 80 題卷。每卷覆蓋各大範疇，再隨機抽餘下題目，比例不是官方配額。

所有題目為自編，並非未公開真題，不能保證命中原題。舊手冊的法例罰款、機場管制區邊界、部分器材配備數量未確立現行依據者未出題；涵蓋大範疇不代表窮盡全部細項。機型相關數值及操作依製造商要求。內容取捨見 [CONTENT_REVIEW.md](CONTENT_REVIEW.md)。

## 發佈及維護

GitHub Actions 在 main 推送後執行驗證，通過後發佈 `dist/`。Pages Source 已設定為 GitHub Actions，網站不需 secrets。部署網址由工作流程的 Published URL 步驟輸出。

題目資料分成 `dist/questions-a.js` 及 `dist/questions-b.js`。每行：分類、手冊印刷頁、題幹、正確答案、三個干擾選項、解釋、可選同部官方樣本題號。`questions.js` 定義來源與分類，並合併題庫。ID 按部及行次固定；修訂不應插行而改變既有 ID 的知識點。

`core.js` 管理分卷抽題、時間、鎖卷、驗證與評分；`app.js` 為互動介面；`diagrams.js` 為精確符號示意。改題後更新 BANK_VERSION，使舊未完成試卷失效，完成的進度與歷史仍保留。

```sh
node scripts/validate.mjs
node --test tests/core.test.mjs
```

驗證包括 360 題結構、來源頁碼、資產／模組／JavaScript 語法，以及 13 項計時、分卷、答題、合格線及狀態測試。測試不代替內容查核。未執行實體手機或瀏覽器視覺測試。可選 WebMCP 採功能偵測，網站不依賴它。
