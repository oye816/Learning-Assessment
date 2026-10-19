// ==============================================================================
// 星耀國中冒險學院｜Firebase 認證與雲端評量儲存服務 (js/firebase.js)
// 
// 提供 Google OAuth 2.0 登入、個人學習歷程持久化儲存、以及管理者全員監控。
// 具備極致可靠性：支援本機快取立即渲染、持久化 Session、主動廣播認證狀態。
// ==============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc,
  setDoc,
  getDoc,
  query, 
  where, 
  orderBy, 
  getDocs, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 設定容器
let APP_CONFIG = {
  firebase: { apiKey: "" },
  adminEmails: [],
  defaultGeminiApiKey: ""
};

// 1. 嘗試從 config.js 載入
try {
  const configModule = await import("../config.js");
  if (configModule && configModule.CONFIG) {
    APP_CONFIG = Object.assign({}, configModule.CONFIG);
  }
} catch (e) {
  console.warn("⚠️ 未找到 config.js，檢查瀏覽器本機自訂設定。");
}

// 2. 檢查 localStorage 中的自訂 Firebase 與管理者設定
try {
  const customStr = localStorage.getItem('jh_quest_custom_firebase_config');
  if (customStr) {
    const customConfig = JSON.parse(customStr);
    if (customConfig.firebase && customConfig.firebase.apiKey) {
      APP_CONFIG.firebase = customConfig.firebase;
    }
    if (customConfig.adminEmails && Array.isArray(customConfig.adminEmails)) {
      APP_CONFIG.adminEmails = Array.from(new Set([...(APP_CONFIG.adminEmails || []), ...customConfig.adminEmails]));
    }
    if (customConfig.defaultGeminiApiKey) {
      APP_CONFIG.defaultGeminiApiKey = customConfig.defaultGeminiApiKey;
    }
  }
} catch (e) {
  console.warn("讀取本機自訂 Firebase 設定失敗:", e);
}

// 3. 載入本機額外授權的管理者名單
try {
  const localAdmins = JSON.parse(localStorage.getItem('jh_quest_admin_emails') || '[]');
  if (Array.isArray(localAdmins) && localAdmins.length > 0) {
    APP_CONFIG.adminEmails = Array.from(new Set([...(APP_CONFIG.adminEmails || []), ...localAdmins]));
  }
} catch (e) {
  console.warn("讀取本機管理者名單失敗:", e);
}

window.APP_CONFIG = APP_CONFIG;

let app = null;
let auth = null;
let db = null;
const googleProvider = new GoogleAuthProvider();

export function isFirebaseConfigured() {
  return !!(
    APP_CONFIG.firebase &&
    APP_CONFIG.firebase.apiKey &&
    APP_CONFIG.firebase.apiKey !== "YOUR_FIREBASE_API_KEY" &&
    APP_CONFIG.firebase.projectId
  );
}

function initFirebase() {
  if (isFirebaseConfigured() && !app) {
    try {
      app = initializeApp(APP_CONFIG.firebase);
      auth = getAuth(app);
      db = getFirestore(app);

      // 強制開啟本機持久化保持登入狀態
      setPersistence(auth, browserLocalPersistence).catch(err => {
        console.warn("Firebase setPersistence 警告:", err);
      });

      console.log("✅ Firebase 雲端服務初始化成功！");

      // 監聽 Auth 變化並主動更新快取與廣播
      onAuthStateChanged(auth, async (user) => {
        const admin = FirebaseService.isAdmin(user);
        if (user) {
          localStorage.setItem('jh_quest_cached_user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || '',
            isAdmin: admin
          }));
        } else {
          localStorage.removeItem('jh_quest_cached_user');
        }

        if (window.onFirebaseUserChange) {
          window.onFirebaseUserChange(user, admin);
        }
        window.dispatchEvent(new CustomEvent('firebase-auth-changed', { detail: { user, isAdmin: admin } }));
      });
    } catch (err) {
      console.error("Firebase 初始化失敗:", err);
    }
  }
}

