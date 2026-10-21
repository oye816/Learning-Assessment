# 📚 星耀國中冒險學院｜遊戲化複習評量 ＆ 錯題煉金工坊
> **Learning-Assessment**：結合 Google Gemini Flash Lite 智慧出題、Google 帳號認證與全員學習進度監控的開源純前端評量系統。

[![Deploy to GitHub Pages](https://github.com/oye816/Learning-Assessment/actions/workflows/deploy.yml/badge.svg)](https://github.com/oye816/Learning-Assessment/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini%203.5%20Flash%20Lite-blue)](https://aistudio.google.com/)
[![Firebase](https://img.shields.io/badge/Backend-Serverless%20Firebase-orange)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind%20CSS-38bdf8)](https://tailwindcss.com/)

---

## 🤖 支援的 Gemini AI Flash Lite 系列模型

本專案支援 Google 最新世代的高敏捷、省流出題模型，使用者可自備 API Key（BYOK 模式）並於設定中自由切換：

1. **Gemini 3.5 Flash Lite (`gemini-3.5-flash-lite`)**：預設推薦首選，具備超高反應速度與精準的會考素養題型推理能力。
2. **Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite`)**：輕量穩定版本，適合各類標準單選題與公式變體生成。

---

## 🧠 純前端輕量化 RAG 向量題庫系統 (Client-side Vector RAG)

本專案採用創新的**純前端向量檢索增強生成 (Zero-Server Vector RAG)** 架構，無須架設外部向量資料庫伺服器（如 Pinecone 或 Milvus），即可在 GitHub Pages 上實現毫秒級語意檢索與智能防重複出題：

### 1. 核心組成與儲存位置
* **名校段考真題資料庫 ([`data/real_exam_questions.json`](file:///Users/po/WorkSpace/Git/Learning-Assessment/data/real_exam_questions.json) / [`js/real_exam_questions.js`](file:///Users/po/WorkSpace/Git/Learning-Assessment/js/real_exam_questions.js))**：
  * 依**「第一學期／第二學期」**與**「第 1／2／3 次段考」**通用維度分類（不綁定特定單一學年度），完整收錄新北升學名校（**海山國中、永和國中、福和國中**）等 **3,556 道**經純文字自給自足審查之高素養選擇題。
  * 支援全科覆蓋：自然 (702題)、國文 (700題)、數學 (405題)、英文 (490題)、社會 (1,259題)，涵蓋七 (1,425題)、八 (1,096題)、九 (1,035題) 全年級。
* **雙軌雲端題庫擴充 (Firebase Firestore `rag_custom_questions`)**：
  * 學生拍照上傳辨識之題目與 AI 弱點特訓題，自動雙向同步至雲端 Firestore，讓個人與群體題庫隨作答持續自發性豐富。
* **RAG 向量特徵庫與檢索引擎 ([`js/rag_engine.js`](file:///Users/po/WorkSpace/Git/Learning-Assessment/js/rag_engine.js))**：
  * 在瀏覽器端以純前端檢索比對學生錯題觀念，毫秒級提取 2 題最具代表性的台灣名校段考真題，作為 Gemini AI 延伸出題的 Few-Shot 範例錨點。

---

## 🐞 生題異常紀錄除錯與 AI 題目修正工作台 (Anomaly Logging & AI Repair)

為確保出題的高可靠度與持續擴充優良題型，系統建構了完整的「出題異常監控」與「AI 題目修正」正向學習閉環：

1. **🐞 生題異常自動捕捉與除錯中心 (Generation Anomaly Logger)**：
   * **全生命週期異常攔截**：全面捕捉出題過程中的異常事件（`network` 網路/金鑰連線、`json_parse` 格式錯誤、`schema_validation` 選項數量不足或答案超出 0~3 範圍、`generation` 模型空白回應）。
   * **完整除錯資訊留存**：每筆異常紀錄詳實記錄時間戳記、所選模型、出題模式、科目年級、錯誤具體原因、原始回傳文本（Raw Response）與瑕疵題目 JSON。
   * **本機快取與雲端同步**：本地端以 `localStorage` 保留最新 50 筆異常紀錄，支援「一鍵複製除錯 JSON」與「一鍵清空」；若已登入 Firebase 帳號，支援非同步同步至 Firestore `generation_anomalies` 集合以供跨端分析。
2. **🔧 AI 題目修正工作台 (AI-Assisted Question Repair & Refine)**：
   * **出題即時自我修復 (Self-Healing)**：在 AI 出題階段若偵測到格式瑕疵（如選項少於 4 個或缺少正確答案），系統自動在背景呼叫 `GeminiService.repairQuestion` 進行一次性精密修復，大幅降低出題失敗率。
   * **工作台手動精修**：每道題目卡片均提供「🔧 AI 修正」按鈕，使用者可點擊選擇「📐 補繪幾何/實驗圖 SVG」、「🎯 強化誘答項鑑別度」、「🧮 數學符號自然化」或輸入自訂指示，由 AI 重新潤飾校正為標準題目。
3. **📥 修復與新題型即刻納入 RAG 典範庫 (RAG Exemplar Expansion)**：
   * 題目經 AI 修復完成，或使用者在試題包中點擊「📥 納入 RAG」，題目將自動登錄至 `RagEngine` 並即時計算 768 維語義向量特徵。
   * 該題型日後將作為 **Few-Shot 真題典範** 提供給 Gemini 參考，形成「**生題 → 異常捕捉 → AI 修復 → 納入 RAG 典範庫 → 日後出題參考此題型**」的正向強化學習閉環！

---

## 🎯 名校段考全真出題中心 (依第一/第二學期、第一/二/三次段考分類)

首頁冒險大廳提供多維度的專屬段考分類出題中心：
1. **學期與段考自由切換**：
   * **學期維度**：📘 第一學期（上學期） / 📙 第二學期（下學期）
   * **段考次數**：🥇 第一次段考 / 🥈 第二次段考 / 🥉 第三次段考（期末考）
   * **年級範圍**：全部年級 / 七年級 / 八年級 / 九年級
2. **五科分科段考卷**：即時統計目前所選段考之國、英、數、自、社真題庫數量，點擊直接出 5 題全真段考挑戰。
3. **52+ 核心考點特訓**：動態依所選段考抽取字音辨析、文言文、因數倍數、進行式、臺灣史與公民生活等考點標籤，點選單一考點立即組成精準靶向測驗。
4. **不足自動 RAG 補齊**：若特定單科或特定考點題目不足 5 題，系統會自動啟動 RAG 向量語意檢索，自整體題庫中抓取考點最相符的題目補足 5 題。
5. **防重複記憶機制**：結合近期做題記憶，避免同一次段考複習中反覆出現相同題目。

---

## 🛡️ 純文字自給自足防護 ＆ 📐 智慧幾何/實驗向量繪圖 (SVG)

系統在題庫管理、AI 出題與測驗互動全面落實「自給自足」防護，並具備強大的 AI 向量繪圖能力：

1. **🎨 智慧幾何與實驗圖形向量繪製 (SVG 支援)**：
   * 當 Gemini AI 出題情境涉及**數學幾何**（直角坐標系、相似三角形、圓形弦心距）或**自然科學實驗**（電路開關、浮力天平、滑輪槓桿、凸透鏡成像光路、地層構造）時，會在題目中自動輸出標準 `diagramSvg` 向量代碼。
   * 前端內建安全過濾器（`renderSafeSvg`），徹底清洗 `<script>`、`<iframe>`、`on*` 惡意事件屬性，包裝為自適應深色科技卡片。
   * **不依賴外部圖床或圖片空間**，手機與電腦螢幕 100% 清晰無損縮放，作答大廳、AI 弱點出題、錯題本與成績明細均可完整回顧。
2. **全面排除「缺圖題」與「音檔依賴題」**：
   * 國中試卷中若依賴外部掃描紙本插圖、聽力測驗（需外接播音設備）或未附短文之閱讀題組，在無外部多媒體支援下會導致學生無法作答。
   * **抽題動態放行**：純文字題經 `isSelfContainedTextQuestion` 正則篩查；若題目已自帶 AI 向量 `diagramSvg` 繪圖，則自動放行「如下圖所示」之圖文題目！
3. **🔊 Web Speech API 原生英文語音朗讀**：
   * 英文科題目在右上角自動顯示「🔊 朗讀英文 / ⏹️ 停止」功能，採用瀏覽器原生語音合成技術（`en-US`），無須下載肥大音檔。
4. **📐 人類直觀數學排版**：
   * 自動轉換裸露 LaTeX 標記為人類直觀排版（如 `x / 0.8 - 150`、乘號 `×`、除號 `÷`、平方 `x²`、根號 `√` 等）。

---

## 🛠️ 新增與擴充題庫指南 (Question Bank Ingestion)

當學校釋出新學期段考試題或加入新學校試卷時，**無須重新執行整個題庫，支援快速增量截取**：

### 1. 試卷原始檔存放
* 將 PDF/Word 放置於 `題庫/<學校名>/114/<年級>/` 資料夾中（此資料夾已設定於 `.gitignore`，不會上傳至 Git）。

### 2. 執行題庫萃取工具（支援增量或全量）
系統腳本具備**「題幹唯一識別與自動去重機制」**，既有 3,556 題會完整保留，僅將新題目追加進庫：

* **方法 A：針對「新增的特定學校」快速增量截取（最推薦・僅需數秒）**：
  ```bash
  # 僅增量解析海山國中新試卷並追加進庫
  ./.venv/bin/python scripts/batch_extract_all_exams.py --school haishan

  # 僅增量解析福和國中新試卷
  ./.venv/bin/python scripts/batch_extract_all_exams.py --school fuhe

  # 僅增量解析永和國中新試卷
  ./.venv/bin/python scripts/batch_extract_all_exams.py --school yonghe
  ```

* **方法 B：全量掃描所有學校試卷（預設亦為增量保護模式）**：
  ```bash
  ./.venv/bin/python scripts/batch_extract_all_exams.py
  ```
  腳本會掃描全部學校資料夾，已存在的題目自動略過，新題目無縫併入。

* **方法 C：強制清空並重新構建全題庫（僅在修改正則清洗邏輯時使用）**：
  ```bash
  ./.venv/bin/python scripts/batch_extract_all_exams.py --clean
  ```

系統執行完成後，會自動更新 `data/real_exam_questions.json` 與 `js/real_exam_questions.js`，網頁端重新整理即刻生效！

---

## 💻 本機開發與測試指南 (Local Development & Testing)

本專案採用現代原生 ES Modules (`type="module"`) 架構，因瀏覽器安全性（CORS）限制，不可直接雙擊以 `file://` 開啟，需透過本機 HTTP 靜態伺服器運行測試。

### 1. 快速啟動本機伺服器（擇一即可）

* **方法 A：使用 Node.js（推薦，零配置）**
  ```bash
  npx --yes serve -l 8000 .
  ```
* **方法 B：使用 Python 內建伺服器**
  ```bash
  # 建議建立或進入虛擬環境後執行
  python3 -m venv venv && source venv/bin/activate
  python3 -m http.server 8000
  ```
* **方法 C：VS Code / Cursor 編輯器**
  安裝 `Live Server` 擴充套件後，在 `index.html` 按右鍵點選「**Open with Live Server**」即可。

---

### 2. 開啟測試與環境標題識別

啟動後，請以瀏覽器開啟 [http://localhost:8000/](http://localhost:8000/) 或 [http://127.0.0.1:8000/](http://127.0.0.1:8000/)：

* 🏷️ **環境動態標題**：
  * **本機測試**：瀏覽器分頁標題會自動加上 **`(本機) `** 前綴（例：`(本機) 星耀國中冒險學院...`）。
  * **線上運行**：發布至 GitHub Pages 後，標題會自動切換為 **`(Github) `** 前綴。
* 🔐 **Google 登入測試**：Firebase Authentication 預設已授權 `localhost` 網域，本機即可完整進行 Google 登入、儲存評量紀錄與 AI 出題實測。

---

## 🚀 GitHub Pages 3 分鐘直接部署教學 (Zero-Backend)

本專案採用純前端靜態架構，已內建 `.github/workflows/deploy.yml` 自動化部屬工作流，**推上 GitHub 即可自動上線**！

### 步驟 1：啟動 GitHub Pages 自動部屬
1. 進入您的 GitHub 倉庫：`https://github.com/oye816/Learning-Assessment`。
2. 點選上方頁籤 **Settings**（設定）> 左側選單 **Pages**。
3. 在 **Build and deployment** 區塊：
   - **Source** 選擇 **GitHub Actions**（系統會自動使用內建的自動發布流程）。
4. 稍等約 1 分鐘，GitHub Actions 完成打包後，頁面頂端即會顯示您的專屬網站網址：  
   `https://<你的GitHub帳號>.github.io/Learning-Assessment/`

---

### 步驟 2：設定 Firebase（啟用 Google 登入與雲端學習紀錄）
1. 前往 [Firebase Console](https://console.firebase.google.com/) 免費新增專案。
2. **啟用 Google 登入**：
   - 點選左側「**Authentication**」>「Sign-in method」，啟用 **Google** 供應商。
3. **⚠️ 關鍵必做：新增 GitHub Pages 授權網域**：
   - 在「**Authentication**」> 切換到「**設定 (Settings)**」頁籤。
   - 找到「**已授權網域 (Authorized domains)**」，點擊「新增網域」。
   - 輸入您的 GitHub 網域：`oye816.github.io`（若是其他帳號請輸入該帳號的 `<username>.github.io`）。
4. **建立 Firestore 雲端資料庫**：
   - 點選左側「**Firestore Database**」>「建立資料庫」。
   - 切換到「**規則 (Rules)**」頁籤，將本專案的 `firestore.rules` 內容貼入並發布（保障學員資料隔離，防竄改且賦予管理員權限）。
5. **取得 Web App 憑證**：
   - 進入「專案設定」>「一般」>「您的應用程式」，新增網頁 App 即可取得 `firebaseConfig` 物件。

---

### 步驟 3：在網頁上啟用設定

1. 打開您的網站網址。
2. 點擊右上角「**🤖 AI 金鑰**」打開設定視窗：
   - **Gemini AI 出題**：貼上您的 [Google AI Studio API Key](https://aistudio.google.com/)，並可切換 Gemini 3.5 / 3.1 Flash Lite 模型。
   - **Firebase 與 Google 登入**：直接貼上 Firebase Config JSON，並填寫您的管理員 Google 信箱，點擊儲存即可！
   - 登入後可隨時點選姓名旁的 **`👑 設為管理員`** 一鍵解鎖「👑 導師管理後台」。

---

## 📄 授權條款 (License)
本專案採用 [MIT License](LICENSE) 開源授權。
