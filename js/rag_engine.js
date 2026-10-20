// 星耀國中冒險學院｜RAG 向量檢索增強引擎 (js/rag_engine.js)
// 支援 Google Gemini 語義向量 Embedding (768 維) + 餘弦相似度檢索 + 真題典範增強生成

export class RagEngine {
  static _queryCache = new Map();

  /**
   * 檢查題庫向量庫是否已載入完成
   */
  static isReady() {
    return typeof window !== 'undefined' && 
      Array.isArray(window.QUESTION_EMBEDDINGS) && 
      window.QUESTION_EMBEDDINGS.length > 0;
  }

  /**
   * 取得現有向量題庫清單
   */
  static getEmbeddings() {
    if (typeof window !== 'undefined' && Array.isArray(window.QUESTION_EMBEDDINGS)) {
      return window.QUESTION_EMBEDDINGS;
    }
    return [];
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
        }

        // 科目吻合加權 (Domain Prior)
        if (subject && subject !== 'auto' && q.subject === subject) {
          score += 0.08;
        }
        // 年級相近微調加權
        if (grade && q.grade === String(grade)) {
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
      if (grade && q.grade === String(grade)) {
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
