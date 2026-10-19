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
