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
3. **Gemini 2.5 Flash Lite (`gemini-2.5-flash-lite`)**：經典輕量級架構模型，高相容度與高性價比。

---

## 🧠 純前端輕量化 RAG 向量題庫系統 (Client-side Vector RAG)

本專案採用創新的**純前端向量檢索增強生成 (Zero-Server Vector RAG)** 架構，無須架設外部向量資料庫伺服器（如 Pinecone 或 Milvus），即可在 GitHub Pages 上實現毫秒級語意檢索與智能防重複出題：

### 1. 核心組成與儲存位置
* **RAG 向量特徵庫 ([`js/question_embeddings.js`](file:///Users/po/WorkSpace/Git/Learning-Assessment/js/question_embeddings.js))**：
  * 收錄 **383 道**（含 368 題名校真題 + 15 題核心基礎題）的 **768 維**高維度正規化語意向量。
  * 由 Google Gemini `gemini-embedding-2` 模型離線計算，網頁載入後由 [`js/rag_engine.js`](file:///Users/po/WorkSpace/Git/Learning-Assessment/js/rag_engine.js) 在瀏覽器記憶體內以**餘弦相似度 (Cosine Similarity)** 進行 0.01 秒等級的極速相似考點檢索。
* **名校段考真題資料庫 ([`data/real_exam_questions.json`](file:///Users/po/WorkSpace/Git/Learning-Assessment/data/real_exam_questions.json) / [`js/real_exam_questions.js`](file:///Users/po/WorkSpace/Git/Learning-Assessment/js/real_exam_questions.js))**：
  * 依**「第一學期／第二學期」**與**「第 1／2／3 次段考」**通用維度分類（不綁定特定單一學年度），收錄新北升學名校（**海山國中、永和國中、福和國中**）等 **368 道**經純文字自給自足審查（100% 排除看圖題、聽力題、缺短文閱讀題組與承上題依賴題）之高素養選擇題。
  * 支援全科覆蓋：國文、英文、數學、自然（生物/理化）、社會（歷史/地理/公民）。
* **向量運算快取 (`scripts/embeddings_cache.json`)**：
  * 本地運算快取（已受 `.gitignore` 排除），記錄 `考題文本 -> 768維向量`。新增題目時只對新題調用 API，已存在題目 **0ms 立即命中**，杜絕重複消耗 API 與撞頻率限制。

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

## 🛡️ 純文字自給自足試題防護 ＆ 語音朗讀輔助 (Self-Sufficiency & TTS)

為了提供最流暢的純前端自主評量體驗，系統在題庫管理、AI 出題與測驗互動全面落實「自給自足」防護準則：

1. **全面排除「看圖題」與「音檔依賴題」**：
   * 國中試卷中常見的**聽力測驗**（需外接考場播音設備）、**地圖代號題**（如依據附圖甲乙丙丁位置）、**實驗附圖題**以及**未附短文之閱讀題組**，在無外部多媒體支援下會導致學生無法作答。
   * **題庫深度清洗**：所有題庫真題均經過自動與人工雙重篩查，剔除所有圖文依賴題，確保 100% 純文字可解。
   * **Gemini 出題提示詞約束**：嚴格禁止 AI 產生指涉不存在圖表之題目，實驗題與幾何題強制要求純文字定義與條件完整化。
   * **前端抽題雙重安全防禦**：抽題時透過 `isSelfContainedTextQuestion` 正則檢驗，杜絕任何潛在圖文或聽力題目流至作答介面。
2. **🔊 Web Speech API 原生英文語音朗讀**：
   * 英文科題目在右上角自動顯示「🔊 朗讀英文 / ⏹️ 停止」功能。
   * 採用瀏覽器原生語音合成技術（`en-US`），無須下載肥大音檔或額外 API 費用，兼顧發音聆聽與單字語法學習。
3. **📐 人類直觀數學排版**：
   * 全面淘汰在純文字介面難以閱讀的裸露 LaTeX 標記（如 `$\frac{x}{0.8}-150$`）。
   * 自動轉換為人類一目了然的直觀排版（如 `x / 0.8 - 150`、乘號 `×`、除號 `÷`、平方 `x²`、根號 `√` 等）。


---

## 🛠️ 新增與擴充題庫指南 (Question Bank Ingestion)

若欲加入新學校試卷或新學期段考試題：

1. **試卷原始檔存放**：
   * 將 PDF/Word 放置於 `題庫/<學校名>/114/<年級>/` 資料夾中（此資料夾已設定於 `.gitignore`，不會上傳至 Git）。
2. **自動萃取題目與解答**：
   * 執行專屬解析腳本（例如海山國中真題萃取器）：
     ```bash
     source .venv/bin/activate
     python3 scripts/extract_haishan.py
     ```
   * 系統會自動過濾圖表與聽力依賴題，生成結構化 JSON 並合併入 `data/real_exam_questions.json` 與 `js/real_exam_questions.js`。
3. **生成 RAG 語義特徵向量**：
   * 執行向量化批次工具：
     ```bash
     source .venv/bin/activate
     python3 scripts/generate_embeddings.py
     ```
   * 腳本將自動讀取快取並計算新增考題的 768 維語意向量，自動輸出最新之 `js/question_embeddings.js`。

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
   - **Gemini AI 出題**：貼上您的 [Google AI Studio API Key](https://aistudio.google.com/)，並可切換 Gemini 3.5 / 3.1 / 2.5 Flash Lite 模型。
   - **Firebase 與 Google 登入**：直接貼上 Firebase Config JSON，並填寫您的管理員 Google 信箱，點擊儲存即可！
   - 登入後可隨時點選姓名旁的 **`👑 設為管理員`** 一鍵解鎖「👑 導師管理後台」。

---

## 📄 授權條款 (License)
本專案採用 [MIT License](LICENSE) 開源授權。
