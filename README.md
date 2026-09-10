# 大偈研習室

香港二級遊樂船操作人乙部（輪機知識）的繁體中文操題網站。

專案：`codex-pvoc2-mock-exam` — Mock Exam For HK PVOC 2 created by Codex。

- 180 題自編 MC；27 題對應海事處公開模擬卷的考點。
- 每題四個選項、答案、解釋、官方手冊印刷頁碼及 PDF 跳頁連結。
- 分類練習、10 題／20 題／全部、錯題重溫。
- 模擬考試隨機抽 40 題，45 分鐘，24 題合格；可修改答案、標記、跳題及提前交卷。
- 使用絕對截止時間；重新整理或切換分頁不會重設計時，到時交卷。
- 學習記錄只存於瀏覽器 localStorage，無帳戶、後端、追蹤碼或第三方字型依賴。
- 靜態網站約 106 KB；使用相對資產路徑，支援 GitHub Pages 的 repository 子路徑。

## 內容依據

1. [海事處考試手冊，2021 年 5 月版](https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/pvoc_guide_c.pdf)：主要技術依據，乙部第 16–23 節。
2. [海事處乙部公開模擬卷及答案](https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/PVOC_exam_B_c.pdf)：考點與題型依據。
3. [海事處考試規則，2025 年 6 月版](https://www.mardep.gov.hk/filemanager/tc/share/pub-services/pdf/examrules_ploc_c.pdf)：第 7.1 及 8.1 節。
4. [高峰考試指南，2026 年 9 月起適用](https://www.peak.edu.hk/exam/doc/md_ExamHandbook_chi_202609.pdf)：第 2.3–2.4 節。

核對日期：2026-09-10。技術事實、選項及解釋已按以上資料逐題審閱；程式驗證檢查結構完整性，不能取代內容審閱。正式試題和答案不公開，本站不是官方網站，也不保證命中原題。舊手冊的申請程序不作現行發證規則使用。機型相關操作以製造商規定為準。

## GitHub Pages 發佈

本 repository 已包含 `.github/workflows/pages.yml`，推送至 `main` 時會自動執行驗證及發佈。首次設定時，在 Settings → Pages → Build and deployment 將 Source 設為 **GitHub Actions**。

在 Actions 頁面查看 **Publish study site to GitHub Pages** 的執行結果；部署成功後，使用部署環境或 **Published URL** 步驟回傳的網址。
Workflow 會先驗證 180 題及執行評分／倒數測試，再把 `dist/` 部署到 Pages。只發佈 `dist/`，不會發佈內部部署設定或測試文件。網站不需要任何 secret 或 API key。

## 維護

題庫：`dist/questions.js`。每行順序為分類、手冊印刷頁、題幹、正確答案、三個干擾選項、解釋、可選官方樣本題號。載入時安排固定答案索引，每次練習再隨機排列顯示選項。修改題庫時須核對來源、避免多個合理答案並更新 `BANK_VERSION`；不要改動既有題目 ID 的指向。

驗證：

```sh
node scripts/validate.mjs
node --test tests/core.test.mjs
```

沒有 npm 依賴，毋須安裝套件。開發時以任一靜態 HTTP server 提供 `dist/`；直接開啟 `file://` 的 ES modules 可能被瀏覽器阻擋。

已完成：題庫結構、資產及模組連結、JavaScript 語法、9 項評分／倒數／狀態測試。未執行實體手機或瀏覽器視覺測試。可選 WebMCP 以功能偵測啟用；本環境未提供獲允許的支援情境作實際註冊驗證，正常操題不依賴它。
