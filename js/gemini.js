// ==============================================================================
// 星耀國中冒險學院｜Gemini AI 智慧生題服務 (js/gemini.js)
// 
// 支援 BYOK (Bring Your Own Key) 模式與 Flash Lite 多模型切換：
// 支援模型包含：
// 1. Gemini 3.5 Flash Lite (gemini-3.5-flash-lite) - 預設推薦
// 2. Gemini 3.1 Flash Lite (gemini-3.1-flash-lite)
// 3. Gemini 2.5 Flash Lite (gemini-2.5-flash-lite)
// 使用者於網頁輸入個人的 Google AI Studio API Key，保存在瀏覽器端 localStorage，安全開源零成本。
// ==============================================================================

export class GeminiService {
  static STORAGE_KEY = 'jh_quest_gemini_api_key';
  static MODEL_STORAGE_KEY = 'jh_quest_gemini_model';
  static DEFAULT_MODEL = 'gemini-3.5-flash-lite';

  // 支援的 Flash Lite 系列模型清單
  static SUPPORTED_MODELS = [
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (預設推薦・極速省流思考)' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (輕量穩定・高性價比)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (經典輕量級模型)' }
  ];

  /**
   * 取得當前使用的 Gemini 模型名稱 (預設: gemini-3.5-flash-lite)
   */
  static getModel() {
    return localStorage.getItem(this.MODEL_STORAGE_KEY) || this.DEFAULT_MODEL;
  }

  /**
   * 設定使用者偏好的 Gemini 模型名稱
   */
  static setModel(modelName) {
    if (modelName && modelName.trim()) {
      localStorage.setItem(this.MODEL_STORAGE_KEY, modelName.trim());
    } else {
      localStorage.removeItem(this.MODEL_STORAGE_KEY);
    }
  }

  /**
   * 取得 Gemini REST API Endpoint URL
   */
  static getApiEndpoint(apiKey) {
    const model = this.getModel();
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  }

  /**
   * 取得儲存的 Gemini API Key (優先使用 localStorage，其次為全域預設值)
   */
  static getApiKey(fallbackKey = '') {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
    if (window.APP_CONFIG && window.APP_CONFIG.defaultGeminiApiKey) {
      return window.APP_CONFIG.defaultGeminiApiKey.trim();
    }
    return (fallbackKey || '').trim();
  }

  /**
   * 儲存使用者的 Gemini API Key
   */
  static setApiKey(key) {
    if (key && key.trim()) {
      localStorage.setItem(this.STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * 檢查是否已設定 API Key
   */
  static hasApiKey() {
    return !!this.getApiKey();
  }

  /**
   * 測試 API Key 與所選模型連線狀態
   */
  static async testConnection(key) {
    const apiKey = key || this.getApiKey();
    if (!apiKey) throw new Error('請先輸入 API Key！');

    const endpoint = this.getApiEndpoint(apiKey);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: '請回覆短詞「OK」測試連線。' }] }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP 錯誤碼: ${response.status}`);
    }
    return true;
  }

  /**
   * 使用 Gemini AI 生成評量試題包
   * @param {Object} params
   * @param {string} params.inputText 錯題內容、考試考點或核心概念
   * @param {string} params.subject 科目領域 (chinese, english, math, science, social)
   * @param {string} params.grade 目標年級 (7, 8, 9)
   * @param {string} params.style 生成難度/策略 (progressive, drill, boss)
   * @param {number} params.count 題目數量 (預設 4 題)
   */
  static async generateQuizPack({ inputText, subject, grade, style = 'progressive', count = 4 }) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('尚未設定 Gemini API Key！請點擊右上角「🤖 AI 金鑰」輸入您的 API Key。');
    }

    const subjectMap = {
      chinese: '國文科',
      english: '英文科',
      math: '數學科',
      science: '自然科學科（包含生物、理化、地球科學）',
      social: '社會科（包含歷史、地理、公民）'
    };

    const gradeMap = {
      '7': '國中七年級（國一）',
      '8': '國中八年級（國二）',
      '9': '國中九年級（國三會考總複習等級）'
    };

    const styleMap = {
      progressive: '階梯式闖關：第1題觀念拆解基礎題，第2題同型換數應用題，第3題情境素養題，第4題會考陷阱深化題',
      drill: '同型密集精熟：針對此觀念設計 4 題不同敘述與數字的平行對照題',
      boss: '高難度魔王陷阱：強調易混淆選項、逆向思考推論與素養導向題型'
    };

    const subjectName = subjectMap[subject] || '各科綜合';
    const gradeName = gradeMap[grade] || '國中八年級';
    const styleDesc = styleMap[style] || styleMap.progressive;

    const systemPrompt = `你是一位精通台灣國中教育會考與段考評量架構的頂尖名師兼出題專家。
請根據學生提供的錯題文字或觀念考點，為學生打造客製化練習試題包。

【基本設定】
- 領域科目：${subjectName}
- 適合學年：${gradeName}
- 出題策略：${styleDesc}
- 題目數量：恰好 ${count} 題單選題（選項 A、B、C、D 共 4 個）

【嚴格格式要求】
請務必輸出合法的 JSON 物件，嚴禁包含任何額外的解釋文字或 Markdown 標籤（請勿使用 \`\`\`json 或 \`\`\`）。
JSON 結構必須精確符合以下規格：
{
  "concept": "精闢濃縮的考點核心名稱（例如：畢氏定理應用、現在完成式 since/for 判別、莫耳濃度計算）",
  "topicTitle": "本次試題包主題名稱（例如：畢氏定理進階實戰特訓、現在完成式易混淆對決）",
  "coreConcept": "針對學生卡關核心觀念的清晰拆解剖析（100字內）",
  "commonTrap": "學生在段考或會考此題型最常掉入的思維與計算陷阱（100字內）",
  "mnemonic": "秒殺解題口訣或破題心法（親切幽默，帶有RPG冒險風格，50字內）",
  "questions": [
    {
      "concept": "本題測驗的小重點",
      "stem": "清晰嚴謹的題目敘述（繁體中文，符合台灣國中段考/會考試題用語風格）",
      "options": [
        "A. 選項內容",
        "B. 選項內容",
        "C. 選項內容",
        "D. 選項內容"
      ],
      "answer": 0, // 正確答案在 options 中的索引 (0, 1, 2 或 3)
      "hint": "提示引導（不直接說出答案，提示思考方向）",
      "explanation": "詳細步驟拆解與解題過程（包含為什麼此選項正確、其他選項的盲點）"
    }
  ]
}`;

    const userPrompt = `【學生輸入的錯題或想複習的弱點觀念】\n${inputText}`;

    const endpoint = this.getApiEndpoint(apiKey);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `HTTP ${response.status}`;
      throw new Error(`Gemini AI 出題失敗 (${this.getModel()})：${msg}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini API 未回傳有效題目內容。');
    }

    try {
      const parsed = JSON.parse(rawText);
      const cleanSubject = subject || 'math';
      const cleanSubjectName = subjectMap[cleanSubject] || '各科綜合';

      // 補齊與 index.html 渲染介面相容之主題與拆解欄位
      parsed.subject = cleanSubject;
      parsed.subjectName = cleanSubjectName;
      parsed.grade = grade || '8';
      parsed.topicTitle = parsed.topicTitle || parsed.concept || 'AI 客製化弱點突破試題包';
      parsed.coreConcept = parsed.coreConcept || parsed.concept || '考點核心觀念聚焦';
      parsed.commonTrap = parsed.commonTrap || '易混淆概念、計算盲點與審題陷阱';
      parsed.mnemonic = parsed.mnemonic || parsed.coreAnalysis || '🔮 破題心法：掌握核心概念，逐一排除干擾選項！';
      parsed.isAIGenerated = true;
      parsed.modelUsed = this.getModel();

      if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error('回傳之題目列表為空。');
      }

      // 確保每道題皆具備所屬科目與年級，防止存入錯題本時被誤判為其他科目
      parsed.questions.forEach((q, idx) => {
        q.id = `gemini-${Date.now()}-${idx}`;
        q.subject = cleanSubject;
        q.grade = grade || '8';
        if (!q.concept) q.concept = parsed.concept || '核心考點';
      });

      return parsed;
    } catch (parseError) {
      console.error('JSON Parse Error, Raw:', rawText);
      throw new Error('解析 AI 回傳題目 JSON 失敗，請重試一次。');
    }
  }
}

// 掛載至 window 供全域使用
window.GeminiService = GeminiService;
