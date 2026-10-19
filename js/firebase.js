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
          FirebaseService.syncUnsyncedLocalRecords(user).catch(() => {});
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
   * 精準去重演算法：多層級檢查 ID、雲端 DocID 與內容特徵指紋
   */
  static deduplicateRecords(records) {
    if (!Array.isArray(records) || records.length === 0) return [];
    
    const result = [];
    for (const record of records) {
      if (!record) continue;
      
      const recTime = record.createdAtDate ? new Date(record.createdAtDate).getTime() : 0;
      const recId = record.clientRecordId || record.recordId || record.id;
      const recCloudId = record.cloudDocId || (!String(record.id || '').startsWith('rec_') ? record.id : null);
      
      const existingIndex = result.findIndex(existing => {
        const exId = existing.clientRecordId || existing.recordId || existing.id;
        const exCloudId = existing.cloudDocId || (!String(existing.id || '').startsWith('rec_') ? existing.id : null);

        // 1. 直接 ID / clientRecordId 匹配
        if (recId && exId && recId === exId) return true;

        // 2. 雲端 Document ID 匹配
        if (recCloudId && exCloudId && recCloudId === exCloudId) return true;
        if (recCloudId && (recCloudId === exId || recCloudId === existing.cloudDocId)) return true;
        if (exCloudId && (exCloudId === recId || exCloudId === record.cloudDocId)) return true;

        // 3. 內容特徵指紋匹配 (同標題、同科目、同得分、同總題數，且作答時間誤差在 120 秒內)
        if (
          existing.title === record.title &&
          existing.subject === record.subject &&
          Number(existing.score) === Number(record.score) &&
          Number(existing.total) === Number(record.total)
        ) {
          const exTime = existing.createdAtDate ? new Date(existing.createdAtDate).getTime() : 0;
          if (recTime && exTime && Math.abs(recTime - exTime) <= 120000) {
            return true;
          }
        }
        return false;
      });

      if (existingIndex >= 0) {
        // 合併並保留更完整（例如帶有雲端 docId 或題目細節）的資料
        const existing = result[existingIndex];
        result[existingIndex] = {
          ...existing,
          ...record,
          id: existing.id || record.id,
          cloudDocId: existing.cloudDocId || record.cloudDocId || recCloudId || exCloudId,
          clientRecordId: existing.clientRecordId || record.clientRecordId || exId || recId,
          details: (existing.details && existing.details.length > 0) ? existing.details : (record.details || [])
        };
      } else {
        result.push({ ...record });
      }
    }

    // 依建立時間由新到舊排序
    result.sort((a, b) => {
      const tA = a.createdAtDate ? new Date(a.createdAtDate).getTime() : 0;
      const tB = b.createdAtDate ? new Date(b.createdAtDate).getTime() : 0;
      return tB - tA;
    });

    return result;
  }

  /**
   * 儲存測驗評量紀錄
   */
  static async saveAssessmentRecord(user, recordData) {
    const clientRecordId = recordData.clientRecordId || recordData.id || ('rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
    const nowIso = new Date().toISOString();

    const record = {
      id: clientRecordId,
      recordId: clientRecordId,
      clientRecordId: clientRecordId,
      userId: user ? user.uid : 'guest',
      userEmail: user ? user.email : '訪客勇者',
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
      createdAtDate: recordData.createdAtDate || nowIso,
      details: recordData.details || []
    };

    // 1. 本機一律保存一份，並進行去重
    try {
      let localHistory = JSON.parse(localStorage.getItem('jh_quest_local_history') || '[]');
      localHistory = this.deduplicateRecords([record, ...localHistory]);
      if (localHistory.length > 50) localHistory = localHistory.slice(0, 50);
      localStorage.setItem('jh_quest_local_history', JSON.stringify(localHistory));
    } catch (e) {
      console.warn("本機存檔警告:", e);
    }

    // 2. 若使用者已登入且 Firebase 可用，同步上傳雲端
    if (this.isAvailable() && user) {
      try {
        const docRef = await addDoc(collection(db, "assessment_records"), {
          clientRecordId: clientRecordId,
          recordId: clientRecordId,
          userId: user.uid,
          userEmail: user.email,
          userName: user.displayName || user.email,
          userPhoto: user.photoURL || "",
          title: record.title,
          subject: record.subject,
          score: record.score,
          total: record.total,
          accuracy: record.accuracy,
          rank: record.rank,
          expEarned: record.expEarned,
          goldEarned: record.goldEarned,
          details: record.details || [],
          createdAt: serverTimestamp()
        });
        record.cloudDocId = docRef.id;

        // 同步回寫 cloudDocId 到本機暫存，確保雲端與本機身分完美錨定
        try {
          let currentLocal = JSON.parse(localStorage.getItem('jh_quest_local_history') || '[]');
          const target = currentLocal.find(r => (r.clientRecordId === clientRecordId || r.id === clientRecordId));
          if (target) {
            target.cloudDocId = docRef.id;
            localStorage.setItem('jh_quest_local_history', JSON.stringify(currentLocal));
          }
        } catch (syncErr) {}
      } catch (err) {
        console.error("雲端存檔失敗 (已保存在本機快取):", err);
      }
    }
    return record;
  }

  /**
   * 將尚未同步至雲端的本機紀錄批次補傳至 Firestore
   */
  static async syncUnsyncedLocalRecords(user) {
    if (!this.isAvailable() || !user || !user.uid) return;
    try {
      let localRecords = JSON.parse(localStorage.getItem('jh_quest_local_history') || '[]');
      if (!Array.isArray(localRecords) || localRecords.length === 0) return;

      let hasUpdated = false;
      for (const rec of localRecords) {
        // 若該筆紀錄尚未上傳至 Firestore 雲端集合（無 cloudDocId 且非以 Firestore ID 開頭）
        const isCloudDoc = rec.cloudDocId || (rec.id && !String(rec.id).startsWith('rec_'));
        if (!isCloudDoc) {
          try {
            const clientRecordId = rec.clientRecordId || rec.recordId || rec.id || ('rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
            rec.clientRecordId = clientRecordId;
            rec.recordId = clientRecordId;
            // 若為訪客時所作答，登入後將學員身分補錨定至當前登入者
            if (!rec.userId || rec.userId === 'guest') {
              rec.userId = user.uid;
              rec.userEmail = user.email || 'guest';
              rec.userName = user.displayName || user.email || '勇者學員';
              rec.userPhoto = user.photoURL || '';
            }

            const docRef = await addDoc(collection(db, "assessment_records"), {
              clientRecordId: clientRecordId,
              recordId: clientRecordId,
              userId: rec.userId || user.uid,
              userEmail: rec.userEmail || user.email,
              userName: rec.userName || user.displayName || user.email,
              userPhoto: rec.userPhoto || user.photoURL || '',
              title: rec.title || '一般試煉',
              subject: rec.subject || 'all',
              score: rec.score || 0,
              total: rec.total || 0,
              accuracy: rec.accuracy || 0,
              rank: rec.rank || 'B',
              expEarned: rec.expEarned || 0,
              goldEarned: rec.goldEarned || 0,
              details: rec.details || [],
              createdAt: serverTimestamp()
            });

            rec.cloudDocId = docRef.id;
            hasUpdated = true;
          } catch (uploadErr) {
            console.warn("補傳未同步紀錄至雲端失敗:", uploadErr);
          }
        }
      }

      if (hasUpdated) {
        localStorage.setItem('jh_quest_local_history', JSON.stringify(localRecords));
      }
    } catch (e) {
      console.warn("檢查本機未同步紀錄失敗:", e);
    }
  }

  /**
   * 取得使用者的歷史評量紀錄 (整合雲端與本機雙重備份，並嚴格去重)
   */
  static async getMyRecords(user) {
    let localRecords = [];
    try {
      localRecords = JSON.parse(localStorage.getItem('jh_quest_local_history') || '[]');
    } catch (e) {
      localRecords = [];
    }

    // 先清洗去重本機舊有資料
    localRecords = this.deduplicateRecords(localRecords);
    try {
      localStorage.setItem('jh_quest_local_history', JSON.stringify(localRecords));
    } catch (e) {}

    if (!user || !this.isAvailable()) {
      return localRecords;
    }

    // 登入狀態下，先嘗試自動補傳本機未同步的紀錄
    await this.syncUnsyncedLocalRecords(user);

    try {
      let snap;
      try {
        const q = query(
          collection(db, "assessment_records"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        snap = await getDocs(q);
      } catch (indexErr) {
        console.warn("Firestore 複合索引尚未建立，啟動本機客戶端排序降級方案:", indexErr.message);
        const fallbackQ = query(
          collection(db, "assessment_records"),
          where("userId", "==", user.uid)
        );
        snap = await getDocs(fallbackQ);
      }

      if (!snap || snap.empty) {
        return localRecords;
      }

      const cloudList = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          cloudDocId: doc.id,
          ...d,
          createdAtDate: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : (d.createdAtDate || new Date().toISOString())
        };
      });

      // 整合雲端與本機紀錄，進行全面性去重
      const merged = this.deduplicateRecords([...cloudList, ...localRecords]);

      // 更新本機快取為去重整合後的完整紀錄
      try {
        localStorage.setItem('jh_quest_local_history', JSON.stringify(merged.slice(0, 50)));
      } catch (e) {}

      return merged;
    } catch (err) {
      console.warn("無法從雲端讀取歷史紀錄，無縫降級使用本機紀錄:", err);
      return localRecords;
    }
  }

  /**
   * 管理者取得所有學員的評量紀錄 (同步進行重複剔除與本機雙軌備援)
   */
  static async getAllRecords(adminUser) {
    if (!this.isAvailable()) {
      throw new Error("尚未設定 Firebase 資料庫！請在系統設定中設定 Firebase。");
    }
    if (!this.isAdmin(adminUser)) {
      throw new Error("權限拒絕：僅管理者 Google 帳號可存取全員學習紀錄！");
    }

    // 1. 若有本機未同步至雲端的測驗紀錄，主動進行補傳
    await this.syncUnsyncedLocalRecords(adminUser);

    let localRecords = [];
    try {
      localRecords = JSON.parse(localStorage.getItem('jh_quest_local_history') || '[]');
    } catch (e) {
      localRecords = [];
    }

    let cloudList = [];
    try {
      let snap;
      try {
        const q = query(
          collection(db, "assessment_records"),
          orderBy("createdAt", "desc")
        );
        snap = await getDocs(q);
      } catch (orderErr) {
        console.warn("無法以 createdAt 排序讀取全體紀錄，改用無排序查詢:", orderErr.message);
        const fallbackQ = collection(db, "assessment_records");
        snap = await getDocs(fallbackQ);
      }

      if (snap && !snap.empty) {
        cloudList = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            cloudDocId: doc.id,
            ...d,
            createdAtDate: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : (d.createdAtDate || new Date().toISOString())
          };
        });
      }
    } catch (err) {
      console.warn("雲端讀取全體紀錄失敗，降級使用本機紀錄:", err);
      if (localRecords.length === 0) {
        throw err;
      }
    }

    // 2. 整合雲端全員資料與本機紀錄（雙軌去重融合，確保即時呈現在管理後台）
    return this.deduplicateRecords([...cloudList, ...localRecords]);
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
        dailyQuests: playerState.dailyQuests || [],
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
