// 星耀國中冒險學院｜RAG 向量檢索增強引擎 (js/rag_engine.js)
// 支援 Google Gemini 語義向量 Embedding (768 維) + 餘弦相似度檢索 + 真題典範增強生成

export class RagEngine {
  static _queryCache = new Map();
  static CUSTOM_STORAGE_KEY = 'jh_quest_custom_rag_questions';

  /**
   * 檢查題庫向量庫是否已載入完成
   */
  static isReady() {
    return typeof window !== 'undefined' && 
      Array.isArray(window.QUESTION_EMBEDDINGS) && 
      window.QUESTION_EMBEDDINGS.length > 0;
  }

  /**
   * 取得使用者自訂或圖片辨識收錄的 RAG 題庫
   */
  static getCustomQuestions() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.CUSTOM_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('⚠️ 讀取自訂 RAG 題庫失敗:', e);
      return [];
    }
  }

  /**
   * 儲存自訂 RAG 題庫清單
   */
  static saveCustomQuestions(list) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.CUSTOM_STORAGE_KEY, JSON.stringify(list || []));
    } catch (e) {
      console.warn('⚠️ 儲存自訂 RAG 題庫失敗:', e);
    }
  }

  static _cloudQuestionsCache = [];
  static _isSyncingCloud = false;

  /**
   * 同步 Firebase Firestore 雲端 RAG 共享題庫
   */
  static async syncCloudQuestions() {
    if (this._isSyncingCloud) return this._cloudQuestionsCache;
    if (typeof window === 'undefined' || !window.FirebaseService || !window.FirebaseService.isAvailable()) {
      return this._cloudQuestionsCache;
    }

    this._isSyncingCloud = true;
    try {
      const cloudList = await window.FirebaseService.fetchCloudRagQuestions(200);
      if (Array.isArray(cloudList) && cloudList.length > 0) {
        this._cloudQuestionsCache = cloudList;
        console.log(`☁️ RAG 雲端共享題庫載入成功，共 ${cloudList.length} 道雲端真題`);

        // 將雲端題目合併至本地 localStorage（雙向快取保險）
        const localList = this.getCustomQuestions();
        const localStems = new Set(localList.map(q => q.stem ? q.stem.trim() : ''));
        let hasNew = false;
        cloudList.forEach(cq => {
          if (cq.stem && !localStems.has(cq.stem.trim())) {
            localList.push(cq);
            localStems.add(cq.stem.trim());
            hasNew = true;
          }
        });
        if (hasNew) {
          this.saveCustomQuestions(localList);
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rag-cloud-synced', { detail: { count: cloudList.length } }));
        }
      }
      return this._cloudQuestionsCache;
    } catch (err) {
      console.warn('⚠️ 同步雲端 RAG 題庫時發生例外:', err);
      return this._cloudQuestionsCache;
    } finally {
      this._isSyncingCloud = false;
    }
  }

  /**
   * 新增一道由學生上傳圖片辨識出（或自訂）的考題至 RAG 題庫（本機＋Firestore 雲端雙寫）
   * @param {Object} qData 考題物件 { stem, options, answer, concept, explanation, subject, grade, school }
   * @param {string} [apiKey] Gemini API Key (若提供則即時計算 768 維 Embedding 向量)
   * @param {Object} [user] 當前登入的使用者資訊
   */
  static async addCustomQuestion(qData, apiKey = '', user = null) {
    if (!qData || !qData.stem) return null;

    const customList = this.getCustomQuestions();
    
    // 檢查是否已存在相同題幹 (避免重複收錄)
    const existingIdx = customList.findIndex(item => item.stem && item.stem.trim() === qData.stem.trim());
    
    const cleanSubject = qData.subject || 'math';
    const cleanGrade = String(qData.grade || '8');
    const cleanConcept = qData.concept || '考點解析';
    const searchText = `【${cleanSubject} ${cleanGrade}年級】考點：${cleanConcept}。題幹：${qData.stem}`;

    let vector = null;
    if (apiKey) {
      try {
        vector = await this.embedQuery(searchText, apiKey);
      } catch (err) {
        console.warn('⚠️ 自訂考題 Embedding 特徵計算失敗，使用文字備援:', err);
      }
    }

    const newQuestion = {
      id: qData.id || `custom-rag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subject: cleanSubject,
      grade: cleanGrade,
      concept: cleanConcept,
      stem: qData.stem.trim(),
      options: Array.isArray(qData.options) ? qData.options : [],
      answer: typeof qData.answer === 'number' ? qData.answer : 0,
      hint: qData.hint || '掌握題幹關鍵條件，依循定義推導。',
      explanation: qData.explanation || '依據題意與核心觀念解題。',
      school: qData.school || '學生拍照上傳考題',
      source: qData.source || 'image_upload',
      createdAt: qData.createdAt || new Date().toISOString(),
      vector: vector || null,
      cloudSynced: false
    };

    if (existingIdx >= 0) {
      // 更新既有題目（保留原有 vector 若新 vector 為空）
      if (!newQuestion.vector && customList[existingIdx].vector) {
        newQuestion.vector = customList[existingIdx].vector;
      }
      customList[existingIdx] = newQuestion;
    } else {
      customList.unshift(newQuestion);
    }

    this.saveCustomQuestions(customList);

    // 🚀 即時非同步同步至 Firebase Firestore 雲端知識庫
    if (typeof window !== 'undefined' && window.FirebaseService && window.FirebaseService.isAvailable()) {
      try {
        const u = user || (window.FirebaseService.currentUser ? window.FirebaseService.currentUser : null);
        const cloudSaved = await window.FirebaseService.saveRagQuestion(newQuestion, u);
        if (cloudSaved) {
          newQuestion.cloudSynced = true;
          const updatedList = this.getCustomQuestions().map(q => q.id === newQuestion.id ? { ...q, cloudSynced: true } : q);
          this.saveCustomQuestions(updatedList);
        }
      } catch (cloudErr) {
        console.warn('⚠️ 上傳雲端 Firestore 題庫失敗 (已保存在本機):', cloudErr);
      }
    }

    return newQuestion;
  }

  /**
   * 刪除指定 ID 的自訂 RAG 考題（本地＋雲端同步刪除）
   */
  static async deleteCustomQuestion(id) {
    const list = this.getCustomQuestions().filter(q => q.id !== id);
    this.saveCustomQuestions(list);

    // 同步自雲端 Firestore 刪除
    if (typeof window !== 'undefined' && window.FirebaseService && window.FirebaseService.isAvailable()) {
      try {
        await window.FirebaseService.deleteCloudRagQuestion(id);
      } catch (err) {
        console.warn('⚠️ 自雲端刪除考題失敗:', err);
      }
    }
    return list;
  }

  /**
   * 取得自訂 RAG 考題總數（本地去重結合雲端）
   */
  static getCustomQuestionsCount() {
    const local = this.getCustomQuestions();
    const cloud = this._cloudQuestionsCache || [];
    const stems = new Set(local.map(q => q.stem ? q.stem.trim() : ''));
    let total = local.length;
    cloud.forEach(cq => {
      if (cq.stem && !stems.has(cq.stem.trim())) {
        stems.add(cq.stem.trim());
        total++;
      }
    });
    return total;
  }

  /**
   * 取得現有向量題庫清單（自動合併「學生拍照上傳考題」、「Firebase 雲端題庫」與「靜態全真段考題庫」）
   */
  static getEmbeddings() {
    let base = [];
    if (typeof window !== 'undefined' && Array.isArray(window.QUESTION_EMBEDDINGS)) {
      base = window.QUESTION_EMBEDDINGS;
    }
    const custom = this.getCustomQuestions();
    const cloud = this._cloudQuestionsCache || [];

    // 合併 custom 與 cloud（以 stem 為 key 去重）
    const combinedCustom = [...custom];
    const customStems = new Set(custom.map(q => q.stem ? q.stem.trim() : ''));
    cloud.forEach(cq => {
      if (cq.stem && !customStems.has(cq.stem.trim())) {
        combinedCustom.push(cq);
        customStems.add(cq.stem.trim());
      }
    });

    // 自動合併 REAL_EXAM_QUESTIONS 中所有真題
    const realExamPool = (typeof window !== 'undefined' && Array.isArray(window.REAL_EXAM_QUESTIONS)) ? window.REAL_EXAM_QUESTIONS : [];
    const baseStems = new Set(base.map(q => q.stem ? q.stem.trim() : ''));
    const unindexedReal = realExamPool.filter(q => q.stem && !baseStems.has(q.stem.trim()));

    return [...combinedCustom, ...base, ...unindexedReal];
  }

  /**
   * 計算兩向量之餘弦相似度 (Cosine Similarity)
   * 若向量已完成 L2 正規化，餘弦相似度即為純內積 (Dot Product)
   */
  static cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = vecA.length;
    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 呼叫 Google Gemini API 將查詢文字轉換為 768 維語義特徵向量
   * @param {string} text 查詢文字 (學生的錯題內容、考點或題幹)
   * @param {string} apiKey Gemini API Key
   */
  static async embedQuery(text, apiKey) {
    const cleanText = (text || '').trim();
    if (!cleanText) return null;

    // 命中記憶體快取直接回傳
    if (this._queryCache.has(cleanText)) {
      return this._queryCache.get(cleanText);
    }

    if (!apiKey) return null;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${encodeURIComponent(apiKey)}`;
    const payload = {
      model: "models/gemini-embedding-2",
      content: {
        parts: [{ text: cleanText }]
      },
      outputDimensionality: 768
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error ? errJson.error.message : response.statusText;
      throw new Error(`向量特徵提取失敗 (${response.status}): ${msg}`);
    }

    const data = await response.json();
    if (data.embedding && Array.isArray(data.embedding.values)) {
      const values = data.embedding.values;
      // 進行 L2 正規化
      let norm = 0;
      for (let i = 0; i < values.length; i++) norm += values[i] * values[i];
      norm = Math.sqrt(norm);
      const normalized = (norm > 0) ? values.map(v => v / norm) : values;
      this._queryCache.set(cleanText, normalized);
      return normalized;
    }

    return null;
  }

  /**
   * 基於語義向量 (或退化關鍵字) 檢索出最相近的真實會考／段考題 (Top-K)
   * @param {Object} params
   * @param {string} params.query 學生錯題或概念文字
   * @param {string} [params.subject] 指定學科 (chinese, english, math, science, social)
   * @param {string} [params.grade] 目標年級 (7, 8, 9)
   * @param {number} [params.topK=3] 回傳最相似題數
   * @param {string} [params.apiKey] Gemini API Key (可選)
   */
  static async retrieveSimilarQuestions({ query, subject, grade, topK = 3, apiKey }) {
    const bank = this.getEmbeddings();
    if (bank.length === 0) {
      console.warn('⚠️ 向量題庫 (QUESTION_EMBEDDINGS) 尚未載入，轉用關鍵字匹配');
      return this.fallbackKeywordSearch({ query, subject, grade, topK });
    }

    let queryVector = null;
    let usedVector = false;

    // 1. 若有提供 API Key，嘗試提取查詢的高維向量進行精確語義比對
    if (apiKey) {
      try {
        queryVector = await this.embedQuery(query, apiKey);
        if (queryVector) usedVector = true;
      } catch (err) {
        console.warn('⚠️ 查詢向量提取失敗，自動降級為語義關鍵字檢索:', err.message);
      }
    }

    // 2. 向量比對評分
    if (usedVector && queryVector) {
      const scored = bank.map(q => {
        let score = 0;
        if (Array.isArray(q.vector) && q.vector.length === queryVector.length) {
          score = this.cosineSimilarity(queryVector, q.vector);
        } else {
          const qText = `${q.concept || ''} ${q.stem || ''}`.toLowerCase();
          const cleanQ = (query || '').toLowerCase();
          if (cleanQ && qText.includes(cleanQ)) {
            score = 0.70;
          }
        }

        // 科目吻合加權 (Domain Prior)
        if (subject && subject !== 'auto' && q.subject === subject) {
          score += 0.08;
        }
        // 年級相近微調加權
        if (grade && grade !== 'all' && q.grade === String(grade)) {
          score += 0.03;
        }

        return { ...q, similarityScore: score, matchType: 'vector' };
      });

      scored.sort((a, b) => b.similarityScore - a.similarityScore);
      return scored.slice(0, topK);
    }

    // 3. 離線或無 API Key 時的智慧型語義關鍵字匹配
    return this.fallbackKeywordSearch({ query, subject, grade, topK });
  }

  /**
   * 智慧型語義關鍵字檢索 (純本地備援模式)
   */
  static fallbackKeywordSearch({ query, subject, grade, topK = 3 }) {
    let pool = this.getEmbeddings();
    if (pool.length === 0) {
      // 若尚未載入嵌入檔，從全域 REAL_EXAM_QUESTIONS 與 CORE_QUESTIONS 取用
      const real = (typeof window !== 'undefined' && Array.isArray(window.REAL_EXAM_QUESTIONS)) ? window.REAL_EXAM_QUESTIONS : [];
      const core = (typeof window !== 'undefined' && Array.isArray(window.CORE_QUESTIONS)) ? window.CORE_QUESTIONS : [];
      pool = [...real, ...core];
    }

    if (pool.length === 0) return [];

    const cleanQuery = (query || '').toLowerCase();
    // 提取中文 2 字元以上詞組與英文單字
    const tokens = cleanQuery.match(/[\u4e00-\u9fa5]{2,4}|[a-zA-Z]{3,}/g) || [cleanQuery];

    const scored = pool.map(q => {
      let score = 0;
      const targetText = `${q.concept || ''} ${q.stem || ''} ${q.explanation || ''}`.toLowerCase();

      tokens.forEach(tok => {
        if (!tok) return;
        if (targetText.includes(tok)) {
          score += (tok.length >= 3 ? 3 : 2);
        }
      });

      if (subject && subject !== 'auto' && q.subject === subject) {
        score += 5;
      }
      if (grade && grade !== 'all' && q.grade === String(grade)) {
        score += 2;
      }

      return { ...q, similarityScore: score, matchType: 'keyword' };
    });

    scored.sort((a, b) => b.similarityScore - a.similarityScore);
    return scored.slice(0, topK);
  }

  /**
   * 將檢索出的真題典範組裝為 Few-Shot 增強 Prompt 上下文
   * @param {Array} exemplars 檢索出的真題陣列
   */
  static buildRAGPromptContext(exemplars) {
    if (!Array.isArray(exemplars) || exemplars.length === 0) {
      return '';
    }

    let context = '\n\n【RAG 向量檢索增強：真實會考／名校真題典範參考 (Few-Shot Exemplars)】\n';
    context += '系統已從台灣歷屆教育會考與名校（永和／福和國中）真題庫中，透過 768 維語義向量檢索出最符合學生當前錯題考點的真實題目：\n\n';

    exemplars.forEach((ex, idx) => {
      context += `--- 典範真題 ${idx + 1} (${ex.school || '會考真題'}，${ex.grade}年級，考點：${ex.concept}) ---\n`;
      context += `題幹：${ex.stem}\n`;
      if (Array.isArray(ex.options) && ex.options.length > 0) {
        context += `選項：\n${ex.options.join('\n')}\n`;
      }
      context += `正解：選項索引 ${ex.answer}\n`;
      if (ex.hint) context += `解題提示：${ex.hint}\n`;
      if (ex.explanation) context += `解析：${ex.explanation}\n\n`;
    });

    context += `【出題設計核心指示】\n`;
    context += `1. 請深入學習上述真題的「生活情境素養包裝」、「誘答選項設計（學生最常掉入之思維陷阱）」與「語氣難度」。\n`;
    context += `2. 嚴格禁止直接抄襲或複製上述範例題幹！你必須以此考點為核心，全新創作 4 道【完全不同生活故事、全新變換數值、原創題幹】的階梯式素養練習題。\n`;
    context += `3. 確保生成的試題難度由淺入深，第 1 題觀念拆解、第 2 題同型變換、第 3 題生活素養、第 4 題會考魔王陷阱，徹底杜絕題目重複！\n`;

    return context;
  }
}

// 支援全域與模組環境
if (typeof window !== 'undefined') {
  window.RagEngine = RagEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RagEngine };
}
