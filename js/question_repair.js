/**
 * 星耀國中學習評量系統 - AI 題目修正與生題異常除錯中心模組 (Question Repair Workbench & Anomaly Center)
 * 提供生題異常追蹤、除錯 JSON 匯出、AI 題目修正工作台、以及跨測驗/錯題本/歷史紀錄之一鍵替換與 RAG 典範收錄
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

  // ==================== 生題異常紀錄 (Generation Anomalies) 處理邏輯 ====================
  function updateAnomalyCountBadge() {
    const badge = document.getElementById('anomalyCountBadge');
    if (!badge) return;
    if (!window.GeminiService || typeof window.GeminiService.getAnomalies !== 'function') {
      badge.classList.add('hidden');
      return;
    }
    const list = window.GeminiService.getAnomalies();
    const unresolvedCount = list.filter(item => item.status !== 'repaired').length;
    if (list.length > 0) {
      badge.textContent = unresolvedCount > 0 ? `${unresolvedCount}` : '✓';
      badge.className = unresolvedCount > 0
        ? 'px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black'
        : 'px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black';
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function openGenerationAnomaliesModal() {
    renderGenerationAnomaliesList();
    const modal = document.getElementById('generationAnomaliesModal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeGenerationAnomaliesModal() {
    const modal = document.getElementById('generationAnomaliesModal');
    if (modal) modal.classList.add('hidden');
  }

  function renderGenerationAnomaliesList() {
    const container = document.getElementById('generationAnomaliesListContainer');
    if (!container || !window.GeminiService) return;

    const list = window.GeminiService.getAnomalies();
    updateAnomalyCountBadge();

    if (list.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 px-4 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800">
          <span class="text-3xl">🎉</span>
          <h4 class="text-white font-extrabold text-sm sm:text-base mt-2">太棒了！目前無任何生題異常紀錄</h4>
          <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            當 AI 智慧生題過程遇到網路問題、JSON 格式解析錯誤、或題目缺少選項等異常時，系統會自動捕捉並記錄於此，提供一鍵除錯與 AI 自動修復！
          </p>
        </div>
      `;
      return;
    }

    const stageLabels = {
      network: { text: '🌐 網路/金鑰異常', bg: 'bg-rose-950/70 text-rose-300 border-rose-800/60' },
      json_parse: { text: '⚠️ JSON 解析失敗', bg: 'bg-amber-950/70 text-amber-300 border-amber-800/60' },
      schema_validation: { text: '📐 題目規格瑕疵', bg: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60' },
      generation: { text: '⚙️ 模型生成異常', bg: 'bg-purple-950/70 text-purple-300 border-purple-800/60' },
      user_reported: { text: '🙋 學生回報瑕疵', bg: 'bg-sky-950/70 text-sky-300 border-sky-800/60' }
    };

    container.innerHTML = list.map(item => {
      const stageMeta = stageLabels[item.stage] || { text: item.stage || '生題異常', bg: 'bg-slate-800 text-slate-300 border-slate-700' };
      const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : '未知時間';
      const isRepaired = item.status === 'repaired';
      const hasFaultyQ = !!(item.faultyQuestion && (item.faultyQuestion.stem || item.faultyQuestion.options));
      const canAiRepair = hasFaultyQ || (item.rawResponse && item.rawResponse.length > 20);

      return `
        <div class="bg-slate-950/90 rounded-2xl p-4 sm:p-5 border ${isRepaired ? 'border-emerald-500/40' : 'border-slate-800 hover:border-rose-500/40'} transition-all space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-lg border text-xs font-bold ${stageMeta.bg}">
                ${stageMeta.text}
              </span>
              <span class="text-xs text-slate-400">${timeStr}</span>
            </div>
            <div class="flex items-center gap-1.5">
              ${isRepaired ? `
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-extrabold flex items-center gap-1">
                  <span>✓</span> <span>已修復重構</span>
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
                  待處理
                </span>
              `}
              <button type="button" onclick="window.copySingleAnomalyJson('${item.id}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold" title="複製此筆除錯 JSON">
                📋
              </button>
              <button type="button" onclick="window.deleteSingleAnomaly('${item.id}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-600 text-slate-400 hover:text-rose-300 text-xs" title="刪除此筆記錄">
                🗑️
              </button>
            </div>
          </div>

          <div class="text-xs text-rose-300 font-bold bg-rose-950/30 p-2.5 rounded-xl border border-rose-900/40">
            ❌ 異常原因：${escapeHtml(item.errorReason || '未提供具體原因')}
          </div>

          ${item.inputText ? `
            <div class="text-xs text-slate-400 bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <span class="text-slate-300 font-bold">輸入考點：</span>${escapeHtml(item.inputText)}
            </div>
          ` : ''}

          ${hasFaultyQ ? `
            <div class="text-xs bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-2">
              <div class="text-slate-400 font-bold flex items-center justify-between">
                <span>⚠️ 捕捉到的瑕疵題目內容：</span>
                <span class="text-slate-500 text-[11px]">考點：${escapeHtml(item.faultyQuestion.concept || '觀念')}</span>
              </div>
              <p class="text-white font-medium leading-relaxed">${escapeHtml(item.faultyQuestion.stem || '(無題幹)')}</p>
              ${Array.isArray(item.faultyQuestion.options) ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-400">
                  ${item.faultyQuestion.options.map(opt => `<div class="p-1.5 rounded bg-slate-950 border border-slate-800">${escapeHtml(opt)}</div>`).join('')}
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${isRepaired && item.repairedQuestion ? `
            <div class="text-xs bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/50 space-y-2">
              <div class="text-emerald-300 font-bold flex items-center justify-between">
                <span>✨ AI 修復後題型成果：</span>
                <span class="text-emerald-400 text-[11px]">四選一單選題</span>
              </div>
              <p class="text-white font-bold leading-relaxed">${escapeHtml(item.repairedQuestion.stem)}</p>
              ${(item.repairedQuestion.diagramSvg && typeof window.renderSafeSvg === 'function') ? window.renderSafeSvg(item.repairedQuestion.diagramSvg, '修復圖形') : ''}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                ${(item.repairedQuestion.options || []).map((opt, oi) => `
                  <div class="p-1.5 rounded border ${oi === item.repairedQuestion.answer ? 'bg-emerald-900/50 border-emerald-500 text-emerald-200 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300'}">
                    ${escapeHtml(opt)}
                  </div>
                `).join('')}
              </div>
              ${item.repairNote ? `<div class="text-[11px] text-emerald-400 font-semibold">備註：${escapeHtml(item.repairNote)}</div>` : ''}
            </div>
          ` : ''}

          <div class="flex items-center justify-end gap-2 pt-1">
            ${canAiRepair ? `
              <button type="button" onclick="window.launchRepairFromAnomaly('${item.id}')" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:brightness-110 text-white text-xs font-bold shadow flex items-center gap-1.5 transition-transform active:scale-95">
                <span>🔧</span>
                <span>${isRepaired ? '重新修復重構' : '召喚 AI 修正此題'}</span>
              </button>
            ` : `
              <span class="text-[11px] text-slate-500">無可修復題目內文</span>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  function clearAllGenerationAnomalies() {
    if (!window.GeminiService || typeof window.GeminiService.clearAnomalies !== 'function') return;
    const list = window.GeminiService.getAnomalies();
    if (list.length === 0) {
      if (typeof window.showToast === 'function') window.showToast('目前無任何生題異常紀錄', 'info');
      return;
    }
    if (confirm('確定要清空所有生題異常紀錄嗎？（清空後將無法復原）')) {
      window.GeminiService.clearAnomalies();
      renderGenerationAnomaliesList();
      if (typeof window.showToast === 'function') window.showToast('🗑️ 已清空所有生題異常紀錄！', 'info');
    }
  }

  function deleteSingleAnomaly(id) {
    if (!window.GeminiService || typeof window.GeminiService.deleteAnomaly !== 'function') return;
    window.GeminiService.deleteAnomaly(id);
    renderGenerationAnomaliesList();
    if (typeof window.showToast === 'function') window.showToast('🗑️ 已刪除該筆異常紀錄！', 'info');
  }

  function copyAllAnomaliesJson() {
    const list = window.GeminiService ? window.GeminiService.getAnomalies() : [];
    if (list.length === 0) {
      if (typeof window.showToast === 'function') window.showToast('目前無任何異常資料可複製', 'info');
      return;
    }
    navigator.clipboard.writeText(JSON.stringify(list, null, 2)).then(() => {
      if (typeof window.showToast === 'function') window.showToast(`📋 已複製全部 ${list.length} 筆異常除錯 JSON！`, 'success');
    }).catch(() => {
      if (typeof window.showToast === 'function') window.showToast('複製失敗，請手動複製', 'danger');
    });
  }

  function copySingleAnomalyJson(id) {
    const list = window.GeminiService ? window.GeminiService.getAnomalies() : [];
    const item = list.find(x => x.id === id);
    if (!item) return;
    navigator.clipboard.writeText(JSON.stringify(item, null, 2)).then(() => {
      if (typeof window.showToast === 'function') window.showToast('📋 已複製該筆異常除錯 JSON！', 'success');
    }).catch(() => {});
  }

  // ==================== AI 題目修正工作台 (AI Repair Workbench) ====================
  let currentRepairContext = {
    sourceType: 'alchemy', // 'alchemy' | 'battle' | 'mistake' | 'history' | 'anomaly' | 'general'
    targetIdx: -1,
    sourceId: null,
    anomalyId: null,
    faultyQuestion: null,
    repairedQuestion: null,
    subject: 'math',
    grade: '8'
  };

  function openQuestionRepairModal(idxOrObject, errorReason = '', anomalyId = null, sourceType = 'alchemy', sourceId = null) {
    let targetQ = null;
    let targetIdx = -1;
    let sub = 'math';
    let grd = '8';

    const appState = window.appState || {};

    if (sourceType === 'battle') {
      if (appState.battle && appState.battle.questions && appState.battle.questions[appState.battle.currentIndex]) {
        targetQ = appState.battle.questions[appState.battle.currentIndex];
        targetIdx = appState.battle.currentIndex;
        sub = targetQ.subject || appState.battle.subject || 'math';
        grd = targetQ.grade || '8';
      }
    } else if (typeof idxOrObject === 'number') {
      targetIdx = idxOrObject;
      if (appState.alchemyCurrentPack && appState.alchemyCurrentPack.questions[targetIdx]) {
        targetQ = appState.alchemyCurrentPack.questions[targetIdx];
        sub = targetQ.subject || appState.alchemyCurrentPack.subject || 'math';
        grd = targetQ.grade || appState.alchemyCurrentPack.grade || '8';
      }
    } else if (idxOrObject && typeof idxOrObject === 'object') {
      targetQ = idxOrObject;
      sub = targetQ.subject || 'math';
      grd = targetQ.grade || '8';
      targetIdx = typeof sourceId === 'number' ? sourceId : -1;
    }

    if (!targetQ) {
      if (typeof window.showToast === 'function') window.showToast('找不到待修復題目資料', 'warning');
      return;
    }

    currentRepairContext = {
      sourceType: sourceType || 'alchemy',
      targetIdx,
      sourceId,
      anomalyId,
      faultyQuestion: JSON.parse(JSON.stringify(targetQ)),
      repairedQuestion: null,
      errorReason: errorReason || '',
      subject: sub,
      grade: grd
    };

    // 渲染原始題目預覽
    const origBox = document.getElementById('repairOriginalQuestionBox');
    if (origBox) {
      const sourceLabels = {
        battle: '⚔️ 正在進行的測驗題目',
        alchemy: '⚗️ AI 試題包練習題',
        mistake: '📖 錯題本收錄題',
        history: '📋 評量歷史明細題',
        anomaly: '⚠️ 生題異常記錄題',
        general: '📋 評量題目'
      };
      const srcLabel = sourceLabels[sourceType] || '題目';
      origBox.innerHTML = `
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span class="font-bold text-amber-300">【${srcLabel}・考點：${escapeHtml(targetQ.concept || '觀念')}】</span>
          <span>${escapeHtml(sub)}・${escapeHtml(grd)}年級</span>
        </div>
        <p class="font-bold text-white text-sm sm:text-base leading-relaxed">${escapeHtml(targetQ.stem || '(題幹為空或異常)')}</p>
        ${(targetQ.diagramSvg && typeof window.renderSafeSvg === 'function') ? window.renderSafeSvg(targetQ.diagramSvg, '原題圖形') : ''}
        ${Array.isArray(targetQ.options) ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            ${targetQ.options.map(opt => `<div class="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">${escapeHtml(opt)}</div>`).join('')}
          </div>
        ` : '<div class="text-rose-400 text-xs">⚠️ 選項缺失或非陣列</div>'}
        ${errorReason ? `<div class="text-rose-400 font-bold text-xs">修正焦點：${escapeHtml(errorReason)}</div>` : ''}
      `;
    }

    // 動態更新替換按鈕文字
    const applyBtn = document.getElementById('btnApplyRepairedToPack');
    if (applyBtn) {
      if (sourceType === 'battle') {
        applyBtn.textContent = '✅ 替換至當前測驗題目';
        applyBtn.style.display = 'inline-flex';
      } else if (sourceType === 'mistake') {
        applyBtn.textContent = '✅ 更新至我的錯題本';
        applyBtn.style.display = 'inline-flex';
      } else if (sourceType === 'history') {
        applyBtn.textContent = '✅ 更新至歷史紀錄題目';
        applyBtn.style.display = 'inline-flex';
      } else if (sourceType === 'alchemy' && targetIdx >= 0) {
        applyBtn.textContent = '✅ 替換至當前試題包';
        applyBtn.style.display = 'inline-flex';
      } else {
        applyBtn.style.display = 'none';
      }
    }

    // 重設輸入框與結果區
    const inputEl = document.getElementById('repairUserInstructionInput');
    if (inputEl) inputEl.value = errorReason ? `請特別修正此問題：${errorReason}` : '';

    const resBox = document.getElementById('repairedResultContainer');
    if (resBox) resBox.classList.add('hidden');

    const modal = document.getElementById('questionRepairModal');
    if (modal) modal.classList.remove('hidden');
  }

  function openBattleQuestionRepairModal() {
    const appState = window.appState || {};
    const b = appState.battle;
    if (!b || !b.questions || !b.questions[b.currentIndex]) {
      if (typeof window.showToast === 'function') window.showToast('目前無進行中的測驗題目', 'warning');
      return;
    }
    const curQ = b.questions[b.currentIndex];
    openQuestionRepairModal(curQ, '測驗作答題目內容優化', null, 'battle', b.currentIndex);
  }

  function openMistakeQuestionRepairModal(mistakeId) {
    const appState = window.appState || {};
    const m = (appState.mistakes || []).find(item => item.id === mistakeId);
    if (!m) return;
    openQuestionRepairModal(m, '錯題本題目優化與排版修復', null, 'mistake', mistakeId);
  }

  async function saveCurrentBattleQuestionToRag() {
    const appState = window.appState || {};
    const b = appState.battle;
    if (!b || !b.questions || !b.questions[b.currentIndex]) return;
    const q = b.questions[b.currentIndex];
    if (!window.RagEngine) return;

    const btn = document.getElementById('btnBattleSaveToRag');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> <span>收錄中...</span>';
    }

    try {
      const apiKey = window.GeminiService ? window.GeminiService.getApiKey() : '';
      await window.RagEngine.addCustomQuestion({
        ...q,
        subject: q.subject || b.subject || 'math',
        grade: q.grade || '8',
        school: q.school || (q.isRepaired ? 'AI 測驗修正題型' : 'AI 測驗精選典範'),
        source: q.isRepaired ? 'ai_repaired' : 'ai_curated'
      }, apiKey, appState.currentUser);

      if (typeof window.updateCustomRagCountBadge === 'function') window.updateCustomRagCountBadge();
      if (typeof window.showToast === 'function') {
        window.showToast('✨ 測驗題目已成功收錄至 RAG 典範題庫！未來出題將自動參考此題型！', 'success');
      }

      if (btn) {
        btn.className = 'px-3 py-2 rounded-xl bg-emerald-950/70 border border-emerald-600/70 text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-1.5';
        btn.innerHTML = '<span>✓</span> <span>已為 RAG 典範</span>';
      }
    } catch (err) {
      console.error('收錄 RAG 失敗:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('❌ 收錄 RAG 失敗: ' + (err.message || '請稍後再試'), 'danger');
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>📥</span> <span>納入 RAG</span>';
      }
    }
  }

  async function saveMistakeQuestionToRag(mistakeId) {
    const appState = window.appState || {};
    const m = (appState.mistakes || []).find(item => item.id === mistakeId);
    if (!m || !window.RagEngine) return;

    const btn = document.getElementById(`btnMistakeSaveToRag-${mistakeId}`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> <span>收錄中...</span>';
    }

    try {
      const apiKey = window.GeminiService ? window.GeminiService.getApiKey() : '';
      await window.RagEngine.addCustomQuestion({
        ...m,
        school: m.school || (m.isRepaired ? 'AI 錯題修正題型' : 'AI 錯題典範'),
        source: m.isRepaired ? 'ai_repaired' : 'ai_curated'
      }, apiKey, appState.currentUser);

      if (typeof window.updateCustomRagCountBadge === 'function') window.updateCustomRagCountBadge();
      if (typeof window.showToast === 'function') {
        window.showToast('✨ 錯題已成功收錄至 RAG 典範題庫！未來生題將自動參考此題型！', 'success');
      }

      if (btn) {
        btn.className = 'px-2.5 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-600/70 text-emerald-300 text-xs font-bold flex items-center gap-1';
        btn.innerHTML = '<span>✓</span> <span>已為 RAG 典範</span>';
      }
    } catch (err) {
      console.error('錯題收錄 RAG 失敗:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('❌ 收錄 RAG 失敗: ' + (err.message || '請稍後再試'), 'danger');
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>📥</span> <span>納入 RAG</span>';
      }
    }
  }

  function openHistoryQuestionRepairModal(type, recordIdx, qIdx) {
    const appState = window.appState || {};
    const records = (type === 'admin') ? (appState.adminRecords || []) : (appState.personalRecords || []);
    const record = records[recordIdx];
    if (!record || !record.details || !record.details[qIdx]) {
      if (typeof window.showToast === 'function') window.showToast('找不到該筆歷史評量題目', 'warning');
      return;
    }
    const q = record.details[qIdx];
    const formattedQ = {
      ...q,
      subject: q.subject || record.subject || 'math',
      grade: q.grade || record.grade || '8',
      answer: (q.correctAnswer !== undefined) ? q.correctAnswer : (q.answer !== undefined ? q.answer : 0)
    };
    openQuestionRepairModal(formattedQ, '歷史評量題目優化與排版修復', null, 'history', { type, recordIdx, qIdx });
  }

  async function saveHistoryQuestionToRag(type, recordIdx, qIdx) {
    const appState = window.appState || {};
    const records = (type === 'admin') ? (appState.adminRecords || []) : (appState.personalRecords || []);
    const record = records[recordIdx];
    if (!record || !record.details || !record.details[qIdx]) return;
    const q = record.details[qIdx];
    if (!window.RagEngine) return;

    const btn = document.getElementById(`btnHistorySaveToRag-${recordIdx}-${qIdx}`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> <span>收錄中...</span>';
    }

    try {
      const apiKey = window.GeminiService ? window.GeminiService.getApiKey() : '';
      await window.RagEngine.addCustomQuestion({
        ...q,
        subject: q.subject || record.subject || 'math',
        grade: q.grade || record.grade || '8',
        school: q.school || (q.isRepaired ? 'AI 歷史修正題型' : 'AI 歷史評量典範'),
        source: q.isRepaired ? 'ai_repaired' : 'ai_curated'
      }, apiKey, appState.currentUser);

      if (typeof window.updateCustomRagCountBadge === 'function') window.updateCustomRagCountBadge();
      if (typeof window.showToast === 'function') {
        window.showToast('✨ 歷史題目已成功收錄至 RAG 典範題庫！未來出題將自動參考此題型！', 'success');
      }

      if (btn) {
        btn.className = 'px-2.5 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-600/70 text-emerald-300 text-xs font-bold flex items-center gap-1';
        btn.innerHTML = '<span>✓</span> <span>已為 RAG 典範</span>';
      }
    } catch (err) {
      console.error('收錄 RAG 失敗:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('❌ 收錄 RAG 失敗: ' + (err.message || '請稍後再試'), 'danger');
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>📥</span> <span>納入 RAG</span>';
      }
    }
  }

  function closeQuestionRepairModal() {
    const modal = document.getElementById('questionRepairModal');
    if (modal) modal.classList.add('hidden');
  }

  function applyRepairTag(tagText) {
    const inputEl = document.getElementById('repairUserInstructionInput');
    if (!inputEl) return;
    if (inputEl.value.trim()) {
      inputEl.value += '；' + tagText;
    } else {
      inputEl.value = tagText;
    }
    inputEl.focus();
  }

  function launchRepairFromAnomaly(anomalyId) {
    const list = window.GeminiService ? window.GeminiService.getAnomalies() : [];
    const item = list.find(x => x.id === anomalyId);
    if (!item) return;

    closeGenerationAnomaliesModal();

    let targetQ = item.faultyQuestion;
    if (!targetQ && item.rawResponse) {
      targetQ = {
        stem: item.inputText || '請重構此題目',
        rawResponse: item.rawResponse
      };
    }

    openQuestionRepairModal(targetQ, item.errorReason, anomalyId, 'anomaly');
  }

  async function executeQuestionRepair() {
    if (!window.GeminiService) return;
    const apiKey = window.GeminiService.getApiKey();
    if (!apiKey) {
      if (typeof window.showToast === 'function') window.showToast('請先設定 Gemini API Key！', 'warning');
      if (typeof window.openGeminiKeyModal === 'function') window.openGeminiKeyModal();
      return;
    }

    const inputEl = document.getElementById('repairUserInstructionInput');
    const userInstruction = inputEl ? inputEl.value.trim() : '';

    const btn = document.getElementById('btnExecuteRepair');
    const icon = document.getElementById('repairBtnIcon');
    const text = document.getElementById('repairBtnText');
    if (btn) btn.disabled = true;
    if (icon) icon.textContent = '⏳';
    if (text) text.textContent = 'AI 正在分析命題並精密修復中...';

    try {
      const repaired = await window.GeminiService.repairQuestion({
        faultyQuestion: currentRepairContext.faultyQuestion,
        errorReason: currentRepairContext.errorReason,
        userInstruction: userInstruction,
        subject: currentRepairContext.subject,
        grade: currentRepairContext.grade,
        apiKey
      });

      currentRepairContext.repairedQuestion = repaired;

      // 若是由生題異常啟動，自動更新該異常紀錄
      if (currentRepairContext.anomalyId) {
        window.GeminiService.updateAnomaly(currentRepairContext.anomalyId, {
          status: 'repaired',
          repairedQuestion: repaired,
          repairNote: repaired.repairNote || '由 AI 題目修正工作台修復完成'
        });
        updateAnomalyCountBadge();
      }

      // 渲染修復成果卡片
      const cardBox = document.getElementById('repairedQuestionCardBox');
      const noteBadge = document.getElementById('repairNoteBadge');
      if (noteBadge) {
        noteBadge.textContent = repaired.repairNote ? `優化：${repaired.repairNote}` : '✓ 修復符合嚴格題庫標準';
      }
      if (cardBox) {
        const optsHtml = (repaired.options || []).map((opt, i) => `
          <div class="p-3 rounded-xl ${i === repaired.answer ? 'bg-emerald-950/70 border-emerald-500/70 text-emerald-200 font-bold' : 'bg-slate-900 border-slate-700/80 text-slate-300'} border text-xs sm:text-sm flex items-center justify-between">
            <span>${escapeHtml(opt)}</span>
            ${i === repaired.answer ? '<span class="text-xs text-emerald-400 font-black">✓ 正確答案</span>' : ''}
          </div>
        `).join('');

        cardBox.innerHTML = `
          <div class="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
            <span class="font-extrabold text-amber-300">【${escapeHtml(repaired.concept || '核心考點')}】</span>
            <span class="text-emerald-400 font-bold">4 選項標準單選題</span>
          </div>
          <p class="q-stem-scalable font-bold text-white text-sm sm:text-base leading-relaxed tracking-wide">${escapeHtml(repaired.stem)}</p>
          ${(repaired.diagramSvg && typeof window.renderSafeSvg === 'function') ? window.renderSafeSvg(repaired.diagramSvg, '修復後 SVG 圖形') : ''}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            ${optsHtml}
          </div>
          <div class="text-xs text-slate-300 bg-slate-900/80 rounded-xl p-3 border border-slate-800 space-y-1">
            <div><strong class="text-amber-400">💡 破題提示：</strong>${escapeHtml(repaired.hint || '掌握題幹關鍵條件。')}</div>
            <div><strong class="text-emerald-400">📝 詳解推導：</strong>${escapeHtml(repaired.explanation || '依據題意與定義逐步推論。')}</div>
          </div>
        `;
      }

      const resBox = document.getElementById('repairedResultContainer');
      if (resBox) {
        resBox.classList.remove('hidden');
        resBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      if (typeof window.showToast === 'function') {
        window.showToast('✨ AI 題目修復完成！可直接替換或納入 RAG 典範庫！', 'success');
      }
    } catch (err) {
      console.error('修復失敗:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('❌ 題目修復失敗：' + (err.message || '請檢查連線或 API Key'), 'danger');
      }
    } finally {
      if (btn) btn.disabled = false;
      if (icon) icon.textContent = '🚀';
      if (text) text.textContent = '召喚 AI 修正並重構此題';
    }
  }

  function applyRepairedQuestionToPack() {
    const rep = currentRepairContext.repairedQuestion;
    if (!rep) {
      if (typeof window.showToast === 'function') window.showToast('尚無修復後的題目資料', 'warning');
      return;
    }
    rep.isRepaired = true;
    const appState = window.appState || {};

    // 依來源分支更新
    if (currentRepairContext.sourceType === 'battle') {
      const b = appState.battle;
      if (b && b.questions && b.questions[b.currentIndex]) {
        b.questions[b.currentIndex] = rep;
        // 若本題尚未作答，重設刪去秘藥與選項
        b.disabledOptions = [];
        if (typeof window.renderBattleState === 'function') window.renderBattleState();
        closeQuestionRepairModal();
        if (typeof window.showToast === 'function') {
          window.showToast('✨ 當前測驗題目已成功修正更新！可直接繼續作答！', 'success');
        }
        return;
      }
    } else if (currentRepairContext.sourceType === 'mistake') {
      const mId = currentRepairContext.sourceId;
      const mIdx = (appState.mistakes || []).findIndex(m => m.id === mId);
      if (mIdx >= 0) {
        appState.mistakes[mIdx] = { ...appState.mistakes[mIdx], ...rep, id: mId };
        if (typeof window.renderMistakes === 'function') window.renderMistakes();
        if (typeof window.saveState === 'function') window.saveState();
        closeQuestionRepairModal();
        if (typeof window.showToast === 'function') {
          window.showToast('✨ 錯題本題目已成功更新！', 'success');
        }
        return;
      }
    } else if (currentRepairContext.sourceType === 'history') {
      const hInfo = currentRepairContext.sourceId; // { type, recordIdx, qIdx }
      if (hInfo) {
        const records = (hInfo.type === 'admin') ? (appState.adminRecords || []) : (appState.personalRecords || []);
        const record = records[hInfo.recordIdx];
        if (record && record.details && record.details[hInfo.qIdx]) {
          record.details[hInfo.qIdx] = {
            ...record.details[hInfo.qIdx],
            ...rep,
            correctAnswer: (rep.answer !== undefined ? rep.answer : record.details[hInfo.qIdx].correctAnswer),
            isRepaired: true
          };
          if (typeof window.openRecordDetailModal === 'function') {
            window.openRecordDetailModal(hInfo.type, hInfo.recordIdx);
          }
          if (typeof window.saveState === 'function') window.saveState();
          closeQuestionRepairModal();
          if (typeof window.showToast === 'function') {
            window.showToast('✨ 歷史評量題目已成功修正更新！', 'success');
          }
          return;
        }
      }
    } else if (currentRepairContext.sourceType === 'alchemy') {
      const tIdx = currentRepairContext.targetIdx;
      if (tIdx >= 0 && appState.alchemyCurrentPack && appState.alchemyCurrentPack.questions[tIdx]) {
        appState.alchemyCurrentPack.questions[tIdx] = rep;
        if (typeof window.renderAlchemyPackOutput === 'function') {
          window.renderAlchemyPackOutput(appState.alchemyCurrentPack);
        }
        closeQuestionRepairModal();
        if (typeof window.showToast === 'function') {
          window.showToast(`✨ 第 ${tIdx + 1} 題已成功替換為 AI 修復後的高素養試題！`, 'success');
        }
        return;
      }
    }

    closeQuestionRepairModal();
    if (typeof window.showToast === 'function') window.showToast('✨ 題目已成功修正！', 'success');
  }

  async function applyRepairedQuestionAndSaveToRag() {
    const rep = currentRepairContext.repairedQuestion;
    if (!rep) {
      if (typeof window.showToast === 'function') window.showToast('尚無修復後的題目資料', 'warning');
      return;
    }

    // 替換當前來源
    applyRepairedQuestionToPack();

    if (window.RagEngine) {
      try {
        const apiKey = window.GeminiService ? window.GeminiService.getApiKey() : '';
        const schoolTag = currentRepairContext.sourceType === 'battle' ? 'AI 測驗修正題型' : 
                          (currentRepairContext.sourceType === 'history' ? 'AI 歷史紀錄修正題型' : 
                          (currentRepairContext.sourceType === 'mistake' ? 'AI 錯題修正題型' : 'AI 修正題型典範'));
        const appState = window.appState || {};
        await window.RagEngine.addCustomQuestion({
          ...rep,
          subject: rep.subject || currentRepairContext.subject,
          grade: rep.grade || currentRepairContext.grade,
          school: schoolTag,
          source: 'ai_repaired',
          repairNote: rep.repairNote || 'AI 題目修正工作台精修題型'
        }, apiKey, appState.currentUser);

        if (typeof window.updateCustomRagCountBadge === 'function') window.updateCustomRagCountBadge();
        if (typeof window.showToast === 'function') {
          window.showToast('📥 題目已替換並成功收錄至 RAG 典範庫！未來同考點生題將自動參考此題型！', 'success');
        }
      } catch (ragErr) {
        console.warn('收錄 RAG 失敗:', ragErr);
        if (typeof window.showToast === 'function') {
          window.showToast('收錄 RAG 失敗: ' + ragErr.message, 'danger');
        }
      }
    }
  }

  async function saveAlchemyQuestionToRag(idx) {
    const appState = window.appState || {};
    if (!appState.alchemyCurrentPack || !appState.alchemyCurrentPack.questions[idx]) return;
    const q = appState.alchemyCurrentPack.questions[idx];
    if (!window.RagEngine) return;

    const btn = document.getElementById(`btnSaveToRag-${idx}`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ 向量化收錄中...';
    }

    try {
      const apiKey = window.GeminiService ? window.GeminiService.getApiKey() : '';
      await window.RagEngine.addCustomQuestion({
        ...q,
        subject: q.subject || appState.alchemyCurrentPack.subject,
        grade: q.grade || appState.alchemyCurrentPack.grade,
        school: q.isRepaired ? 'AI 修正題型典範' : 'AI 精選好題典範',
        source: q.isRepaired ? 'ai_repaired' : 'ai_curated'
      }, apiKey, appState.currentUser);

      if (typeof window.updateCustomRagCountBadge === 'function') window.updateCustomRagCountBadge();
      if (typeof window.showToast === 'function') {
        window.showToast('✨ 成功收錄至 RAG 典範庫！未來相關考點出題將自動參考此題型！', 'success');
      }

      if (btn) {
        btn.className = 'text-xs text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-lg';
        btn.innerHTML = '✓ 已為 RAG 典範';
      }
    } catch (err) {
      console.error('收錄 RAG 失敗:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('❌ 收錄 RAG 失敗: ' + (err.message || '請稍後再試'), 'danger');
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '📥 納入 RAG';
      }
    }
  }

  // 掛載至 window
  window.updateAnomalyCountBadge = updateAnomalyCountBadge;
  window.openGenerationAnomaliesModal = openGenerationAnomaliesModal;
  window.closeGenerationAnomaliesModal = closeGenerationAnomaliesModal;
  window.renderGenerationAnomaliesList = renderGenerationAnomaliesList;
  window.clearAllGenerationAnomalies = clearAllGenerationAnomalies;
  window.deleteSingleAnomaly = deleteSingleAnomaly;
  window.copyAllAnomaliesJson = copyAllAnomaliesJson;
  window.copySingleAnomalyJson = copySingleAnomalyJson;
  window.launchRepairFromAnomaly = launchRepairFromAnomaly;
  window.openQuestionRepairModal = openQuestionRepairModal;
  window.closeQuestionRepairModal = closeQuestionRepairModal;
  window.applyRepairTag = applyRepairTag;
  window.executeQuestionRepair = executeQuestionRepair;
  window.applyRepairedQuestionToPack = applyRepairedQuestionToPack;
  window.applyRepairedQuestionAndSaveToRag = applyRepairedQuestionAndSaveToRag;
  window.saveAlchemyQuestionToRag = saveAlchemyQuestionToRag;
  window.openBattleQuestionRepairModal = openBattleQuestionRepairModal;
  window.saveCurrentBattleQuestionToRag = saveCurrentBattleQuestionToRag;
  window.openMistakeQuestionRepairModal = openMistakeQuestionRepairModal;
  window.saveMistakeQuestionToRag = saveMistakeQuestionToRag;
  window.openHistoryQuestionRepairModal = openHistoryQuestionRepairModal;
  window.saveHistoryQuestionToRag = saveHistoryQuestionToRag;
})();