initFirebase();

export class FirebaseService {
  static isAvailable() {
    return isFirebaseConfigured() && !!auth && !!db;
  }

  static getConfig() {
    return APP_CONFIG;
  }

  static saveCustomConfig(customFirebase, adminEmailsList) {
    const configToSave = {
      firebase: customFirebase,
      adminEmails: adminEmailsList
    };
    localStorage.setItem('jh_quest_custom_firebase_config', JSON.stringify(configToSave));
    APP_CONFIG.firebase = customFirebase;
    APP_CONFIG.adminEmails = adminEmailsList;
    window.APP_CONFIG = APP_CONFIG;
    initFirebase();
  }

  /**
   * 授權特定信箱為管理員
   */
  static grantAdmin(email) {
    if (!email) return;
    const cleaned = email.toLowerCase().trim();
    const localAdmins = JSON.parse(localStorage.getItem('jh_quest_admin_emails') || '[]');
    if (!localAdmins.includes(cleaned)) {
      localAdmins.push(cleaned);
      localStorage.setItem('jh_quest_admin_emails', JSON.stringify(localAdmins));
    }
    if (!APP_CONFIG.adminEmails.map(e => e.toLowerCase().trim()).includes(cleaned)) {
      APP_CONFIG.adminEmails.push(cleaned);
    }
  }

  static isAdmin(user) {
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase().trim();
    
    // 檢查 APP_CONFIG
    const adminList = (APP_CONFIG.adminEmails || []).map(e => e.toLowerCase().trim());
    if (adminList.includes(email)) return true;

    // 檢查 localStorage
    try {
      const localAdmins = JSON.parse(localStorage.getItem('jh_quest_admin_emails') || '[]');
      if (localAdmins.map(e => e.toLowerCase().trim()).includes(email)) return true;
    } catch (e) {}

    return false;
  }

  /**
   * 執行 Google 彈窗登入
   */
  static async loginWithGoogle() {
    if (!this.isAvailable()) {
      throw new Error("尚未設定 Firebase 憑證！請於右上角「系統設定」中填入 Firebase Config，或於專案中設定 config.js。");
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const admin = this.isAdmin(user);

      // 即時快取使用者，防止非同步監聽器延遲
      localStorage.setItem('jh_quest_cached_user', JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL || '',
        isAdmin: admin
      }));

      // 即刻通知前端更新狀態
      if (window.onFirebaseUserChange) {
        window.onFirebaseUserChange(user, admin);
      }
      window.dispatchEvent(new CustomEvent('firebase-auth-changed', { detail: { user, isAdmin: admin } }));

