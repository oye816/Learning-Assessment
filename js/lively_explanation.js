/**
 * 星耀國中學習評量系統 - AI 生動活潑名師解析與 Web Speech 國語語音朗讀系統 (Lively Explanation Engine)
 * 支援三種名師風格（星耀魔導師、生活名師、傲嬌學伴）、生活比喻、步驟拆解、避坑陷阱、一秒口訣與繁體臺灣國語語音朗讀
 */

(function () {
  'use strict';

  // 安全轉義 HTML 輔助函式
  function escapeHtml(str) {
    if (typeof str !== 'string') return str || '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==================== 國語語音發音朗讀 (Web Speech API) ====================
  let isSpeaking = false;
  let cachedVoices = [];

  // 效能優化：初始化時預快取語音清單，監聽 voiceschanged 事件避免每次點擊重複掃描
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        cachedVoices = window.speechSynthesis.getVoices();
      };
    } catch (e) {}
  }

  /**
   * 獲取最適宜的標準臺灣國語 (Mandarin zh-TW) 語音合成物件
   * 嚴格排除粵語 (zh-HK, yue) 與非中文語音
   */
  function getMandarinVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = (cachedVoices && cachedVoices.length > 0) ? cachedVoices : window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 優先順序 1：正統臺灣國語 (zh-TW, cmn-Hant-TW) 知名語音庫 (Mei-Jia, Yating, Hsiao-Chen, Zhiwei, Google 國語, Natural)
    const twPreferred = voices.find(v => {
      const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
      const name = (v.name || '').toLowerCase();
      const isTw = lang === 'zh-tw' || lang.startsWith('zh-tw') || lang === 'cmn-hant-tw' || lang === 'cmn-tw';
      return isTw && (name.includes('mei-jia') || name.includes('yating') || name.includes('hsiao-chen') || name.includes('zhiwei') || name.includes('google') || name.includes('natural'));
    });
    if (twPreferred) return twPreferred;

    // 優先順序 2：任一繁體臺灣國語語音 (zh-TW, cmn-Hant-TW)
    const twAny = voices.find(v => {
      const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
      return lang === 'zh-tw' || lang.startsWith('zh-tw') || lang === 'cmn-hant-tw' || lang === 'cmn-tw';
    });
    if (twAny) return twAny;

    // 優先順序 3：通用國語/普通話語音 (zh-CN, cmn-Hans, zh) 並嚴格排除粵語 (zh-HK, yue, Sin-Ji)
    const zhMandarin = voices.find(v => {
      const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
      const name = (v.name || '').toLowerCase();
      const isCantonese = lang === 'zh-hk' || lang === 'zh-mo' || lang.includes('yue') || name.includes('cantonese') || name.includes('sin-ji');
      return (lang.startsWith('zh') || lang.startsWith('cmn')) && !isCantonese;
    });
    if (zhMandarin) return zhMandarin;

    return null;
  }

  function stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    isSpeaking = false;
    stopLivelySpeaking();
    const icon = document.getElementById('speakIcon');
    const txt = document.getElementById('speakText');
    if (icon) icon.textContent = '🔊';
    if (txt) txt.textContent = '國語朗讀';
  }

  function toggleSpeakQuestion() {
    if (!('speechSynthesis' in window)) {
      if (typeof window.showToast === 'function') {
        window.showToast('您的瀏覽器目前未支援語音朗讀合成功能。', 'warning');
      }
      return;
    }

    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    const appState = window.appState || {};
    const b = appState.battle;
    if (!b || !b.questions) return;
    const q = b.questions[b.currentIndex];
    if (!q) return;

    stopSpeaking();

    // 整理國語朗讀文本（將數學與符號轉為口語化發音）
    let cleanStem = (q.stem || '').replace(/_{2,}/g, '空格');
    if (window.humanizeMath) {
      cleanStem = window.humanizeMath(cleanStem);
    }
    cleanStem = cleanStem.replace(/[\*\#\`\$\~]/g, '');

    let speechText = `題目：${cleanStem}。`;
    if (Array.isArray(q.options) && q.options.length > 0) {
      speechText += ' 請聽選項：' + q.options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        let cleanOpt = opt.replace(/^[A-D]\.\s*/, '');
        if (window.humanizeMath) cleanOpt = window.humanizeMath(cleanOpt);
        cleanOpt = cleanOpt.replace(/[\*\#\`\$\~]/g, '');
        return `選項 ${letter}，${cleanOpt}`;
      }).join('。') + '。';
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.98; // 清晰標準的國語語速

    const zhVoice = getMandarinVoice();
    if (zhVoice) utterance.voice = zhVoice;

    utterance.onstart = () => {
      isSpeaking = true;
      const icon = document.getElementById('speakIcon');
      const txt = document.getElementById('speakText');
      if (icon) icon.textContent = '⏹️';
      if (txt) txt.textContent = '停止朗讀';
    };

    utterance.onend = () => {
      stopSpeaking();
    };

    utterance.onerror = () => {
      stopSpeaking();
    };

    window.speechSynthesis.speak(utterance);
  }

  // ==================== AI 生動活潑名師解析系統 (Lively Explanation Engine) ====================
  let currentBattleLivelyData = null;
  let currentModalLivelyContext = null;
  let currentModalLivelyData = null;
  let isSpeakingLively = false;
  let currentLivelySpeechText = '';

  function buildLivelyCardHtml(data) {
    if (!data) return '';
    const { title, analogy, stepByStep, trapAnalysis, mnemonic, cheer } = data;
    return `
      <div class="space-y-3">
        <div class="flex items-center justify-between border-b border-amber-500/30 pb-2">
          <h4 class="font-extrabold text-amber-300 text-sm sm:text-base flex items-center gap-2">
            <span>✨</span>
            <span>${escapeHtml(title || 'AI 名師生動講解')}</span>
          </h4>
        </div>

        ${analogy ? `
          <div class="rounded-2xl bg-amber-950/30 border border-amber-500/40 p-4 space-y-1.5 shadow-sm">
            <div class="flex items-center gap-2 text-xs font-black text-amber-300">
              <span class="text-base">🧋</span>
              <span>【生活神比喻・秒懂核心】</span>
            </div>
            <p class="text-xs sm:text-sm text-amber-100 leading-relaxed font-medium">${escapeHtml(analogy).replace(/\n/g, '<br/>')}</p>
          </div>
        ` : ''}

        ${stepByStep ? `
          <div class="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-1.5">
            <div class="flex items-center gap-2 text-xs font-black text-emerald-400">
              <span class="text-base">🎯</span>
              <span>【風趣步驟拆解・正確答案這樣看】</span>
            </div>
            <p class="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">${escapeHtml(stepByStep).replace(/\n/g, '<br/>')}</p>
          </div>
        ` : ''}

        ${trapAnalysis ? `
          <div class="rounded-2xl bg-rose-950/30 border border-rose-500/30 p-4 space-y-1.5">
            <div class="flex items-center gap-2 text-xs font-black text-rose-300">
              <span class="text-base">🪤</span>
              <span>【避坑陷阱診斷・出題老師的心機】</span>
            </div>
            <p class="text-xs sm:text-sm text-rose-100/90 leading-relaxed font-medium">${escapeHtml(trapAnalysis).replace(/\n/g, '<br/>')}</p>
          </div>
        ` : ''}

        ${mnemonic ? `
          <div class="rounded-2xl bg-gradient-to-r from-violet-950/70 via-indigo-950/70 to-purple-950/70 border border-violet-500/50 p-4 text-center space-y-1 shadow-md">
            <div class="text-xs font-black text-violet-300 flex items-center justify-center gap-1.5">
              <span>📜</span>
              <span>【一秒破題記憶口訣】</span>
            </div>
            <p class="text-sm sm:text-base font-extrabold text-amber-200 tracking-wider">${escapeHtml(mnemonic)}</p>
          </div>
        ` : ''}

        ${cheer ? `
          <div class="flex items-center justify-between text-xs text-slate-300 bg-slate-900/60 rounded-xl px-3.5 py-2.5 border border-slate-800">
            <span class="text-amber-400 font-bold flex items-center gap-1.5">
              <span>💖</span>
              <span>名師悄悄話：</span>
            </span>
            <span class="font-medium text-slate-200">${escapeHtml(cheer)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  function stopLivelySpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    isSpeakingLively = false;
    const bIcon = document.getElementById('speakBattleLivelyIcon');
    const bTxt = document.getElementById('speakBattleLivelyText');
    if (bIcon) bIcon.textContent = '🔊';
    if (bTxt) bTxt.textContent = '語音聽講解';

    const mIcon = document.getElementById('speakModalLivelyIcon');
    const mTxt = document.getElementById('speakModalLivelyText');
    if (mIcon) mIcon.textContent = '🔊';
    if (mTxt) mTxt.textContent = '語音聽講解';
  }

  function speakLivelyText(text) {
    if (!('speechSynthesis' in window)) {
      if (typeof window.showToast === 'function') {
        window.showToast('您的瀏覽器目前未支援語音朗讀合成功能。', 'warning');
      }
      return;
    }
    stopSpeaking();
    stopLivelySpeaking();

    if (!text || !text.trim()) return;

    currentLivelySpeechText = text;
    const cleanText = text.replace(/[\*\#\`\$\~]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'zh-TW';
    utterance.rate = 1.0;

    const zhVoice = getMandarinVoice();
    if (zhVoice) utterance.voice = zhVoice;

    utterance.onstart = () => {
      isSpeakingLively = true;
      const bIcon = document.getElementById('speakBattleLivelyIcon');
      const bTxt = document.getElementById('speakBattleLivelyText');
      if (bIcon) bIcon.textContent = '⏹️';
      if (bTxt) bTxt.textContent = '停止朗讀';

      const mIcon = document.getElementById('speakModalLivelyIcon');
      const mTxt = document.getElementById('speakModalLivelyText');
      if (mIcon) mIcon.textContent = '⏹️';
      if (mTxt) mTxt.textContent = '停止朗讀';
    };

    utterance.onend = () => {
      stopLivelySpeaking();
    };

    utterance.onerror = () => {
      stopLivelySpeaking();
    };

    window.speechSynthesis.speak(utterance);
  }

  function toggleSpeakBattleLively() {
    if (isSpeakingLively) {
      stopLivelySpeaking();
    } else if (currentBattleLivelyData && currentBattleLivelyData.fullSpeech) {
      speakLivelyText(currentBattleLivelyData.fullSpeech);
    }
  }

  function toggleSpeakModalLively() {
    if (isSpeakingLively) {
      stopLivelySpeaking();
    } else if (currentModalLivelyData && currentModalLivelyData.fullSpeech) {
      speakLivelyText(currentModalLivelyData.fullSpeech);
    }
  }

  async function triggerBattleLivelyExplanation(forceRefresh = false) {
    const appState = window.appState || {};
    const b = appState.battle;
    if (!b || !b.questions || !b.questions[b.currentIndex]) {
      if (typeof window.showToast === 'function') window.showToast('目前無進行中的測驗題目', 'warning');
      return;
    }
    const q = b.questions[b.currentIndex];
    const styleSel = document.getElementById('battleLivelyStyleSelect');
    const style = styleSel ? styleSel.value : 'magic';

    // 若已有且未要求重載，直接展開
    const cardBox = document.getElementById('battleLivelyCardBox');
    const speakBtn = document.getElementById('btnSpeakBattleLively');
    if (currentBattleLivelyData && !forceRefresh && currentBattleLivelyData.persona === style) {
      if (cardBox) {
        cardBox.classList.remove('hidden');
        cardBox.innerHTML = buildLivelyCardHtml(currentBattleLivelyData);
      }
      if (speakBtn && currentBattleLivelyData.fullSpeech) speakBtn.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('btnTriggerBattleLively');
    const icon = document.getElementById('btnBattleLivelyIcon');
    const txt = document.getElementById('btnBattleLivelyText');
    if (btn) btn.disabled = true;
    if (icon) icon.textContent = '⏳';
    if (txt) txt.textContent = '名師構思中...';

    if (cardBox) {
      cardBox.classList.remove('hidden');
      cardBox.innerHTML = `
        <div class="text-center py-6 space-y-2">
          <div class="text-3xl animate-spin inline-block">🪄</div>
          <p class="text-xs sm:text-sm font-bold text-amber-300">星耀名師正在為您構思生活比喻與秒殺口訣...</p>
        </div>
      `;
    }

    try {
      const apiKey = window.GeminiService ? window.GeminiService.getApiKey() : '';
      const livelyData = await window.GeminiService.explainQuestionLively({
        question: q,
        userAnswer: b.lastAnswer !== undefined ? b.lastAnswer : null,
        isCorrect: b.lastIsCorrect !== undefined ? b.lastIsCorrect : null,
        style,
        apiKey
      });

      currentBattleLivelyData = livelyData;
      if (cardBox) {
        cardBox.innerHTML = buildLivelyCardHtml(livelyData);
      }
      if (speakBtn && livelyData.fullSpeech) {
        speakBtn.classList.remove('hidden');
      }
      if (typeof window.showToast === 'function') window.showToast('✨ AI 名師生動講解已就緒！', 'success');
    } catch (err) {
      console.error('生動講解生成失敗:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('生動解析載入失敗，已啟用精選備援解析', 'warning');
      }
      if (window.GeminiService) {
        const fallback = window.GeminiService.generateFallbackLivelyExplanation(
          q,
          b.lastAnswer !== undefined ? b.lastAnswer : null,
          b.lastIsCorrect !== undefined ? b.lastIsCorrect : null,
          style
        );
        currentBattleLivelyData = fallback;
        if (cardBox) cardBox.innerHTML = buildLivelyCardHtml(fallback);
        if (speakBtn && fallback.fullSpeech) speakBtn.classList.remove('hidden');
      }
    } finally {
      if (btn) btn.disabled = false;
      if (icon) icon.textContent = '🔄';
      if (txt) txt.textContent = '更換解析風格';
    }
  }

  function changeBattleLivelyStyle() {
    triggerBattleLivelyExplanation(true);
  }

  // --- Universal Lively Modal Handlers ---
  async function openLivelyExplanationModal(question, userAnswer = null, isCorrect = null) {
    if (!question) return;
    currentModalLivelyContext = { question, userAnswer, isCorrect };
    currentModalLivelyData = null;

    stopLivelySpeaking();

    const modal = document.getElementById('aiLivelyExplanationModal');
    const sumBox = document.getElementById('modalLivelyQuestionSummaryBox');
    const cardBox = document.getElementById('modalLivelyCardContentBox');
    const loadingBox = document.getElementById('modalLivelyLoadingBox');
    const speakBtn = document.getElementById('btnSpeakModalLively');

    if (speakBtn) speakBtn.classList.add('hidden');
    if (cardBox) cardBox.innerHTML = '';
    if (loadingBox) loadingBox.classList.remove('hidden');

    if (sumBox) {
      const subMeta = (window.SUBJECT_META && window.SUBJECT_META[question.subject]) || { name: '學科', icon: '📖', badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/40' };
      let statusBadge = '';
      if (userAnswer !== null && userAnswer !== undefined) {
        statusBadge = isCorrect
          ? '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ 學生作答正確</span>'
          : `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">❌ 學生作答選了 [${String.fromCharCode(65 + userAnswer)}]</span>`;
      }

      sumBox.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full font-bold ${subMeta.badgeClass || 'bg-violet-500/20 text-violet-300 border-violet-500/40'} border">${subMeta.icon} ${subMeta.name}</span>
            <span class="font-extrabold text-amber-300">【${escapeHtml(question.concept || '核心觀念')}】</span>
            <span class="text-slate-400 font-medium">${question.grade || '8'} 年級</span>
          </div>
          <div>${statusBadge}</div>
        </div>
        <p class="font-bold text-white text-xs sm:text-sm leading-relaxed">${escapeHtml(question.stem || '')}</p>
        ${Array.isArray(question.options) ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
            ${question.options.map((opt, i) => `
              <div class="p-2 rounded-xl font-bold border ${i === question.answer ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200' : 'bg-slate-950/60 border-slate-800 text-slate-300'}">
                ${i === question.answer ? '★ 正確解答：' : ''}${escapeHtml(opt)}
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;
    }

    if (modal) modal.classList.remove('hidden');

    await fetchAndRenderModalLively();
  }

  async function fetchAndRenderModalLively() {
    if (!currentModalLivelyContext || !currentModalLivelyContext.question) return;
    const { question, userAnswer, isCorrect } = currentModalLivelyContext;
    const styleSel = document.getElementById('modalLivelyStyleSelect');
    const style = styleSel ? styleSel.value : 'magic';

    const cardBox = document.getElementById('modalLivelyCardContentBox');
    const loadingBox = document.getElementById('modalLivelyLoadingBox');
    const speakBtn = document.getElementById('btnSpeakModalLively');

    if (loadingBox) loadingBox.classList.remove('hidden');
    if (cardBox) cardBox.innerHTML = '';
    if (speakBtn) speakBtn.classList.add('hidden');

    try {
      const apiKey = window.GeminiService ? window.GeminiService.getApiKey() : '';
      const livelyData = await window.GeminiService.explainQuestionLively({
        question,
        userAnswer,
        isCorrect,
        style,
        apiKey
      });
      currentModalLivelyData = livelyData;

      if (loadingBox) loadingBox.classList.add('hidden');
      if (cardBox) cardBox.innerHTML = buildLivelyCardHtml(livelyData);
      if (speakBtn && livelyData.fullSpeech) speakBtn.classList.remove('hidden');
    } catch (err) {
      console.error('生動解析載入失敗:', err);
      const fallback = window.GeminiService
        ? window.GeminiService.generateFallbackLivelyExplanation(question, userAnswer, isCorrect, style)
        : null;
      currentModalLivelyData = fallback;
      if (loadingBox) loadingBox.classList.add('hidden');
      if (cardBox && fallback) cardBox.innerHTML = buildLivelyCardHtml(fallback);
      if (speakBtn && fallback && fallback.fullSpeech) speakBtn.classList.remove('hidden');
    }
  }

  function changeModalLivelyStyle() {
    fetchAndRenderModalLively();
  }

  function closeLivelyExplanationModal() {
    stopLivelySpeaking();
    const modal = document.getElementById('aiLivelyExplanationModal');
    if (modal) modal.classList.add('hidden');
  }

  function openMistakeLivelyExplanation(mistakeId) {
    const appState = window.appState || {};
    const m = (appState.mistakes || []).find(item => item.id === mistakeId);
    if (!m) return;
    openLivelyExplanationModal(m, null, false);
  }

  function openHistoryLivelyExplanation(type, recordIdx, qIdx) {
    const appState = window.appState || {};
    const records = (type === 'admin') ? (appState.adminRecords || []) : (appState.personalRecords || []);
    const record = records[recordIdx];
    if (!record || !record.details || !record.details[qIdx]) return;
    const q = record.details[qIdx];
    const isCorr = (q.selectedAnswer !== null && q.selectedAnswer !== undefined)
      ? (q.selectedAnswer === q.correctAnswer)
      : (q.isCorrect || false);
    const formattedQ = {
      ...q,
      subject: q.subject || record.subject || 'math',
      grade: q.grade || record.grade || '8',
      answer: (q.correctAnswer !== undefined) ? q.correctAnswer : (q.answer !== undefined ? q.answer : 0)
    };
    openLivelyExplanationModal(formattedQ, q.selectedAnswer, isCorr);
  }

  function openAlchemyLivelyExplanation(idx) {
    const appState = window.appState || {};
    if (!appState.alchemyCurrentPack || !appState.alchemyCurrentPack.questions[idx]) return;
    const q = appState.alchemyCurrentPack.questions[idx];
    openLivelyExplanationModal(q, null, null);
  }

  // 掛載至 window
  window.getMandarinVoice = getMandarinVoice;
  window.stopSpeaking = stopSpeaking;
  window.toggleSpeakQuestion = toggleSpeakQuestion;
  window.stopLivelySpeaking = stopLivelySpeaking;
  window.speakLivelyText = speakLivelyText;
  window.toggleSpeakBattleLively = toggleSpeakBattleLively;
  window.toggleSpeakModalLively = toggleSpeakModalLively;
  window.triggerBattleLivelyExplanation = triggerBattleLivelyExplanation;
  window.changeBattleLivelyStyle = changeBattleLivelyStyle;
  window.openLivelyExplanationModal = openLivelyExplanationModal;
  window.fetchAndRenderModalLively = fetchAndRenderModalLively;
  window.changeModalLivelyStyle = changeModalLivelyStyle;
  window.closeLivelyExplanationModal = closeLivelyExplanationModal;
  window.openMistakeLivelyExplanation = openMistakeLivelyExplanation;
  window.openHistoryLivelyExplanation = openHistoryLivelyExplanation;
  window.openAlchemyLivelyExplanation = openAlchemyLivelyExplanation;
})();
