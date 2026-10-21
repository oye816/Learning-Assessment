/**
 * 星耀國中學習評量系統 - 測驗作答與 RPG 戰鬥競技場核心引擎 (Quiz Battle Arena Engine)
 * 負責題目篩選去重、各科試煉與五科會考副本、即時作答反饋、勇者道具技能、戰後評級結算與雲端成果同步
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

  /**
   * 整合核心基礎題庫與名校（永和/福和國中）及歷屆會考真題庫
   */
  function getCombinedQuestionPool(subjectId) {
    const isSelfContained = typeof window.isSelfContainedTextQuestion === 'function' 
      ? window.isSelfContainedTextQuestion 
      : () => true;

    const core = (typeof window.CORE_QUESTIONS !== 'undefined' && Array.isArray(window.CORE_QUESTIONS)) 
      ? window.CORE_QUESTIONS 
      : ((typeof CORE_QUESTIONS !== 'undefined' && Array.isArray(CORE_QUESTIONS)) ? CORE_QUESTIONS : []);
    const real = (typeof window.REAL_EXAM_QUESTIONS !== 'undefined' && Array.isArray(window.REAL_EXAM_QUESTIONS)) 
      ? window.REAL_EXAM_QUESTIONS 
      : ((typeof REAL_EXAM_QUESTIONS !== 'undefined' && Array.isArray(REAL_EXAM_QUESTIONS)) ? REAL_EXAM_QUESTIONS : []);
    const combined = [...core, ...real].filter(isSelfContained);
    if (!subjectId) return combined;
    return combined.filter(q => q.subject === subjectId);
  }

  /**
   * 題庫智慧去重與近期題目記憶防重複過濾器
   */
  function filterUnseenCandidates(candidates, count = 5) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    const isSelfContained = typeof window.isSelfContainedTextQuestion === 'function' 
      ? window.isSelfContainedTextQuestion 
      : () => true;

    // 0. 純文字自給自足性安全過濾（確保無圖片、地圖、音檔依賴）
    const validCandidates = candidates.filter(isSelfContained);
    const safeCandidates = validCandidates.length > 0 ? validCandidates : candidates;

    // 1. 依題幹 (stem) 進行嚴格去重，確保同場試煉絕無雙胞胎題目
    const uniqueMap = new Map();
    safeCandidates.forEach(q => {
      if (!q || !q.stem) return;
      const key = q.stem.trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, q);
      }
    });
    const uniqueList = Array.from(uniqueMap.values());

    window.appState.recentQuestionIds = window.appState.recentQuestionIds || [];
    const recentSet = new Set(window.appState.recentQuestionIds);

    // 2. 優先過濾近期幾場已出現過的題目
    let freshCandidates = uniqueList.filter(q => !recentSet.has(q.id || q.stem));
    
    // 若全新題目不足 count 題，代表題庫循環已滿，清空過期記憶重新循環
    if (freshCandidates.length < count) {
      window.appState.recentQuestionIds = [];
      freshCandidates = uniqueList;
    }

    // 3. 隨機打散並取出目標題數
    const selected = freshCandidates.sort(() => Math.random() - 0.5).slice(0, count);

    // 4. 將本次選出的題目加入近期記憶（最多保留 35 道，確保至少連續 7 場五題戰鬥皆不撞題）
    selected.forEach(q => {
      const qId = q.id || q.stem;
      if (!window.appState.recentQuestionIds.includes(qId)) {
        window.appState.recentQuestionIds.push(qId);
      }
    });
    if (window.appState.recentQuestionIds.length > 35) {
      window.appState.recentQuestionIds = window.appState.recentQuestionIds.slice(-35);
    }

    return selected;
  }

  function startSubjectDungeon(subjectId) {
    if (window.appState.examFilter === 'stage' || window.appState.examFilter === '114-1-2') {
      if (typeof window.startExamStageSubjectExam === 'function') {
        window.startExamStageSubjectExam(subjectId);
      }
      return;
    }
    const meta = window.SUBJECT_META || {};
    const subMeta = meta[subjectId] || meta.math || { name: '學科', icon: '📖', topics: [] };
    let pool = getCombinedQuestionPool(subjectId);
    if (window.appState.gradeFilter !== 'all') {
      const filtered = pool.filter(q => String(q.grade) === String(window.appState.gradeFilter));
      if (filtered.length > 0) pool = filtered;
    }

    // 隨機抽選該科目的 2 個不同主題生成練習題（兩主題互斥，杜絕重複生題）
    const topics = subMeta.topics && subMeta.topics.length > 0 ? subMeta.topics.slice() : ['重點考題觀念特訓'];
    const shuffledTopics = topics.sort(() => Math.random() - 0.5);
    const randomTopic1 = shuffledTopics[0];
    const randomTopic2 = (shuffledTopics.length > 1) ? shuffledTopics[1] : shuffledTopics[0];

    // 若全學年，動態於七/八/九年級隨機抽樣，避免永遠只有單一年級
    const g1 = window.appState.gradeFilter === 'all' ? ['7', '8', '9'][Math.floor(Math.random() * 3)] : window.appState.gradeFilter;
    const g2 = window.appState.gradeFilter === 'all' ? ['7', '8', '9'][Math.floor(Math.random() * 3)] : window.appState.gradeFilter;

    const genPack = typeof window.generatePracticePack === 'function' 
      ? window.generatePracticePack 
      : () => ({ questions: [] });

    const extraPack1 = genPack(randomTopic1, subjectId, g1, 'progressive');
    const extraPack2 = (randomTopic2 !== randomTopic1) 
      ? genPack(randomTopic2, subjectId, g2, 'drill') 
      : { questions: [] };

    let allCandidates = [
      ...pool,
      ...(extraPack1.questions || []),
      ...(extraPack2.questions || [])
    ];

    // 嚴格年級過濾：若非全學年，優先保留完全相符之年級題目
    if (window.appState.gradeFilter !== 'all') {
      const strictGradeCandidates = allCandidates.filter(q => !q.grade || String(q.grade) === String(window.appState.gradeFilter));
      if (strictGradeCandidates.length >= 3) {
        allCandidates = strictGradeCandidates;
      }
    }

    const gradeLabel = window.appState.gradeFilter === 'all' ? '全學年' : (window.appState.gradeFilter + '年級');
    const selected = filterUnseenCandidates(allCandidates, 5);
    launchBattleSession(`${subMeta.icon} ${subMeta.name}單元測驗 (${gradeLabel})`, `${subMeta.name}考點守門者`, selected);
  }

  function startQuickMixedBattle() {
    if (window.appState.examFilter === 'stage' || window.appState.examFilter === '114-1-2') {
      if (typeof window.startExamStageMixedBattle === 'function') {
        window.startExamStageMixedBattle();
      }
      return;
    }
    const subjects = ['chinese', 'english', 'math', 'science', 'social'];
    const mixedQuestions = [];
    const currentGradeFilter = window.appState.gradeFilter;
    const meta = window.SUBJECT_META || {};
    const genPack = typeof window.generatePracticePack === 'function' 
      ? window.generatePracticePack 
      : () => ({ questions: [] });

    subjects.forEach(subId => {
      const subMeta = meta[subId] || { topics: ['考點觀念'] };
      const topicsList = subMeta.topics && subMeta.topics.length > 0 ? subMeta.topics : ['核心概念'];
      const randomTopic = topicsList[Math.floor(Math.random() * topicsList.length)];
      const targetGrade = currentGradeFilter === 'all' ? ['7', '8', '9'][Math.floor(Math.random() * 3)] : currentGradeFilter;
      const pack = genPack(randomTopic, subId, targetGrade, 'progressive');
      
      let pool = getCombinedQuestionPool(subId);
      if (currentGradeFilter !== 'all') {
        const filtered = pool.filter(q => String(q.grade) === String(currentGradeFilter));
        if (filtered.length > 0) pool = filtered;
      }

      let candidates = [...pool, ...(pack.questions || [])];
      if (currentGradeFilter !== 'all') {
        const strictCandidates = candidates.filter(q => !q.grade || String(q.grade) === String(currentGradeFilter));
        if (strictCandidates.length > 0) candidates = strictCandidates;
      }
      const picked = filterUnseenCandidates(candidates, 1);
      if (picked.length > 0) {
        mixedQuestions.push(picked[0]);
      }
    });

    const finalShuffled = mixedQuestions.sort(() => Math.random() - 0.5);
    const gradeLabel = currentGradeFilter === 'all' ? '全學年綜合' : (currentGradeFilter + '年級');
    launchBattleSession(`⚡ 五科綜合模擬考 (${gradeLabel})`, '五科會考守門者', finalShuffled);
  }

  function launchBattleSession(title, bossName, questionsList) {
    if (!questionsList || questionsList.length === 0) return;
    window.appState.battle = {
      active: true,
      title: title,
      bossName: bossName,
      subject: questionsList[0]?.subject || 'math',
      questions: questionsList.map(q => Object.assign({}, q)),
      currentIndex: 0,
      heroHp: 100,
      bossHp: 100,
      bossMaxHp: 100,
      combo: 0,
      shieldActive: false,
      answeredCurrent: false,
      correctCount: 0,
      disabledOptions: [],
      userAnswers: [],
      hasSavedToHistory: false
    };

    const pill = document.getElementById('battleStatusPill');
    if (pill) pill.classList.remove('hidden');
    const summary = document.getElementById('battleSummaryScreen');
    if (summary) summary.classList.add('hidden');
    const box = document.getElementById('battleActiveQuestionBox');
    if (box) box.classList.remove('hidden');
    const btnSettle = document.getElementById('btnSettleBattleEarly');
    if (btnSettle) btnSettle.classList.add('hidden');

    if (typeof window.switchTab === 'function') {
      window.switchTab('battle');
    }
    renderBattleState();
  }

  function restartCurrentBattle() {
    if (!window.appState.battle || !window.appState.battle.questions || window.appState.battle.questions.length === 0) {
      startQuickMixedBattle();
      return;
    }
    launchBattleSession(window.appState.battle.title, window.appState.battle.bossName, window.appState.battle.questions);
  }

  function renderBattleState() {
    const b = window.appState.battle;
    if (!b || !b.questions) return;
    const q = b.questions[b.currentIndex];
    if (!q) return;

    // 換題時自動停止前一題朗讀
    if (typeof window.stopSpeaking === 'function') {
      window.stopSpeaking();
    }

    // 全學科題目均提供標準臺灣國語朗讀支援
    const btnSpeak = document.getElementById('btnSpeakEnglish');
    if (btnSpeak) {
      btnSpeak.classList.remove('hidden');
    }

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('battleDungeonBadge', b.title);
    setTxt('battleQuestionCounter', `第 ${b.currentIndex + 1} / ${b.questions.length} 回合`);
    setTxt('bossNameDisplay', b.bossName);

    setTxt('heroHpText', `${b.heroHp} / 100 HP`);
    const heroBar = document.getElementById('heroHpBar');
    if (heroBar) heroBar.style.width = `${Math.max(0, b.heroHp)}%`;

    setTxt('bossHpText', `${b.bossHp} / ${b.bossMaxHp} HP`);
    const bossBar = document.getElementById('bossHpBar');
    if (bossBar) bossBar.style.width = `${Math.max(0, Math.round((b.bossHp / b.bossMaxHp) * 100))}%`;

    setTxt('battleComboText', `🔥 連擊 Combo x${b.combo}`);
    setTxt('doubleDamageBadge', b.combo >= 2 ? '⚡ 連擊爆擊加成中 (1.5x)' : '⚡ 一般蓄力');
    const shieldBadge = document.getElementById('shieldActiveBadge');
    if (shieldBadge) {
      if (b.shieldActive) shieldBadge.classList.remove('hidden');
      else shieldBadge.classList.add('hidden');
    }

    const items = window.appState.player?.items || { fifty: 0, hint: 0, shield: 0 };
    setTxt('itemCount-fifty', `剩 ${items.fifty} 瓶`);
    setTxt('itemCount-hint', `剩 ${items.hint} 卷`);
    setTxt('itemCount-shield', `剩 ${items.shield} 面`);

    const meta = window.SUBJECT_META || {};
    const subMeta = meta[q.subject] || meta.math || { name: '學科', icon: '📖' };
    setTxt('qSubjectBadge', `${subMeta.icon} ${subMeta.name}`);
    setTxt('qGradeBadge', `${q.grade || '8'}年級`);

    const schoolBadge = document.getElementById('qSchoolBadge');
    if (schoolBadge) {
      if (q.school) {
        const stageTag = q.stage_name || (q.semester && q.stage ? `第${q.semester}學期・第${q.stage}次段考` : (q.exam ? q.exam.replace(/^\d+學年度/, '') : '段考真題'));
        schoolBadge.textContent = `🏫 ${q.school}・${stageTag}`;
        schoolBadge.classList.remove('hidden');
      } else {
        schoolBadge.classList.add('hidden');
      }
    }

    const repairedBadge = document.getElementById('qRepairedBadge');
    if (repairedBadge) {
      if (q.isRepaired) {
        repairedBadge.classList.remove('hidden');
      } else {
        repairedBadge.classList.add('hidden');
      }
    }

    const btnRag = document.getElementById('btnBattleSaveToRag');
    if (btnRag) {
      btnRag.disabled = false;
      btnRag.className = 'px-3 py-2 rounded-xl bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 hover:text-indigo-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors';
      btnRag.innerHTML = '<span>📥</span> <span>納入 RAG</span>';
    }

    setTxt('qConceptBadge', window.humanizeMath ? window.humanizeMath(q.concept || '') : (q.concept || ''));
    setTxt('qStemText', window.humanizeMath ? window.humanizeMath(q.stem || '') : (q.stem || ''));

    const diagramEl = document.getElementById('qDiagramContainer');
    if (diagramEl) {
      if (q.diagramSvg && typeof window.renderSafeSvg === 'function') {
        diagramEl.innerHTML = window.renderSafeSvg(q.diagramSvg, `${subMeta.name}・幾何實驗圖解`);
        diagramEl.classList.remove('hidden');
      } else {
        diagramEl.innerHTML = '';
        diagramEl.classList.add('hidden');
      }
    }

    const hintBanner = document.getElementById('battleHintBanner');
    if (hintBanner) hintBanner.classList.add('hidden');
    const feedbackBox = document.getElementById('battleFeedbackBox');
    if (feedbackBox) feedbackBox.classList.add('hidden');
    setTxt('battleActionBanner', '請選擇正確咒語發動攻擊！');

    // 重設生動講解卡片狀態
    const bCardBox = document.getElementById('battleLivelyCardBox');
    if (bCardBox) {
      bCardBox.classList.add('hidden');
      bCardBox.innerHTML = '';
    }
    const bSpeakBtn = document.getElementById('btnSpeakBattleLively');
    if (bSpeakBtn) bSpeakBtn.classList.add('hidden');
    const bLivelyBtn = document.getElementById('btnTriggerBattleLively');
    if (bLivelyBtn) {
      bLivelyBtn.disabled = false;
      setTxt('btnBattleLivelyIcon', '🪄');
      setTxt('btnBattleLivelyText', 'AI 生動講解此題');
    }

    const optsGrid = document.getElementById('battleOptionsGrid');
    if (optsGrid && Array.isArray(q.options)) {
      optsGrid.innerHTML = q.options.map((optText, idx) => {
        const safeOptText = escapeHtml(optText);
        const isDisabled = b.disabledOptions.includes(idx);
        if (isDisabled) {
          return `
            <button type="button" disabled class="q-opt-scalable p-4 sm:p-5 rounded-2xl bg-slate-950/40 border border-slate-800/50 text-slate-600 line-through text-left font-semibold cursor-not-allowed">
              ${safeOptText} （已被秘藥封印）
            </button>
          `;
        }
        return `
          <button type="button" id="battleOptBtn-${idx}" onclick="submitBattleAnswer(${idx})" class="q-opt-scalable p-4 sm:p-5 rounded-2xl bg-slate-900 hover:bg-violet-950/60 border border-slate-700 hover:border-violet-400 text-left font-bold text-slate-100 transition-all flex items-center justify-between group active:scale-98">
            <span class="leading-relaxed">${safeOptText}</span>
            <span class="text-xs sm:text-sm px-2.5 py-0.5 rounded-lg bg-slate-800 group-hover:bg-violet-600 text-slate-400 group-hover:text-white font-mono shrink-0 ml-3">${idx + 1}</span>
          </button>
        `;
      }).join('');
    }
  }

  function useBattleItem(itemType) {
    const b = window.appState.battle;
    if (b.answeredCurrent) {
      if (typeof window.showToast === 'function') {
        window.showToast('本回合已作答完畢，請於下一回合使用道具！', 'warning');
      }
      return;
    }
    const items = window.appState.player.items;
    if (!items[itemType] || items[itemType] <= 0) {
      if (typeof window.showToast === 'function') {
        window.showToast('道具數量不足！可前往「能力雷達與道具屋」使用星幣購買。', 'warning');
      }
      return;
    }

    const q = b.questions[b.currentIndex];
    if (!q) return;

    if (itemType === 'fifty') {
      if (b.disabledOptions.length > 0) {
        if (typeof window.showToast === 'function') {
          window.showToast('本題已經使用過刪去秘藥囉！', 'warning');
        }
        return;
      }
      const wrongIndices = [0, 1, 2, 3].filter(i => i !== q.answer);
      const shuffledWrong = wrongIndices.sort(() => Math.random() - 0.5).slice(0, 2);
      b.disabledOptions = shuffledWrong;
      items.fifty -= 1;
      if (typeof window.playSoundEffect === 'function') window.playSoundEffect('alchemy');
      if (typeof window.showToast === 'function') {
        window.showToast('🧪 發動刪去秘藥！已封印 2 個錯誤選項！', 'success');
      }
      renderBattleState();
    } else if (itemType === 'hint') {
      items.hint -= 1;
      if (typeof window.playSoundEffect === 'function') window.playSoundEffect('click');
      const hintText = document.getElementById('battleHintText');
      if (hintText) hintText.textContent = q.hint;
      const hintBanner = document.getElementById('battleHintBanner');
      if (hintBanner) hintBanner.classList.remove('hidden');
      const hintCount = document.getElementById('itemCount-hint');
      if (hintCount) hintCount.textContent = `剩 ${items.hint} 卷`;
      if (typeof window.showToast === 'function') {
        window.showToast('💡 大魔導師破題提示已顯現！', 'success');
      }
    } else if (itemType === 'shield') {
      if (b.shieldActive) {
        if (typeof window.showToast === 'function') {
          window.showToast('聖盾已在守護狀態中！', 'warning');
        }
        return;
      }
      b.shieldActive = true;
      items.shield -= 1;
      if (typeof window.playSoundEffect === 'function') window.playSoundEffect('alchemy');
      const shieldBadge = document.getElementById('shieldActiveBadge');
      if (shieldBadge) shieldBadge.classList.remove('hidden');
      const shieldCount = document.getElementById('itemCount-shield');
      if (shieldCount) shieldCount.textContent = `剩 ${items.shield} 面`;
      if (typeof window.showToast === 'function') {
        window.showToast('🛡️ 星光免傷聖盾已展開！可抵擋一次答錯傷害！', 'success');
      }
    }
    if (typeof window.saveState === 'function') window.saveState();
  }

  function submitBattleAnswer(selectedIdx) {
    if (typeof window.stopSpeaking === 'function') window.stopSpeaking();
    const b = window.appState.battle;
    if (b.answeredCurrent) return;
    const q = b.questions[b.currentIndex];
    if (!q) return;

    b.answeredCurrent = true;
    if (!b.userAnswers) b.userAnswers = [];
    b.userAnswers[b.currentIndex] = selectedIdx;
    const isCorrect = selectedIdx === q.answer;
    b.lastAnswer = selectedIdx;
    b.lastIsCorrect = isCorrect;

    q.options.forEach((_, idx) => {
      const btn = document.getElementById('battleOptBtn-' + idx);
      if (!btn) return;
      if (idx === q.answer) {
        btn.className = 'q-opt-scalable p-4 sm:p-5 rounded-2xl bg-emerald-500/25 border-2 border-emerald-400 text-left font-black text-emerald-200 flex items-center justify-between';
      } else if (idx === selectedIdx && !isCorrect) {
        btn.className = 'q-opt-scalable p-4 sm:p-5 rounded-2xl bg-rose-500/25 border-2 border-rose-500 text-left font-black text-rose-200 flex items-center justify-between';
      } else {
        btn.className = 'q-opt-scalable p-4 sm:p-5 rounded-2xl bg-slate-950/50 border border-slate-800 text-left text-slate-500 flex items-center justify-between opacity-60';
      }
    });

    const fbBox = document.getElementById('battleFeedbackBox');
    const fbTitle = document.getElementById('feedbackTitle');
    const fbExp = document.getElementById('feedbackExplanationText');
    if (fbBox) fbBox.classList.remove('hidden');

    const bCardBox = document.getElementById('battleLivelyCardBox');
    if (bCardBox) {
      bCardBox.classList.add('hidden');
      bCardBox.innerHTML = '';
    }
    const bSpeakBtn = document.getElementById('btnSpeakBattleLively');
    if (bSpeakBtn) bSpeakBtn.classList.add('hidden');
    const bLivelyBtn = document.getElementById('btnTriggerBattleLively');
    if (bLivelyBtn) {
      bLivelyBtn.disabled = false;
      const bIcon = document.getElementById('btnBattleLivelyIcon');
      const bTxt = document.getElementById('btnBattleLivelyText');
      if (bIcon) bIcon.textContent = '🪄';
      if (bTxt) bTxt.textContent = 'AI 生動講解此題';
    }

    const btnSettle = document.getElementById('btnSettleBattleEarly');
    if (btnSettle) btnSettle.classList.remove('hidden');

    const subStat = window.appState.player.subjectStats[q.subject] || { answered: 0, correct: 0, mastery: 75 };
    subStat.answered += 1;
    window.appState.player.totalAnswered += 1;

    if (isCorrect) {
      if (typeof window.playSoundEffect === 'function') window.playSoundEffect('correct');
      b.combo += 1;
      b.correctCount += 1;
      window.appState.player.streak += 1;
      window.appState.player.totalCorrect += 1;
      subStat.correct += 1;
      subStat.mastery = Math.min(100, subStat.mastery + 3);

      const baseDmg = Math.ceil(100 / b.questions.length);
      const dmg = b.combo >= 2 ? Math.round(baseDmg * 1.25) : baseDmg;
      b.bossHp = Math.max(0, b.bossHp - dmg);

      const bossCard = document.getElementById('bossCardContainer');
      const dmgFloat = document.getElementById('bossDamageFloating');
      if (bossCard) {
        bossCard.classList.remove('animate-hit');
        void bossCard.offsetWidth;
        bossCard.classList.add('animate-hit');
      }
      if (dmgFloat) {
        dmgFloat.textContent = `-${dmg} HP!`;
        dmgFloat.classList.remove('hidden');
        setTimeout(() => dmgFloat.classList.add('hidden'), 1100);
      }

      const actionBanner = document.getElementById('battleActionBanner');
      if (actionBanner) actionBanner.textContent = `⚡ 答對了！精準破題！（對手體力 -${dmg} HP）`;
      if (fbBox) fbBox.className = 'rounded-2xl p-4 sm:p-5 border transition-all space-y-3 bg-emerald-950/50 border-emerald-500/50';
      if (fbTitle) {
        fbTitle.className = 'font-black text-base flex items-center gap-2 text-emerald-300';
        fbTitle.innerHTML = `<span>✨ 答對了！連續答對 x${b.combo} 題（+25 EXP, +15 🪙）</span>`;
      }
      if (fbExp) fbExp.textContent = q.explanation;

      if (typeof window.addPlayerReward === 'function') {
        window.addPlayerReward(25, 15);
      }

      const dq2 = window.appState.dailyQuests.find(d => d.id === 'dq-2');
      if (dq2 && dq2.progress < dq2.target) dq2.progress += 1;
      const dq3 = window.appState.dailyQuests.find(d => d.id === 'dq-3');
      if (dq3 && b.combo > dq3.progress) dq3.progress = Math.min(dq3.target, b.combo);
    } else {
      if (typeof window.playSoundEffect === 'function') window.playSoundEffect('wrong');
      b.combo = 0;
      window.appState.player.streak = 0;
      subStat.mastery = Math.max(40, subStat.mastery - 2);

      const actionBanner = document.getElementById('battleActionBanner');
      if (b.shieldActive) {
        b.shieldActive = false;
        const shieldBadge = document.getElementById('shieldActiveBadge');
        if (shieldBadge) shieldBadge.classList.add('hidden');
        if (actionBanner) actionBanner.textContent = '🛡️ 護盾生效！成功抵擋了答錯扣血！';
      } else {
        b.heroHp = Math.max(0, b.heroHp - 25);
        if (actionBanner) actionBanner.textContent = '💥 答錯了！受到失誤扣血損失 25 HP！';
      }

      if (fbBox) fbBox.className = 'rounded-2xl p-4 sm:p-5 border transition-all space-y-3 bg-rose-950/50 border-rose-500/50';
      if (fbTitle) {
        fbTitle.className = 'font-black text-base flex items-center gap-2 text-rose-300';
        fbTitle.innerHTML = `<span>❌ 答錯了！已自動收錄至「錯題本」</span>`;
      }
      if (fbExp) fbExp.innerHTML = `<strong>💡 破題提示：</strong>${escapeHtml(q.hint || '')}<br/><strong>📖 完整解析：</strong>${escapeHtml(q.explanation || '')}`;

      if (typeof window.addMistakeRecord === 'function') {
        window.addMistakeRecord(q);
      }
    }

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setTxt('heroHpText', `${b.heroHp} / 100 HP`);
    const heroBar = document.getElementById('heroHpBar');
    if (heroBar) heroBar.style.width = `${Math.max(0, b.heroHp)}%`;
    setTxt('bossHpText', `${b.bossHp} / ${b.bossMaxHp} HP`);
    const bossBar = document.getElementById('bossHpBar');
    if (bossBar) bossBar.style.width = `${Math.max(0, Math.round((b.bossHp / b.bossMaxHp) * 100))}%`;
    setTxt('battleComboText', `🔥 連擊 Combo x${b.combo}`);

    const nextBtn = document.getElementById('nextBattleQuestionBtn');
    if (nextBtn) {
      if (b.currentIndex + 1 >= b.questions.length || b.heroHp <= 0) {
        nextBtn.textContent = '查看測驗結果 🏆';
      } else {
        nextBtn.textContent = '下一題 →';
      }
    }
    if (typeof window.updateHeaderUI === 'function') window.updateHeaderUI();
    if (typeof window.saveState === 'function') window.saveState();
  }

  function nextBattleQuestion() {
    const b = window.appState.battle;
    if (!b) return;
    if (b.currentIndex + 1 >= b.questions.length || b.heroHp <= 0) {
      finishBattleSession();
      return;
    }
    b.currentIndex += 1;
    b.answeredCurrent = false;
    b.disabledOptions = [];
    renderBattleState();
  }

  function finishBattleSession() {
    if (typeof window.stopSpeaking === 'function') window.stopSpeaking();
    const b = window.appState.battle;
    if (!b || b.hasSavedToHistory) return;
    b.hasSavedToHistory = true;
    b.active = false;
    
    const pill = document.getElementById('battleStatusPill');
    if (pill) pill.classList.add('hidden');
    const actBox = document.getElementById('battleActiveQuestionBox');
    if (actBox) actBox.classList.add('hidden');

    const summaryEl = document.getElementById('battleSummaryScreen');
    if (summaryEl) summaryEl.classList.remove('hidden');

    const total = b.questions.length;
    const acc = Math.round((b.correctCount / total) * 100);
    let rank = 'B';
    let headline = '測驗完成！持續練習必能更上一層樓！';
    if (acc >= 90) {
      rank = 'S';
      headline = '🏆 滿分大捷！全數答對展現頂尖實力！';
    } else if (acc >= 75) {
      rank = 'A';
      headline = '✨ 測驗優秀！展現了扎實的概念理解！';
    } else if (acc < 50) {
      rank = 'C';
      headline = '💪 雖敗猶榮！快用「AI 弱點出題」補強觀念！';
    }

    const bonusExp = b.correctCount * 30 + (acc >= 80 ? 50 : 20);
    const bonusGold = b.correctCount * 20 + (acc >= 80 ? 30 : 10);

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setTxt('summaryRankBadge', rank);
    setTxt('summaryHeadline', headline);
    setTxt('summarySubtext', `你在「${b.title}」共答對 ${b.correctCount} / ${total} 題，錯題已自動收錄至錯題本。`);
    setTxt('summaryAccuracy', `${acc}%`);
    setTxt('summaryExpEarned', `+${bonusExp} EXP`);
    setTxt('summaryGoldEarned', `+${bonusGold} 🪙`);

    if (typeof window.playSoundEffect === 'function') window.playSoundEffect('levelup');
    if (typeof window.addPlayerReward === 'function') window.addPlayerReward(bonusExp, bonusGold);

    // 自動同步雲端學習評量紀錄
    if (window.FirebaseService) {
      const battleDetails = b.questions.map((q, idx) => {
        const userAns = (b.userAnswers && b.userAnswers[idx] !== undefined) ? b.userAnswers[idx] : null;
        const isCorr = (userAns !== null && userAns === q.answer);
        return {
          concept: q.concept,
          stem: q.stem,
          options: q.options,
          correctAnswer: q.answer,
          selectedAnswer: userAns,
          isCorrect: isCorr,
          explanation: q.explanation,
          diagramSvg: q.diagramSvg || null
        };
      });

      window.FirebaseService.saveAssessmentRecord(window.appState.currentUser, {
        title: b.title,
        subject: b.subject || b.questions[0]?.subject || 'math',
        score: b.correctCount,
        total: total,
        accuracy: acc,
        rank: rank,
        expEarned: bonusExp,
        goldEarned: bonusGold,
        details: battleDetails
      }).then(() => {
        if (typeof window.showToast === 'function') {
          window.showToast('☁️ 評量成果已自動登錄至個人學習歷程！', 'success');
        }
      }).catch(err => {
        console.warn('雲端記錄失敗:', err);
      });

      // 同步勇者數值
      window.FirebaseService.syncUserProfile(window.appState.currentUser, window.appState);
    }
  }

  function settleBattleEarly() {
    if (typeof window.stopSpeaking === 'function') window.stopSpeaking();
    const b = window.appState.battle;
    if (!b || !b.active) return;
    const answeredIndices = [];
    if (b.userAnswers) {
      b.userAnswers.forEach((ans, idx) => {
        if (ans !== null && ans !== undefined) answeredIndices.push(idx);
      });
    }
    if (answeredIndices.length === 0) {
      if (typeof window.showToast === 'function') {
        window.showToast('您尚未回答任何題目，請先作答至少 1 題後再結算！', 'warning');
      }
      return;
    }
    if (!confirm(`確定要提前結算嗎？已完成 ${answeredIndices.length} 道題目的作答，將把這 ${answeredIndices.length} 題的成果立即收錄到學習歷程！`)) {
      return;
    }
    b.questions = answeredIndices.map(i => b.questions[i]);
    b.userAnswers = answeredIndices.map(i => b.userAnswers[i]);
    b.currentIndex = b.questions.length;
    finishBattleSession();
  }

  function generateSimilarFromCurrentBattleQuestion() {
    const b = window.appState.battle;
    if (!b || !b.questions) return;
    const q = b.questions[b.currentIndex];
    if (!q) return;
    if (typeof window.switchTab === 'function') {
      window.switchTab('alchemy');
    }
    const input = document.getElementById('alchemyQuestionInput');
    if (input) input.value = `${q.concept}：${q.stem}`;
    const subSel = document.getElementById('alchemySubjectSelect');
    if (subSel) subSel.value = q.subject;
    const gradeSel = document.getElementById('alchemyGradeSelect');
    if (gradeSel) {
      if (window.appState.gradeFilter && window.appState.gradeFilter !== 'all') {
        gradeSel.value = window.appState.gradeFilter;
      } else {
        gradeSel.value = q.grade || '8';
      }
    }
    if (typeof window.runMistakeAlchemy === 'function') {
      window.runMistakeAlchemy();
    }
  }

  // 鍵盤數字快捷鍵作答
  window.addEventListener('keydown', (e) => {
    if (!window.appState || window.appState.activeTab !== 'battle') return;
    if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (['1', '2', '3', '4'].includes(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      if (window.appState.battle && !window.appState.battle.answeredCurrent && !window.appState.battle.disabledOptions.includes(idx)) {
        submitBattleAnswer(idx);
      }
    }
  });

  // 掛載到全域 window
  window.getCombinedQuestionPool = getCombinedQuestionPool;
  window.filterUnseenCandidates = filterUnseenCandidates;
  window.startSubjectDungeon = startSubjectDungeon;
  window.startQuickMixedBattle = startQuickMixedBattle;
  window.launchBattleSession = launchBattleSession;
  window.restartCurrentBattle = restartCurrentBattle;
  window.renderBattleState = renderBattleState;
  window.useBattleItem = useBattleItem;
  window.submitBattleAnswer = submitBattleAnswer;
  window.nextBattleQuestion = nextBattleQuestion;
  window.finishBattleSession = finishBattleSession;
  window.settleBattleEarly = settleBattleEarly;
  window.generateSimilarFromCurrentBattleQuestion = generateSimilarFromCurrentBattleQuestion;

})();