      return user;
    } catch (err) {
      if (err.code === 'auth/unauthorized-domain') {
        throw new Error(`Google 登入失敗：當前網域 (${window.location.hostname}) 尚未加入 Firebase 的「已授權網域」清單！請至 Firebase Console -> Authentication -> Settings -> Authorized domains 新增。`);
      }
      throw err;
    }
  }

  static async logout() {
    localStorage.removeItem('jh_quest_cached_user');
    if (!this.isAvailable()) {
      if (window.onFirebaseUserChange) window.onFirebaseUserChange(null, false);
      return;
    }
    await signOut(auth);
    if (window.onFirebaseUserChange) window.onFirebaseUserChange(null, false);
  }

  static onUserChange(callback) {
    if (!this.isAvailable()) {
      // 嘗試讀取本地快取
      const cached = localStorage.getItem('jh_quest_cached_user');
      if (cached) {
        try {
          const u = JSON.parse(cached);
          callback(u, u.isAdmin);
        } catch (e) {
          callback(null, false);
        }
      } else {
        callback(null, false);
      }
      return () => {};
    }
    return onAuthStateChanged(auth, (user) => {
      const admin = this.isAdmin(user);
      callback(user, admin);
    });
  }

  /**
   * 儲存測驗評量紀錄
   */
  static async saveAssessmentRecord(user, recordData) {
    const record = {
      userId: user ? user.uid : 'guest',
      userEmail: user ? user.email : '未登入勇者',
      userName: user ? (user.displayName || user.email) : '訪客勇者',
      userPhoto: user ? (user.photoURL || '') : '',
      title: recordData.title || '一般試煉',
      subject: recordData.subject || 'all',
      score: recordData.score || 0,
      total: recordData.total || 0,
      accuracy: recordData.accuracy || 0,
      rank: recordData.rank || 'B',
      expEarned: recordData.expEarned || 0,
      goldEarned: recordData.goldEarned || 0,
      createdAtDate: new Date().toISOString(),
      details: recordData.details || []
    };

    if (!user) {
      const localHistory = JSON.parse(localStorage.getItem('jh_quest_local_history') || '[]');
      localHistory.unshift(record);
      if (localHistory.length > 50) localHistory.pop();
      localStorage.setItem('jh_quest_local_history', JSON.stringify(localHistory));
      return record;
    }

    if (this.isAvailable() && user) {
      try {
        const docRef = await addDoc(collection(db, "assessment_records"), {
          userId: user.uid,
          userEmail: user.email,
          userName: user.displayName || user.email,
          userPhoto: user.photoURL || "",
          title: recordData.title,
          subject: recordData.subject,
          score: recordData.score,
          total: recordData.total,
          accuracy: recordData.accuracy,
          rank: recordData.rank,
          expEarned: recordData.expEarned,
          goldEarned: recordData.goldEarned,
          details: recordData.details || [],
          createdAt: serverTimestamp()
        });
        record.id = docRef.id;
      } catch (err) {
        console.error("雲端存檔失敗:", err);
      }
    }
    return record;
  }

  /**
   * 取得使用者的歷史評量紀錄 (嚴格資料隔離：新使用者為空陣列)
   */
  static async getMyRecords(user) {
    if (!user) {
      return JSON.parse(localStorage.getItem('jh_quest_local_history') || '[]');
    }

    if (!this.isAvailable()) {
      return [];
    }

    try {
      const q = query(
        collection(db, "assessment_records"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        return [];
      }
      return snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          createdAtDate: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString()
        };
      });
    } catch (err) {
      console.warn("無法從雲端讀取歷史紀錄:", err);
      return [];
    }
  }

  /**
   * 管理者取得所有學員的評量紀錄
   */
  static async getAllRecords(adminUser) {
    if (!this.isAvailable()) {
      throw new Error("尚未設定 Firebase 資料庫！請在系統設定中設定 Firebase。");
    }
    if (!this.isAdmin(adminUser)) {
      throw new Error("權限拒絕：僅管理者 Google 帳號可存取全員學習紀錄！");
    }

    const q = query(
      collection(db, "assessment_records"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        createdAtDate: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString()
      };
    });
  }

  /**
   * 同步勇者狀態至雲端 (等級、經驗、星幣、魔導書)
   */
  static async syncUserProfile(user, playerState) {
    if (!this.isAvailable() || !user) return;
    try {
      await setDoc(doc(db, "user_profiles", user.uid), {
        email: user.email,
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        player: playerState.player,
        mistakes: playerState.mistakes || [],
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("同步個人勇者狀態失敗:", e);
    }
  }

  /**
   * 自雲端還原勇者狀態
   */
  static async loadUserProfile(user) {
    if (!this.isAvailable() || !user) return null;
    try {
      const docSnap = await getDoc(doc(db, "user_profiles", user.uid));
      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (e) {
      console.warn("讀取雲端勇者狀態失敗:", e);
    }
    return null;
  }
}

// 掛載至 window
window.FirebaseService = FirebaseService;

// 觸發模組就緒事件
window.dispatchEvent(new CustomEvent('firebase-service-ready'));
