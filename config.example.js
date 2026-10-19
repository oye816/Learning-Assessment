// ==============================================================================
// 星耀國中冒險學院｜開源設定檔範本 (config.example.js)
// 
// 使用方式：
// 1. 請將此檔案複製一份並命名為 config.js（此檔案已被加入 .gitignore，不會被 commit 到 GitHub）
// 2. 至 Firebase Console (https://console.firebase.google.com/) 免費建立專案：
//    - 在「Authentication」中啟用「Google」登入供應商
//    - 在「Firestore Database」建立資料庫（可選擇測試模式或套用 firestore.rules）
//    - 在「專案設定」中新增網頁應用程式，複製 Firebase SDK 設定填入下方 firebase 物件
// 3. 在 adminEmails 陣列中填入管理者的 Google 信箱
// 4. (選填) 若希望為所有人提供預設的 Gemini API Key，可填入 defaultGeminiApiKey
// ==============================================================================

export const CONFIG = {
  // 1. Firebase 專案憑證設定
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
  },

  // 2. 管理者 Google 帳號清單 (這些帳號登入後將自動解鎖「👑 導師管理後台」)
  adminEmails: [
    "admin@gmail.com",
    "teacher@example.com"
  ],

  // 3. 預設 Gemini API Key (可選填。若留空，使用者可於網頁右上角「🤖 AI 金鑰」自行輸入自己的免費 Key)
  defaultGeminiApiKey: ""
};
