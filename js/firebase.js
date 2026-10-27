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
  limit,
  deleteDoc,
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
        if (user) {
          // 先拉取雲端動態管理員名單以校準最新權限
          try {
            await FirebaseService.fetchCloudAdminList();
          } catch (e) {}
        }
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
  static _cloudAdminsCache = new Set();

  static isAvailable() {
    return isFirebaseConfigured() && !!auth && !!db;
  }

  static getConfig() {
    return APP_CONFIG;
  }

  /**
   * 自 Firestore "system_admins" 集合拉取最新授權管理員名單
   */
  static async fetchCloudAdminList() {
    if (!this.isAvailable()) return Array.from(this._cloudAdminsCache);
    try {
      const snap = await getDocs(collection(db, "system_admins"));
      if (!snap.empty) {
        snap.docs.forEach(docSnap => {
          const mail = (docSnap.id ? docSnap.id : (docSnap.data()?.email || '')).toLowerCase().trim();
          if (mail) this._cloudAdminsCache.add(mail);
        });
        // 雙重安全快取至 localStorage
        try {
          const localAdmins = JSON.parse(localStorage.getItem('jh_quest_admin_emails') || '[]');
          const merged = Array.from(new Set([...localAdmins, ...Array.from(this._cloudAdminsCache)]));
          localStorage.setItem('jh_quest_admin_emails', JSON.stringify(merged));
        } catch (e) {}
      }
    } catch (err) {
      console.debug("讀取雲端 system_admins 狀態:", err.message);
    }
    return Array.from(this._cloudAdminsCache);
  }

  /**
   * 儲存自訂設定並自動非同步同步管理員至 Firestore system_admins
   */
  static async saveCustomConfig(customFirebase, adminEmailsList, currentUser = null) {
    const configToSave = {
      firebase: customFirebase,
      adminEmails: adminEmailsList
    };
    localStorage.setItem('jh_quest_custom_firebase_config', JSON.stringify(configToSave));
    APP_CONFIG.firebase = customFirebase;
    APP_CONFIG.adminEmails = adminEmailsList;
    window.APP_CONFIG = APP_CONFIG;
    initFirebase();

    // 若 Firebase 連線可用，批次將管理員同步至雲端 system_admins 集合
    if (this.isAvailable() && Array.isArray(adminEmailsList)) {
      for (const email of adminEmailsList) {
        const cleanEmail = String(email || '').toLowerCase().trim();
        if (cleanEmail) {
          this.grantAdmin(cleanEmail, currentUser).catch(() => {});
        }
      }
    }
  }

  /**
   * 授權特定信箱為管理員（本機 + Firestore system_admins 雲端雙寫）
   */
  static async grantAdmin(email, byUser = null) {
    if (!email) return false;
    const cleaned = email.toLowerCase().trim();
    this._cloudAdminsCache.add(cleaned);

    // 1. 更新本機 localStorage
    const localAdmins = JSON.parse(localStorage.getItem('jh_quest_admin_emails') || '[]');
    if (!localAdmins.includes(cleaned)) {
      localAdmins.push(cleaned);
      localStorage.setItem('jh_quest_admin_emails', JSON.stringify(localAdmins));
    }
    if (!APP_CONFIG.adminEmails.map(e => e.toLowerCase().trim()).includes(cleaned)) {
      APP_CONFIG.adminEmails.push(cleaned);
    }

    // 2. 寫入 Firestore system_admins 集合，確保 firestore.rules 動態核准
    if (this.isAvailable()) {
      try {
        await setDoc(doc(db, "system_admins", cleaned), {
          email: cleaned,
          grantedBy: byUser?.email || (auth?.currentUser?.email || 'admin'),
          grantedAt: serverTimestamp()
        }, { merge: true });
        console.log(`👑 管理者「${cleaned}」已同步至 Firestore 雲端授權清單`);
        return true;
      } catch (cloudErr) {
        console.warn("⚠️ 同步管理者至雲端 system_admins 失敗 (本機已生效):", cloudErr);
      }
    }
    return true;
  }

  /**
   * 撤銷特定信箱之管理員身分
   */
  static async revokeAdmin(email) {
    if (!email) return false;
    const cleaned = email.toLowerCase().trim();
    this._cloudAdminsCache.delete(cleaned);

    // 1. 本機快取移除
    try {
      let localAdmins = JSON.parse(localStorage.getItem('jh_quest_admin_emails') || '[]');
      localAdmins = localAdmins.filter(e => e.toLowerCase().trim() !== cleaned);
      localStorage.setItem('jh_quest_admin_emails', JSON.stringify(localAdmins));
    } catch (e) {}

    APP_CONFIG.adminEmails = (APP_CONFIG.adminEmails || []).filter(e => e.toLowerCase().trim() !== cleaned);

    // 2. 自 Firestore 刪除
    if (this.isAvailable()) {
      try {
        await deleteDoc(doc(db, "system_admins", cleaned));
        console.log(`👑 管理者「${cleaned}」已從 Firestore 雲端授權清單移除`);
        return true;
      } catch (cloudErr) {
        console.warn("⚠️ 自雲端移除管理者失敗:", cloudErr);
      }
    }
    return true;
  }

  static isAdmin(user) {
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase().trim();
    
    // 1. 始祖超級管理員預設名單保底
    if (email === 'oye816@gmail.com') return true;

    // 2. 檢查雲端動態管理員快取 (system_admins)
    if (this._cloudAdminsCache.has(email)) return true;

    // 3. 檢查 APP_CONFIG
    const adminList = (APP_CONFIG.adminEmails || []).map(e => e.toLowerCase().trim());
    if (adminList.includes(email)) return true;

    // 4. 檢查 localStorage
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
   * 刪除指定的一筆測驗評量紀錄（支援本地快取刪除與 Firestore 雲端同步刪除）
   * @param {Object|string} recordOrId 評量紀錄物件或紀錄 ID / cloudDocId
   * @param {Object} [user] 當前操作的使用者
   */
  static async deleteAssessmentRecord(recordOrId, user = null) {
    if (!recordOrId) return { success: false, message: '無效的紀錄識別碼' };

    let targetId = typeof recordOrId === 'string' ? recordOrId : (recordOrId.id || recordOrId.clientRecordId || recordOrId.recordId);
    let cloudDocId = typeof recordOrId === 'object' ? recordOrId.cloudDocId : null;

    // 1. 本機快取刪除
    let localDeleted = false;
    try {
      let localRecords = JSON.parse(localStorage.getItem('jh_quest_local_history') || '[]');
      const initialLen = localRecords.length;
      localRecords = localRecords.filter(r => {
        const rId = r.clientRecordId || r.recordId || r.id;
        const rCloudId = r.cloudDocId;
        if (targetId && (rId === targetId || r.id === targetId)) return false;
        if (cloudDocId && rCloudId === cloudDocId) return false;
        if (targetId && rCloudId === targetId) return false;
        return true;
      });
      if (localRecords.length < initialLen) {
        localDeleted = true;
        localStorage.setItem('jh_quest_local_history', JSON.stringify(localRecords));
      }
    } catch (e) {
      console.warn("本機刪除評量紀錄失敗:", e);
    }

    // 2. 雲端 Firestore 同步刪除
    let cloudDeleted = false;
    if (this.isAvailable()) {
      try {
        // 若已有 cloudDocId，直接刪除文檔
        if (cloudDocId) {
          await deleteDoc(doc(db, "assessment_records", cloudDocId));
          cloudDeleted = true;
        } else if (targetId && !String(targetId).startsWith('rec_')) {
          // 若 targetId 本身就是 Firestore Document ID
          await deleteDoc(doc(db, "assessment_records", targetId));
          cloudDeleted = true;
        } else if (targetId) {
          // 若只有 clientRecordId，透過查詢比對刪除
          const q = query(
            collection(db, "assessment_records"),
            where("clientRecordId", "==", targetId)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            for (const d of snap.docs) {
              await deleteDoc(d.ref);
            }
            cloudDeleted = true;
          }
        }
      } catch (cloudErr) {
        console.warn("⚠️ 雲端刪除評量紀錄失敗:", cloudErr);
      }
    }

    return { success: localDeleted || cloudDeleted, localDeleted, cloudDeleted };
  }

  /**
   * 清空指定使用者的所有測驗紀錄（本地與雲端一併清除）
   * @param {Object} [user] 當前登入的使用者
   */
  static async clearAllAssessmentRecords(user = null) {
    // 1. 清空本地快取
    try {
      localStorage.removeItem('jh_quest_local_history');
    } catch (e) {
      console.warn("清空本機評量紀錄失敗:", e);
    }

    // 2. 若已登入且 Firebase 可用，清空雲端屬於該使用者的紀錄
    let cloudCount = 0;
    if (this.isAvailable() && user && user.uid) {
      try {
        const q = query(
          collection(db, "assessment_records"),
          where("userId", "==", user.uid)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          for (const d of snap.docs) {
            await deleteDoc(d.ref);
            cloudCount++;
          }
        }
      } catch (err) {
        console.warn("⚠️ 清空雲端評量紀錄失敗:", err);
      }
    }

    return { success: true, cloudDeletedCount: cloudCount };
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
      // 為避免 Firestore orderBy("createdAt") 自動忽略缺少 createdAt 欄位的文件，
      // 這裡直接拉取 assessment_records 集合全量文件，並由客戶端進行容錯排序
      let snap;
      try {
        const q = collection(db, "assessment_records");
        snap = await getDocs(q);
      } catch (collErr) {
        // 若集合讀取失敗，拋出具體錯誤（不靜默吞掉，確保 UI 能提示權限狀態）
        console.error("Firestore assessment_records 集合讀取失敗:", collErr);
        throw collErr;
      }

      if (snap && !snap.empty) {
        cloudList = snap.docs.map(docSnap => {
          const d = docSnap.data();
          let parsedIso = d.createdAtDate;
          if (d.createdAt && typeof d.createdAt.toDate === 'function') {
            try { parsedIso = d.createdAt.toDate().toISOString(); } catch (e) {}
          }
          return {
            id: docSnap.id,
            cloudDocId: docSnap.id,
            ...d,
            createdAtDate: parsedIso || new Date().toISOString()
          };
        });

        // 客戶端統一降序排序 (最新測驗排在最前，兼顧 Timestamp 與 ISO 字串)
        cloudList.sort((a, b) => {
          const tA = new Date(a.createdAtDate || 0).getTime();
          const tB = new Date(b.createdAtDate || 0).getTime();
          return tB - tA;
        });
      }
    } catch (err) {
      console.error("雲端全員資料庫讀取失敗:", err);
      // 若為權限不足或雲端異常，直接向上拋出，讓後台介面顯示正確的診斷指引
      throw new Error(`無法載入雲端全員紀錄 (${err.code || err.message})。若顯示權限不足，請確認 Firebase Console 的 firestore.rules 規則已部署，且您的信箱已加入 system_admins 或管理員清單。`);
    }

    // 2. 整合雲端全員資料與本機紀錄（雙軌去重融合）
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

  /**
   * 將學生拍照辨識出或自訂的考題同步儲存至 Firebase Firestore 雲端知識庫
   * @param {Object} qData 題目資料物件
   * @param {Object} [user] 當前登入的使用者資訊
   */
  static async saveRagQuestion(qData, user = null) {
    if (!this.isAvailable() || !qData || !qData.stem) return null;
    try {
      const qId = qData.id || `cloud-rag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const docData = {
        id: qId,
        stem: qData.stem.trim(),
        options: Array.isArray(qData.options) ? qData.options : [],
        answer: typeof qData.answer === 'number' ? qData.answer : 0,
        concept: qData.concept || '考點解析',
        subject: qData.subject || 'math',
        grade: String(qData.grade || '8'),
        diagramSvg: (typeof qData.diagramSvg === 'string' && qData.diagramSvg.includes('<svg')) ? qData.diagramSvg.trim() : null,
        hint: qData.hint || '掌握題幹關鍵條件，依循定義推導。',
        explanation: qData.explanation || '依據題意與核心觀念解題。',
        school: qData.school || (qData.source === 'ai_repaired' ? 'AI 修正題型典範' : 'AI 精選好題典範'),
        source: qData.source || 'image_upload',
        repairNote: qData.repairNote || null,
        vector: Array.isArray(qData.vector) ? qData.vector : null,
        uploaderUid: user?.uid || (auth?.currentUser?.uid || 'guest'),
        uploaderEmail: user?.email || (auth?.currentUser?.email || ''),
        uploaderName: user?.displayName || (auth?.currentUser?.displayName || '熱心同學'),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, "rag_custom_questions", qId), docData, { merge: true });
      console.log(`☁️ 考題已成功同步至 Firestore 雲端知識庫 [ID: ${qId}]`);
      return { ...docData, id: qId };
    } catch (err) {
      console.warn("⚠️ 同步至 Firestore 雲端 RAG 失敗 (仍保留本機儲存):", err);
      return null;
    }
  }

  /**
   * 將生題異常紀錄非同步同步至 Firestore 雲端集合以利跨端除錯
   */
  static async logAnomalyToCloud(anomaly) {
    if (!this.isAvailable() || !anomaly) return false;
    try {
      const aId = anomaly.id || `anomaly-${Date.now()}`;
      const payload = {
        id: aId,
        timestamp: anomaly.timestamp || new Date().toISOString(),
        subject: anomaly.subject || 'math',
        grade: String(anomaly.grade || '8'),
        style: anomaly.style || 'progressive',
        inputText: (anomaly.inputText || '').slice(0, 500),
        hasImage: !!anomaly.hasImage,
        model: anomaly.model || 'Gemini',
        stage: anomaly.stage || 'generation',
        errorReason: anomaly.errorReason || '',
        rawResponse: (anomaly.rawResponse || '').slice(0, 3000),
        faultyQuestion: anomaly.faultyQuestion || null,
        status: anomaly.status || 'unresolved',
        repairedQuestion: anomaly.repairedQuestion || null,
        reporterUid: auth?.currentUser?.uid || 'anonymous',
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, "generation_anomalies", aId), payload, { merge: true });
      return true;
    } catch (err) {
      // 容錯靜默失敗
      return false;
    }
  }

  /**
   * 從 Firebase Firestore 載入全校/共用雲端 RAG 題庫
   * @param {number} [limitCount=200] 最多載入筆數
   */
  static async fetchCloudRagQuestions(limitCount = 200) {
    if (!this.isAvailable()) return [];
    try {
      let snap;
      try {
        const q = query(
          collection(db, "rag_custom_questions"),
          orderBy("createdAt", "desc"),
          limit(limitCount)
        );
        snap = await getDocs(q);
      } catch (orderErr) {
        // 若缺少索引或欄位尚未建立，降級為無排序查詢
        const fallbackQ = collection(db, "rag_custom_questions");
        snap = await getDocs(fallbackQ);
      }

      if (!snap || snap.empty) return [];
      return snap.docs.map(d => {
        const item = d.data();
        return {
          ...item,
          id: d.id,
          cloudDocId: d.id,
          createdAt: item.createdAt?.toDate ? item.createdAt.toDate().toISOString() : (item.createdAt || new Date().toISOString())
        };
      });
    } catch (err) {
      console.warn("⚠️ 讀取 Firestore 雲端 RAG 題庫失敗:", err);
      return [];
    }
  }

  /**
   * 刪除指定 ID 的雲端 RAG 考題（限上傳者或管理員）
   */
  static async deleteCloudRagQuestion(questionId) {
    if (!this.isAvailable() || !questionId) return false;
    try {
      await deleteDoc(doc(db, "rag_custom_questions", questionId));
      return true;
    } catch (err) {
      console.warn("⚠️ 刪除雲端 RAG 題庫失敗:", err);
      return false;
    }
  }

  /**
   * 記錄使用者之維度篩選選取事件（學年、學期、段考次數等）
   * 當 Firebase 啟用時寫入 Firestore "selection_logs" 集合，並本機雙重備援儲存
   * @param {string} filterType 'grade' | 'semester' | 'stage' | 'exam_scope'
   * @param {string} value 選取代碼 ('all', '7', '8', '9', '1', '2', '3')
   * @param {string} label 標籤名稱 ('全學年', '七年級', '第一學期 (上)', '第二次段考')
   * @param {object} [extraContext={}] 當前完整維度上下文
   * @returns {Promise<object>}
   */
  static async logFilterSelection(filterType, value, label, extraContext = {}) {
    const timestampStr = new Date().toISOString();
    const logItem = {
      id: 'sel_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      filterType: String(filterType || 'unknown'),
      value: String(value || ''),
      label: String(label || value || ''),
      extraContext: extraContext || {},
      timestamp: timestampStr
    };

    // 1. 本機 localStorage 快取最新 100 筆篩選歷程 (供離線或診斷使用)
    try {
      let localLogs = JSON.parse(localStorage.getItem('jh_quest_filter_selection_logs') || '[]');
      if (!Array.isArray(localLogs)) localLogs = [];
      localLogs.unshift(logItem);
      if (localLogs.length > 100) localLogs = localLogs.slice(0, 100);
      localStorage.setItem('jh_quest_filter_selection_logs', JSON.stringify(localLogs));
    } catch (localErr) {}

    // 2. 當 Firebase 服務可用時，非同步存入 Firestore "selection_logs" 集合
    if (this.isAvailable()) {
      try {
        const currentUser = auth?.currentUser;
        let cachedUser = null;
        try {
          const cachedUserStr = localStorage.getItem('jh_quest_cached_user');
          if (cachedUserStr) cachedUser = JSON.parse(cachedUserStr);
        } catch (e) {}

        const uid = currentUser?.uid || cachedUser?.uid || 'guest';
        const email = currentUser?.email || cachedUser?.email || 'guest';
        const displayName = currentUser?.displayName || cachedUser?.displayName || (uid === 'guest' ? '訪客學員' : '學員');

        const payload = {
          filterType: logItem.filterType,
          value: logItem.value,
          label: logItem.label,
          userId: uid,
          userEmail: email,
          userName: displayName,
          extraContext: extraContext || {},
          clientTimestamp: Date.now(),
          createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "selection_logs"), payload);
        logItem.cloudDocId = docRef.id;
        return logItem;
      } catch (cloudErr) {
        console.warn("⚠️ 記錄篩選選取事件至 Firestore 警告 (不影響使用者操作):", cloudErr);
      }
    }

    return logItem;
  }

  /**
   * 取得使用者的篩選選取歷史紀錄（優先讀取 Firestore，備援本機快取）
   * @param {number} [limitCount=50]
   */
  static async fetchSelectionLogs(limitCount = 50) {
    if (this.isAvailable()) {
      try {
        let snap;
        try {
          const q = query(
            collection(db, "selection_logs"),
            orderBy("createdAt", "desc"),
            limit(limitCount)
          );
          snap = await getDocs(q);
        } catch (orderErr) {
          const fallbackQ = collection(db, "selection_logs");
          snap = await getDocs(fallbackQ);
        }

        if (snap && !snap.empty) {
          return snap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              cloudDocId: d.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString())
            };
          });
        }
      } catch (err) {
        console.warn("讀取雲端篩選選取紀錄失敗，使用本機快取:", err);
      }
    }

    try {
      return JSON.parse(localStorage.getItem('jh_quest_filter_selection_logs') || '[]');
    } catch (e) {
      return [];
    }
  }
}

// 掛載至 window
window.FirebaseService = FirebaseService;

// 觸發模組就緒事件
window.dispatchEvent(new CustomEvent('firebase-service-ready'));
