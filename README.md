# 📚 星耀國中冒險學院｜遊戲化複習評量 ＆ 錯題煉金工坊
> **Learning-Assessment**：結合 Google Gemini 1.5 智慧出題、Google 帳號認證與全員學習進度監控的開源純前端評量系統。

[![Deploy to GitHub Pages](https://github.com/oye816/Learning-Assessment/actions/workflows/deploy.yml/badge.svg)](https://github.com/oye816/Learning-Assessment/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini%201.5%20Flash-blue)](https://aistudio.google.com/)
[![Firebase](https://img.shields.io/badge/Backend-Serverless%20Firebase-orange)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind%20CSS-38bdf8)](https://tailwindcss.com/)

---

## 🚀 GitHub Pages 3 分鐘直接部署教學 (Zero-Backend)

本專案採用純前端靜態架構，已內建 `.github/workflows/deploy.yml` 自動化部屬工作流，**推上 GitHub 即可自動上線**！

### 步驟 1：啟動 GitHub Pages 自動部屬
1. 進入您的 GitHub 倉庫：`https://github.com/oye816/Learning-Assessment`。
2. 點選上方頁籤 **Settings**（設定）> 左側選單 **Pages**。
3. 在 **Build and deployment** 區塊：
   - **Source** 選擇 **GitHub Actions**（推薦，系統會自動使用內建的自動發布流程）。
   - *（或選擇 Deploy from a branch：Branch 選 `main`，資料夾選 `/ (root)` 後點選 Save）*。
4. 稍等約 1 分鐘，GitHub 就會自動完成部屬，並在 Pages 頁面顯示您的專屬網站網址：  
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

### 步驟 3：在 GitHub Pages 上啟用 Firebase（兩種方式任選）

#### 方式 A：免 commit 憑證，直接在網頁介面貼上（推薦）
1. 打開您的 GitHub Pages 網址。
2. 點擊右上角「**🤖 AI 金鑰**」打開設定視窗，切換至「**☁️ Firebase 與 Google 登入**」。
3. 直接貼上 Firebase Config JSON，並填寫您的管理員 Google 信箱，點擊儲存即可！
4. 設定會安全保存在該瀏覽器的 `localStorage` 中，適合任何人 Fork 後直接使用。

#### 方式 B：將設定檔納入倉庫全域預設
1. 將本專案根目錄的 `config.example.js` 複製一份並命名為 `config.js`。
2. 填入您的 Firebase 設定與管理員信箱後，commit 推送至 GitHub `main` 分支。
3. GitHub Actions 會自動重新打包發布，所有造訪者皆能共用該學校/班級的 Firebase 雲端資料庫！

---

## ✨ 系統功能簡介

1. **🤖 Gemini AI 智慧出題（BYOK 模式）**：
   - 使用者在右上角輸入個人的 [Google AI Studio API Key](https://aistudio.google.com/)。
   - 在「錯題煉金工坊」點擊「**🤖 啟動 Gemini AI 魔法生題**」，調用 Gemini 1.5 Flash 即時分析弱點並出題。
2. **🔐 個人學習歷程**：
   - 點擊「Google 登入」後，所有地下城評量與 Boss 戰績自動存入雲端 Firestore。
   - 於「📜 我的學習歷程」分頁查閱歷史答題曲線、得分與等級。
3. **👑 導師管理後台**：
   - 指定的 Google 管理員帳號登入後自動解鎖「👑 導師管理後台」。
   - 提供全校大數據分析、學員作答明細調閱、以及一鍵匯出 CSV 報表。

---

## 📄 授權條款 (License)
本專案採用 [MIT License](LICENSE) 開源授權。
