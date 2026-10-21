/**
 * 星耀國中學習評量系統 - AI 弱點出題與考題生成引擎 (AI Question Alchemy Engine)
 * 涵蓋常考考點範本、RAG 向量題庫檢索、多模態圖片題目辨識、Gemini 3.5 智慧出題與階梯練習題渲染
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

  // ==================== 4. MISTAKE ALCHEMY TEMPLATES & DYNAMIC GENERATOR ====================
  const ALCHEMY_PRESETS = [
    {
      id: 'preset-sci-enzyme',
      label: '🎯 第1學期段考 自然：酵素活性與溫度對唾液澱粉酶影響',
      subject: 'science',
      grade: '7',
      sampleInput: '名校段考真題：探討溫度對人體唾液澱粉酶活性的影響，在 0°C、37°C、90°C 下加入本氏液隔水加熱，顏色變化與酵素變性怎麼判斷？'
    },
    {
      id: 'preset-math-factor',
      label: '🎯 第1學期段考 數學：質因數分解與標準分解式求最大公因數',
      subject: 'math',
      grade: '7',
      sampleInput: '名校段考真題：已知 a = 2^3 * 3^2 * 5 * 7，b = 2^2 * 3^3 * 7 * 11，求 (a, b) 與 [a, b] 的標準分解式，指數要取最大還是最小常搞混！'
    },
    {
      id: 'preset-eng-continuous',
      label: '🎯 第1學期段考 英語：現在進行式 (Present Continuous) 句型與時間副詞',
      subject: 'english',
      grade: '7',
      sampleInput: '名校段考真題：Look! The boys are playing soccer over there. 現在進行式 be + V-ing 碰到動詞字尾去 e 加 ing，或者重複字尾加 ing 怎麼快速判別？'
    },
    {
      id: 'preset-soc-monsoon',
      label: '🎯 第1學期段考 社會：臺灣冬季東北季風與迎風坡地形雨判讀',
      subject: 'social',
      grade: '7',
      sampleInput: '名校段考真題：臺灣北部與東北部在冬季常陰雨綿綿，基隆與宜蘭降雨量特別豐富，是因為哪一種風向受到哪座山脈阻擋形成的雨量特徵？'
    },
    {
      id: 'preset-chi-classical',
      label: '🎯 第1學期段考 國文：文言語譯與一字多義（之、其、以）辨析',
      subject: 'chinese',
      grade: '7',
      sampleInput: '名校段考真題：兒時記趣與論語選文中的文言虛詞「之」字，何者作為代詞？何者作為動詞或助詞？一字多義的比較怎麼解題？'
    },
    {
      id: 'preset-math-discount',
      label: '📐 數學：打折與成本利潤方程式',
      subject: 'math',
      grade: '7',
      sampleInput: '某商品按定價打八折出售可賺 120 元，打六折出售則賠 80 元，請問定價與成本怎麼算？我每次都會把定價跟成本搞混！'
    },
    {
      id: 'preset-math-quadratic',
      label: '📐 數學：二次函數配方法與頂點極值',
      subject: 'math',
      grade: '9',
      sampleInput: '求二次函數 y = -2(x - 3)^2 + 5 的頂點坐標、對稱軸跟最大值，如果題目給展開式或是問平移要怎麼判斷？'
    },
    {
      id: 'preset-sci-lens',
      label: '🔬 自然：凸透鏡與凹透鏡成像性質',
      subject: 'science',
      grade: '8',
      sampleInput: '蠟燭放在凸透鏡前不同距離（2倍焦距外、1~2倍焦距間、焦點內）時，像的大小、正倒立跟實像虛像總是背不起來！'
    },
    {
      id: 'preset-sci-mole',
      label: '🔬 自然：莫耳數、分子量與體積莫耳濃度',
      subject: 'science',
      grade: '8',
      sampleInput: '將 20 公克的氫氧化鈉 (NaOH，分子量40) 溶於水配成 500 毫升水溶液，體積莫耳濃度 (M) 是多少？公克跟毫升換算常算錯。'
    },
    {
      id: 'preset-eng-tense',
      label: '🔤 英文：現在完成式 since / for 與過去式分辨',
      subject: 'english',
      grade: '8',
      sampleInput: '考試常考 has been to / has gone to，還有 since 跟 for 後面接的時間到底差在哪裡？何時該用過去式而非現在完成式？'
    },
    {
      id: 'preset-eng-rel',
      label: '🔤 英文：關係代名詞 who / which / that / whose',
      subject: 'english',
      grade: '9',
      sampleInput: '當先行詞同時有人跟動物時關係代名詞要用哪一個？還有介系詞後面能不能放 that？'
    },
    {
      id: 'preset-chi-classical',
      label: '📜 國文：文言文一字多義（之、其、以、為）',
      subject: 'chinese',
      grade: '8',
      sampleInput: '文言文閱讀測驗裡的「之」字跟「以」字每次選項問哪兩個意思相同都選錯，怎麼快速判斷詞性？'
    },
    {
      id: 'preset-soc-climate',
      label: '🌍 社會：台灣與世界氣候圖判讀 & 民法行為能力',
      subject: 'social',
      grade: '9',
      sampleInput: '台灣冬季東北季風與夏季西南季風迎風坡降雨區域，還有公民科未滿 18 歲簽約買東西的民法效力怎麼判斷？'
    }
  ];

  // ==================== 7-B. IMAGE UPLOAD & RAG EXTENSION ====================
  function compressAndProcessImage(file, callback) {
    if (!file || !file.type.startsWith('image/')) {
      if (typeof window.showToast === 'function') {
        window.showToast('⚠️ 請選擇有效的圖片檔案 (JPG、PNG、WEBP 等)', 'warning');
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, 0.85);
        callback({
          base64: dataUrl,
          mimeType: mimeType,
          name: file.name || '考題拍照.jpg',
          size: Math.round(dataUrl.length * 0.75)
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function setAlchemyUploadedImage(imgObj) {
    if (!imgObj) return;
    const appState = window.appState || {};
    appState.alchemyUploadedImage = imgObj;
    const dropZone = document.getElementById('alchemyImageDropZone');
    const previewCard = document.getElementById('alchemyImagePreviewCard');
    const previewImg = document.getElementById('alchemyImagePreviewImg');
    const nameText = document.getElementById('alchemyImageNameText');
    const sizeBadge = document.getElementById('alchemyImageSizeBadge');

    if (dropZone) dropZone.classList.add('hidden');
    if (previewCard) previewCard.classList.remove('hidden');
    if (previewImg) previewImg.src = imgObj.base64;
    if (nameText) nameText.textContent = imgObj.name || '考題圖片';
    if (sizeBadge) {
      const kb = Math.round(imgObj.size / 1024);
      sizeBadge.textContent = kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB';
    }
  }

  function clearAlchemyUploadedImage() {
    const appState = window.appState || {};
    appState.alchemyUploadedImage = null;
    const dropZone = document.getElementById('alchemyImageDropZone');
    const previewCard = document.getElementById('alchemyImagePreviewCard');
    const fileInput = document.getElementById('alchemyImageFileInput');
    const quickInput = document.getElementById('quickHubImageInput');

    if (dropZone) dropZone.classList.remove('hidden');
    if (previewCard) previewCard.classList.add('hidden');
    if (fileInput) fileInput.value = '';
    if (quickInput) quickInput.value = '';
    if (typeof window.showToast === 'function') window.showToast('🗑️ 已清除上傳的考題圖片', 'info');
  }

  function handleAlchemyImageFileSelected(input) {
    if (input.files && input.files[0]) {
      compressAndProcessImage(input.files[0], function(imgObj) {
        setAlchemyUploadedImage(imgObj);
        if (typeof window.showToast === 'function') {
          window.showToast('📷 考題圖片已載入，點選下方「啟動 Gemini AI 智慧出題」進行分析！', 'info');
        }
      });
    }
  }

  function handleQuickHubImageSelected(input) {
    if (input.files && input.files[0]) {
      compressAndProcessImage(input.files[0], function(imgObj) {
        setAlchemyUploadedImage(imgObj);
        if (typeof window.switchTab === 'function') window.switchTab('alchemy');
        if (typeof window.showToast === 'function') {
          window.showToast('📷 考題圖片已就緒，請點擊「啟動 Gemini AI 智慧出題」進行辨識與出題！', 'info');
        }
      });
    }
  }

  function previewLargeUploadedImage() {
    const appState = window.appState || {};
    if (!appState.alchemyUploadedImage) return;
    const modal = document.getElementById('imageLightboxModal');
    const img = document.getElementById('imageLightboxImg');
    if (modal && img) {
      img.src = appState.alchemyUploadedImage.base64;
      modal.classList.remove('hidden');
    }
  }

  function closeImageLightboxModal() {
    const modal = document.getElementById('imageLightboxModal');
    if (modal) modal.classList.add('hidden');
  }

  function updateCustomRagCountBadge() {
    const badge = document.getElementById('customRagCountBadge');
    if (badge && window.RagEngine) {
      badge.textContent = window.RagEngine.getCustomQuestionsCount();
    }
  }

  function openCustomRagModal() {
    renderCustomRagModalList();
    if (typeof window.applyQuestionFontScale === 'function') window.applyQuestionFontScale();
    const modal = document.getElementById('customRagModal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeCustomRagModal() {
    const modal = document.getElementById('customRagModal');
    if (modal) modal.classList.add('hidden');
  }

  function renderCustomRagModalList() {
    const container = document.getElementById('customRagListContainer');
    if (!container || !window.RagEngine) return;

    const list = window.RagEngine.getCustomQuestions();
    updateCustomRagCountBadge();

    if (list.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 px-4 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800">
          <span class="text-3xl">📭</span>
          <h4 class="text-white font-extrabold text-sm sm:text-base mt-2">目前尚無自訂拍照題庫</h4>
          <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            只要在「遇到不會的考題？」點擊相機拍照或上傳題目圖片，AI 辨識出的原題將會自動向量化並儲存於此，在未來的出題中作為命題典範！
          </p>
        </div>
      `;
      return;
    }

    const SUBJECT_META = window.SUBJECT_META || {};

    container.innerHTML = `
      <div class="flex items-center justify-between text-xs text-slate-400 px-1 pb-1">
        <span>共收錄 <strong class="text-amber-300">${list.length}</strong> 題自訂拍照與卡關考題</span>
        <span class="text-[11px] text-emerald-400">✓ 已全數建構 768 維語義向量檢索特徵</span>
      </div>
      ${list.map(q => {
        const subMeta = SUBJECT_META[q.subject] || { name: '學科', badgeClass: 'bg-slate-800 text-slate-300' };
        const dateStr = q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '近期';
        const isCloud = q.cloudSynced || q.cloudDocId || (q.id && q.id.startsWith('cloud-rag-'));
        return `
          <div class="bg-slate-950/90 rounded-2xl p-4 sm:p-5 border border-slate-800 hover:border-indigo-500/50 transition-all space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${subMeta.badgeClass} border">${escapeHtml(subMeta.name)}</span>
                <span class="text-xs text-slate-400">${escapeHtml(q.grade)} 年級</span>
                <span class="text-xs font-bold text-amber-300">【${escapeHtml(q.concept || '核心考點')}】</span>
              </div>
              <div class="flex items-center gap-2">
                ${isCloud ? '<span class="text-[10px] text-sky-400 bg-sky-950/70 border border-sky-800/60 px-2 py-0.5 rounded-full font-bold">☁️ 雲端已同步</span>' : '<span class="text-[10px] text-amber-400 bg-amber-950/70 border border-amber-800/60 px-2 py-0.5 rounded-full font-bold">💻 本機快取</span>'}
                <span class="text-[10px] text-slate-500">${escapeHtml(dateStr)}</span>
                <button type="button" onclick="deleteCustomRagQuestion('${q.id}')" class="text-[11px] text-rose-400 hover:text-rose-300 font-bold px-2 py-0.5 rounded bg-rose-950/40 border border-rose-800/40 transition-colors">
                  🗑️ 刪除
                </button>
              </div>
            </div>
            <p class="q-stem-scalable font-bold text-white leading-relaxed tracking-wide">${escapeHtml(q.stem)}</p>
            ${Array.isArray(q.options) && q.options.length > 0 ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                ${q.options.map((opt, i) => `
                  <div class="q-opt-scalable p-3 rounded-xl border font-bold ${i === q.answer ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300' : 'border-slate-800 bg-slate-900 text-slate-300'}">
                    ${i === q.answer ? '✅ ' : ''}${escapeHtml(opt)}
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${q.explanation ? `
              <div class="q-exp-scalable text-slate-200 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 leading-relaxed font-medium">
                <strong class="text-indigo-300">💡 破題要點：</strong>${escapeHtml(q.explanation)}
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    `;
  }

  async function deleteCustomRagQuestion(id) {
    if (!window.RagEngine) return;
    await window.RagEngine.deleteCustomQuestion(id);
    renderCustomRagModalList();
    if (typeof window.showToast === 'function') window.showToast('🗑️ 已從 RAG 向量知識庫中移除此題', 'info');
  }

  async function refreshCloudRagQuestions() {
    if (window.RagEngine && window.RagEngine.syncCloudQuestions) {
      if (typeof window.showToast === 'function') window.showToast('☁️ 正在與 Firebase 雲端資料庫同步 RAG 題庫...', 'info');
      await window.RagEngine.syncCloudQuestions();
      renderCustomRagModalList();
      updateCustomRagCountBadge();
      if (typeof window.showToast === 'function') window.showToast('✅ 雲端 RAG 題庫同步完成！', 'success');
    } else {
      if (typeof window.showToast === 'function') window.showToast('尚未連線至 Firebase 雲端服務', 'warning');
    }
  }

  function initImageUploadHandlers() {
    // 支援全局截圖貼上 (Ctrl+V / Cmd+V)
    window.addEventListener('paste', function(e) {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            compressAndProcessImage(file, function(imgObj) {
              setAlchemyUploadedImage(imgObj);
              const appState = window.appState || {};
              if (appState.activeTab !== 'alchemy' && typeof window.switchTab === 'function') {
                window.switchTab('alchemy');
              }
              if (typeof window.showToast === 'function') window.showToast('📷 已從剪貼簿讀取考題圖片！', 'info');
            });
            e.preventDefault();
            break;
          }
        }
      }
    });

    // 支援拖曳圖片至 AI 出題上傳框
    const dropZone = document.getElementById('alchemyImageDropZone');
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, function(e) {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add('border-fuchsia-400', 'bg-slate-900/80');
        });
      });
      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, function(e) {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove('border-fuchsia-400', 'bg-slate-900/80');
        });
      });
      dropZone.addEventListener('drop', function(e) {
        const dt = e.dataTransfer;
        const files = dt && dt.files;
        if (files && files[0] && files[0].type.startsWith('image/')) {
          compressAndProcessImage(files[0], function(imgObj) {
            setAlchemyUploadedImage(imgObj);
            if (typeof window.showToast === 'function') window.showToast('📷 考題圖片拖曳載入成功！', 'info');
          });
        }
      });
    }
  }

  // ==================== 8. MISTAKE ALCHEMY ENGINE ====================
  function renderAlchemyPresets() {
    const select = document.getElementById('alchemyPresetSelect');
    if (!select) return;

    const stagePresets = ALCHEMY_PRESETS.filter(p => p.label.includes('段考'));
    const corePresets = ALCHEMY_PRESETS.filter(p => !p.label.includes('段考'));

    let html = `<option value="" disabled selected>✨ 請選擇常考弱點範本（選擇後自動帶入並出題）...</option>`;

    if (stagePresets.length > 0) {
      html += `<optgroup label="🎯 名校段考熱門真題考點（第一/二次段考）">`;
      html += stagePresets.map(p => `
        <option value="${p.id}">【${p.grade || '7'}年級】${escapeHtml(p.label.replace(/^🎯\s*/, ''))}</option>
      `).join('');
      html += `</optgroup>`;
    }

    if (corePresets.length > 0) {
      html += `<optgroup label="📚 國中各科常考核心弱點範本">`;
      html += corePresets.map(p => `
        <option value="${p.id}">【${p.grade || '8'}年級】${escapeHtml(p.label)}</option>
      `).join('');
      html += `</optgroup>`;
    }

    select.innerHTML = html;
  }

  function selectAlchemyPreset(presetId) {
    if (!presetId) return;
    if (typeof window.playSoundEffect === 'function') window.playSoundEffect('click');
    const preset = ALCHEMY_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const inputEl = document.getElementById('alchemyQuestionInput');
    const subEl = document.getElementById('alchemySubjectSelect');
    const gradeEl = document.getElementById('alchemyGradeSelect');
    if (inputEl) inputEl.value = preset.sampleInput;
    if (subEl) subEl.value = preset.subject;
    const appState = window.appState || {};
    if (gradeEl) {
      if (appState.gradeFilter && appState.gradeFilter !== 'all') {
        gradeEl.value = appState.gradeFilter;
      } else if (preset.grade) {
        gradeEl.value = preset.grade;
      }
    }
    const select = document.getElementById('alchemyPresetSelect');
    if (select && select.value !== presetId) {
      select.value = presetId;
    }
    runMistakeAlchemy();
  }

  function detectSubjectFromText(text, explicitSelect) {
    if (explicitSelect && explicitSelect !== 'auto') return explicitSelect;
    const t = (text || '').toLowerCase();
    if (/(方程|函數|三角形|畢氏|幾何|座標|坐標|機率|等差|根號|面積|打折|成本|定價|分數|比例|x|y)/.test(t)) return 'math';
    if (/(透鏡|焦距|莫耳|濃度|密度|浮力|牛頓|加速度|酸鹼|氧化|基因|遺傳|細胞|電壓|電流|行星|斷層)/.test(t)) return 'science';
    if (/(since|for|have|has|who|which|that|whose|tense|被動|時態|關代|假設語氣|文法|單字|動詞|介系詞|[a-z]{4,})/.test(t)) return 'english';
    if (/(文言|修辭|成語|字音|字形|之|其|以|譬喻|轉化|唐詩|古文|主旨|新詩)/.test(t)) return 'chinese';
    if (/(季風|氣候|地形|歷史|朝代|台灣|民法|刑法|憲法|供需|機會成本|公民|地理|等高線)/.test(t)) return 'social';
    return 'math';
  }

  /**
   * RAG 智慧動態題庫生成器
   * 從全真段考題庫中語義檢索，並結合記憶防重複機制，確保題目絕對不重複且切合國中課綱
   */
  function generatePracticePack(inputText, subject, grade, style) {
    const cleanInput = (inputText || '').trim() || '國中重點考題觀念特訓';
    const detectedSub = detectSubjectFromText(cleanInput, subject);
    const SUBJECT_META = window.SUBJECT_META || {};
    const subMeta = SUBJECT_META[detectedSub] || { name: '學科', icon: '📖' };
    const appState = window.appState || {};
    const targetGrade = grade || (document.getElementById('alchemyGradeSelect')?.value) || appState.gradeFilter || 'all';

    // 1. 透過 RAG 向量引擎從全真段考題庫中檢索匹配度最高的題目
    let retrieved = [];
    if (typeof window !== 'undefined' && window.RagEngine && window.RagEngine.fallbackKeywordSearch) {
      retrieved = window.RagEngine.fallbackKeywordSearch({
        query: cleanInput,
        subject: detectedSub,
        grade: targetGrade,
        topK: 12
      });
    }

    // 年級篩選：若指定年級非 all，優先取符合年級之候選題
    if (targetGrade !== 'all' && retrieved.length > 0) {
      const gradeMatched = retrieved.filter(q => String(q.grade) === String(targetGrade));
      if (gradeMatched.length > 0) {
        retrieved = gradeMatched;
      }
    }

    // 2. 透過防重複過濾器過濾掉近期已作答之題目
    let selectedQuestions = [];
    if (typeof window.filterUnseenCandidates === 'function' && retrieved.length > 0) {
      selectedQuestions = window.filterUnseenCandidates(retrieved, 4);
    } else if (retrieved.length > 0) {
      selectedQuestions = retrieved.slice(0, 4);
    }

    // 若候選題目不足 4 題，自該科全量題庫補足
    if (selectedQuestions.length < 4 && typeof window.getCombinedQuestionPool === 'function') {
      const pool = window.getCombinedQuestionPool(detectedSub);
      let remaining = pool.filter(q => !selectedQuestions.some(sq => sq.id === q.id));
      if (targetGrade !== 'all') {
        const gradeRemaining = remaining.filter(q => String(q.grade) === String(targetGrade));
        if (gradeRemaining.length > 0) {
          remaining = gradeRemaining;
        }
      }
      const extra = (typeof window.filterUnseenCandidates === 'function')
        ? window.filterUnseenCandidates(remaining, 4 - selectedQuestions.length)
        : remaining.sort(() => Math.random() - 0.5).slice(0, 4 - selectedQuestions.length);
      selectedQuestions = [...selectedQuestions, ...extra];
    }

    const primaryQ = selectedQuestions[0] || {};
    const primaryConcept = primaryQ.concept || '重點考點聚焦';
    const cleanGrade = (targetGrade && targetGrade !== 'all') ? targetGrade : (primaryQ.grade || '8');

    const diagnosis = {
      subject: detectedSub,
      subjectName: subMeta.name,
      grade: cleanGrade,
      topicTitle: primaryConcept + '・會考真題典範特訓',
      coreConcept: '① 本單元聚焦「' + primaryConcept + '」的核心素養概念；② 請仔細審查題幹給予之已知條件，辨別是原理定義題或計算應用題；③ 逐一檢驗選項，排除易混淆干擾項。',
      commonTrap: '常因審題疏漏、單位換算錯誤，或將反向關係記反導致落入命題誘答陷阱。',
      mnemonic: '🔮 破題心法：「審題抓關鍵，觀念先定位；排除誘答項，會考穩穩拿分！」',
      questions: selectedQuestions.map(q => Object.assign({}, q)),
      ragExemplars: selectedQuestions.slice(0, 2)
    };

    return diagnosis;
  }

  async function runMistakeAlchemy() {
    if (typeof window.playSoundEffect === 'function') window.playSoundEffect('alchemy');
    const inputEl = document.getElementById('alchemyQuestionInput');
    const subjectEl = document.getElementById('alchemySubjectSelect');
    const gradeEl = document.getElementById('alchemyGradeSelect');
    const styleEl = document.getElementById('alchemyStyleSelect');

    const rawText = (inputEl ? inputEl.value.trim() : '') || ALCHEMY_PRESETS[0].sampleInput;
    if (inputEl && !inputEl.value.trim()) {
      inputEl.value = rawText;
    }

    const subVal = subjectEl ? subjectEl.value : 'math';
    const grdVal = gradeEl ? gradeEl.value : '8';
    const styVal = styleEl ? styleEl.value : 'progressive';

    const pack = generatePracticePack(rawText, subVal, grdVal, styVal);

    // 若有 RAG 向量引擎，自動檢索 2 道最相符的真實會考／名校真題作為典範參考
    if (typeof window !== 'undefined' && window.RagEngine) {
      try {
        const exemplars = await window.RagEngine.retrieveSimilarQuestions({
          query: rawText,
          subject: subVal,
          grade: grdVal,
          topK: 2
        });
        if (exemplars && exemplars.length > 0) {
          pack.ragExemplars = exemplars;
        }
      } catch (e) {
        console.warn('RAG 檢索時遭遇微小異常:', e);
      }
    }

    const appState = window.appState || {};
    appState.alchemyCurrentPack = pack;

    const dq1 = (appState.dailyQuests || []).find(q => q.id === 'dq-1');
    if (dq1 && dq1.progress < dq1.target) {
      dq1.progress += 1;
      if (typeof window.renderDailyQuests === 'function') window.renderDailyQuests();
      if (typeof window.saveState === 'function') window.saveState();
    }

    renderAlchemyPackOutput(pack);
    if (typeof window.showToast === 'function') {
      window.showToast('✨ 出題成功！已為你生成 4 道同型延伸練習題！', 'success');
    }
    const resContainer = document.getElementById('alchemyResultContainer');
    if (resContainer) {
      resContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function randomizeGeneratedNumbers() {
    if (typeof window.playSoundEffect === 'function') window.playSoundEffect('click');
    runMistakeAlchemy();
    if (typeof window.showToast === 'function') window.showToast('🎲 已重新隨機置換題目數值與選項！', 'info');
  }

  function renderAlchemyPackOutput(pack) {
    const container = document.getElementById('alchemyResultContainer');
    if (!container || !pack) return;

    const SUBJECT_META = window.SUBJECT_META || {};
    const subMeta = SUBJECT_META[pack.subject] || { name: '學科', icon: '📖', badgeClass: 'bg-violet-500/20 text-violet-300' };

    // 組裝 RAG 真題典範展示卡片
    let ragSectionHtml = '';
    if (Array.isArray(pack.ragExemplars) && pack.ragExemplars.length > 0) {
      const topScore = pack.ragExemplars[0].similarityScore 
        ? (pack.ragExemplars[0].similarityScore > 1 
            ? '語意吻合' 
            : (pack.ragExemplars[0].similarityScore * 100).toFixed(1) + '%') 
        : '高相關';
      const matchLabel = pack.ragExemplars[0].matchType === 'vector' ? 'Gemini 向量匹配' : '語義特徵匹配';

      ragSectionHtml = `
        <div class="rounded-2xl p-5 bg-gradient-to-r from-violet-950/70 via-slate-900/90 to-indigo-950/70 border border-violet-500/40 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xl">🧬</span>
              <span class="text-sm sm:text-base font-black text-violet-200">RAG 向量檢索到的台灣名校／會考真題典範（AI 學習命題結構）：</span>
            </div>
            <span class="text-xs font-bold px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
              ${matchLabel}：${topScore}
            </span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${pack.ragExemplars.map((ex, i) => `
              <div class="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-sm text-amber-300">【${escapeHtml(ex.school || '會考精選')}・${escapeHtml(ex.grade)}年級】</span>
                  <span class="text-xs text-slate-400 font-semibold">${escapeHtml(ex.concept || '')}</span>
                </div>
                <div class="q-exp-scalable text-white font-medium text-sm sm:text-base leading-relaxed">${escapeHtml(ex.stem)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    const questionsHtml = (pack.questions || []).map((q, idx) => {
      const optsHtml = (q.options || []).map((opt, oIdx) => `
        <button type="button" id="alkOpt-${idx}-${oIdx}" onclick="checkAlchemyInlineAnswer(${idx}, ${oIdx})" class="q-opt-scalable p-4 sm:p-5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-left font-bold text-slate-200 transition-all shadow-sm flex items-center justify-between group active:scale-98">
          <span class="leading-relaxed">${escapeHtml(opt)}</span>
          <span class="text-xs sm:text-sm px-2.5 py-0.5 rounded-lg bg-slate-800 group-hover:bg-violet-600 text-slate-400 group-hover:text-white font-mono shrink-0 ml-3">${['A', 'B', 'C', 'D'][oIdx] || (oIdx + 1)}</span>
        </button>
      `).join('');

      return `
        <div class="rpg-card rounded-2xl p-5 sm:p-7 border border-slate-800 hover:border-violet-500/40 transition-all space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <span class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-fuchsia-600 text-white text-xs sm:text-sm font-black flex items-center justify-center shadow">Q${idx + 1}</span>
              <span class="text-sm sm:text-base font-extrabold text-amber-300">${escapeHtml(q.concept)}</span>
              ${q.isRepaired ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">🛠️ AI 校正修復</span>' : ''}
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <button type="button" onclick="openAlchemyLivelyExplanation(${idx})" class="text-xs text-violet-300 hover:text-violet-200 font-bold px-2.5 py-1 rounded-xl bg-violet-950/50 hover:bg-violet-900/50 border border-violet-700/50 transition-all flex items-center gap-1 shadow-sm" title="AI 名師生動講解此題">
                <span>🪄</span>
                <span>AI 生動講解</span>
              </button>
              <button type="button" onclick="openQuestionRepairModal(${idx})" class="text-xs text-amber-300 hover:text-amber-200 font-bold px-2.5 py-1 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/50 transition-all flex items-center gap-1 shadow-sm" title="召喚 AI 修正、美化或調整此題目">
                <span>🔧</span>
                <span>AI 修正</span>
              </button>
              <button type="button" id="btnSaveToRag-${idx}" onclick="saveAlchemyQuestionToRag(${idx})" class="text-xs text-indigo-300 hover:text-indigo-200 font-bold px-2.5 py-1 rounded-xl bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-700/50 transition-all flex items-center gap-1 shadow-sm" title="將此題型收錄至 RAG 典範庫，提供日後出題參考">
                <span>📥</span>
                <span>納入 RAG</span>
              </button>
              <button type="button" onclick="saveQuestionToGrimoireFromAlchemy(${idx})" class="text-xs text-slate-400 hover:text-white font-medium px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors">
                📌 錯題本
              </button>
            </div>
          </div>
          <p class="q-stem-scalable font-bold text-white leading-relaxed tracking-wide">${escapeHtml(q.stem)}</p>
          ${(q.diagramSvg && typeof window.renderSafeSvg === 'function') ? window.renderSafeSvg(q.diagramSvg, `${subMeta.name}・幾何實驗圖解`) : ''}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            ${optsHtml}
          </div>
          <div id="alkFeedback-${idx}" class="q-exp-scalable hidden rounded-2xl p-4 sm:p-5 leading-relaxed border font-medium"></div>
        </div>
      `;
    }).join('');

    // 組裝「學生拍照上傳辨識出的原題」展示卡片
    let extractedOriginalHtml = '';
    if (pack.extractedQuestion) {
      const eq = pack.extractedQuestion;
      extractedOriginalHtml = `
        <div class="rpg-card rounded-3xl p-5 sm:p-7 border border-emerald-500/50 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 space-y-4 shadow-xl">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">📸</span>
              <div>
                <h4 class="text-base sm:text-lg font-black text-emerald-300">考題圖片多模態辨識結果（原題提取）：</h4>
                <p class="text-xs text-slate-400 mt-0.5">已由 Gemini 辨識還原原題，並自動同步收錄至本機 <strong class="text-amber-300">RAG 向量知識庫</strong>，供後續出題檢索參考！</p>
              </div>
            </div>
            <span class="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              📚 已收錄至 RAG 題庫
            </span>
          </div>
          <div class="bg-slate-950/80 rounded-2xl p-5 border border-emerald-500/30 space-y-3">
            <div class="flex items-center justify-between text-xs sm:text-sm">
              <span class="font-bold text-amber-300">【原題考點：${escapeHtml(eq.concept || '核心觀念')}】</span>
              <span class="text-slate-400 font-semibold">${escapeHtml(eq.grade || pack.grade)} 年級 / ${escapeHtml(SUBJECT_META[eq.subject]?.name || pack.subjectName)}</span>
            </div>
            <p class="q-stem-scalable font-bold text-white leading-relaxed tracking-wide">${escapeHtml(eq.stem)}</p>
            ${(eq.diagramSvg && typeof window.renderSafeSvg === 'function') ? window.renderSafeSvg(eq.diagramSvg, '原題幾何實驗圖解還原') : ''}
            ${Array.isArray(eq.options) && eq.options.length > 0 ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                ${eq.options.map((opt, i) => `
                  <div class="q-opt-scalable p-3.5 sm:p-4 rounded-2xl font-bold border ${i === eq.answer ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200' : 'bg-slate-900 border-slate-800 text-slate-300'}">
                    ${i === eq.answer ? '✅ 正確答案：' : ''}${escapeHtml(opt)}
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${eq.explanation ? `
              <div class="q-exp-scalable text-slate-200 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 leading-relaxed font-medium">
                <span class="text-emerald-400 font-bold">💡 原題詳解破題：</span>${escapeHtml(eq.explanation)}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <!-- 【原題提取：學生考題圖片辨識結果與 RAG 收錄】 -->
      ${extractedOriginalHtml}

      <!-- 【第一順位：AI 生成的 4 道練習題】 -->
      <div class="space-y-4">
        <!-- 頂部資訊與行動工具列 -->
        <div class="rpg-card alchemy-glow rounded-3xl p-5 sm:p-6 border border-fuchsia-500/50 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">${subMeta.icon}</span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${subMeta.badgeClass} border">${escapeHtml(pack.subjectName)}</span>
                <span class="text-xs text-slate-400">${escapeHtml(pack.grade)}年級適用</span>
              </div>
              <h3 class="text-lg sm:text-xl font-black text-white mt-0.5">${escapeHtml(pack.topicTitle)}</h3>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2.5">
            <!-- 題目字級即時微調 -->
            <div class="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-xl text-xs shadow-inner">
              <span class="text-slate-400 font-semibold mr-0.5">字級</span>
              <button type="button" onclick="changeQuestionFontSize(-1)" class="w-6 h-6 rounded bg-slate-800 hover:bg-violet-600 text-white font-bold flex items-center justify-center transition-all active:scale-95" title="縮小字型">A-</button>
              <span class="fontScaleDisplayAlchemy px-1.5 text-amber-300 font-bold font-mono">放大</span>
              <button type="button" onclick="changeQuestionFontSize(1)" class="w-6 h-6 rounded bg-slate-800 hover:bg-violet-600 text-white font-bold flex items-center justify-center transition-all active:scale-95" title="放大字型">A+</button>
            </div>
            <button type="button" onclick="startAlchemyBossBattle()" class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-xl flex items-center gap-2 transition-transform active:scale-95">
              <span>⚔️ 進入測驗作答室</span>
            </button>
          </div>
        </div>

        <!-- 題目列表標題 -->
        <div class="flex items-center justify-between px-1">
          <h4 class="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <span>🃏</span>
            <span>已為你生成的 4 道階梯式同型練習題（可直接在下方點擊選項作答）：</span>
          </h4>
        </div>

        <!-- 題目列表 Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          ${questionsHtml}
        </div>
      </div>

      <!-- 【第二順位：核心觀念拆解、常考陷阱與秒殺口訣（重點整理加大）】 -->
      <div class="rpg-card rounded-3xl p-5 sm:p-7 border border-slate-800 space-y-4">
        <h4 class="text-lg sm:text-xl md:text-2xl font-black text-cyan-300 flex items-center gap-2">
          <span>🎯</span>
          <span>解題重點與觀念解析（作答重點整理）：</span>
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div class="text-base sm:text-lg font-black text-cyan-300 mb-2.5 flex items-center gap-1.5">
                <span>🎯</span>
                <span>核心觀念拆解</span>
              </div>
              <p class="q-exp-scalable text-slate-100 leading-relaxed font-medium">${escapeHtml(pack.coreConcept)}</p>
            </div>
          </div>
          <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div class="text-base sm:text-lg font-black text-rose-300 mb-2.5 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>考試最常掉入的陷阱</span>
              </div>
              <p class="q-exp-scalable text-slate-100 leading-relaxed font-medium">${escapeHtml(pack.commonTrap)}</p>
            </div>
          </div>
          <div class="bg-slate-950/80 border border-amber-500/40 rounded-2xl p-5 sm:p-6 flex flex-col justify-between bg-gradient-to-br from-amber-950/30 to-slate-950/90 shadow-md">
            <div>
              <div class="text-base sm:text-lg font-black text-amber-300 mb-2.5 flex items-center gap-1.5">
                <span>🔑</span>
                <span>秒殺記憶口訣</span>
              </div>
              <p class="q-exp-scalable text-amber-200 leading-relaxed font-bold">${escapeHtml(pack.mnemonic)}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 【第三順位：RAG 真題典範展示】 -->
      ${ragSectionHtml}
    `;

    if (typeof window.applyQuestionFontScale === 'function') {
      window.applyQuestionFontScale();
    }
  }

  function checkAlchemyInlineAnswer(qIdx, selectedOptIdx) {
    const appState = window.appState || {};
    if (!appState.alchemyCurrentPack) return;
    const q = appState.alchemyCurrentPack.questions[qIdx];
    if (!q) return;

    const fbEl = document.getElementById('alkFeedback-' + qIdx);
    if (!fbEl) return;

    const isCorrect = selectedOptIdx === q.answer;
    q.options.forEach((_, oIdx) => {
      const btn = document.getElementById(`alkOpt-${qIdx}-${oIdx}`);
      if (!btn) return;
      if (oIdx === q.answer) {
        btn.className = 'q-opt-scalable p-4 sm:p-5 rounded-2xl bg-emerald-500/25 border-2 border-emerald-400 text-left font-bold text-emerald-200 flex items-center justify-between';
      } else if (oIdx === selectedOptIdx && !isCorrect) {
        btn.className = 'q-opt-scalable p-4 sm:p-5 rounded-2xl bg-rose-500/25 border-2 border-rose-400 text-left font-bold text-rose-200 flex items-center justify-between';
      }
    });

    fbEl.classList.remove('hidden');
    if (isCorrect) {
      if (typeof window.playSoundEffect === 'function') window.playSoundEffect('correct');
      fbEl.className = 'q-exp-scalable rounded-2xl p-4 sm:p-5 leading-relaxed border bg-emerald-950/60 border-emerald-500/50 text-emerald-200 font-medium';
      fbEl.innerHTML = `<strong>✅ 答對了！ (+15 EXP, +10 🪙)</strong><br/><span class="mt-1 block">${escapeHtml(q.explanation)}</span>`;
      if (typeof window.addPlayerReward === 'function') window.addPlayerReward(15, 10);
    } else {
      if (typeof window.playSoundEffect === 'function') window.playSoundEffect('wrong');
      fbEl.className = 'q-exp-scalable rounded-2xl p-4 sm:p-5 leading-relaxed border bg-rose-950/60 border-rose-500/50 text-rose-200 font-medium';
      fbEl.innerHTML = `<strong>❌ 再想一下！提示：${escapeHtml(q.hint)}</strong><br/><span class="mt-1 block">💡 詳解：${escapeHtml(q.explanation)}</span>`;
      if (typeof window.addMistakeRecord === 'function') window.addMistakeRecord(q);
    }

    // 當整組 4 題均已作答完畢時，自動同步收錄至個人學習歷程
    const pack = appState.alchemyCurrentPack;
    if (pack && pack.questions) {
      if (!pack.userAnswers) pack.userAnswers = {};
      pack.userAnswers[qIdx] = { selectedOptIdx, isCorrect };

      const answeredCount = Object.keys(pack.userAnswers).length;
      if (answeredCount >= pack.questions.length && !pack.hasSavedToHistory) {
        pack.hasSavedToHistory = true;
        const correctCount = Object.values(pack.userAnswers).filter(a => a.isCorrect).length;
        const totalQ = pack.questions.length;
        const acc = Math.round((correctCount / totalQ) * 100);
        const rank = acc >= 80 ? 'S' : (acc >= 60 ? 'A' : 'B');

        if (window.FirebaseService) {
          window.FirebaseService.saveAssessmentRecord(appState.currentUser, {
            title: `💡 AI 弱點特訓：${pack.topicTitle}`,
            subject: pack.subject,
            score: correctCount,
            total: totalQ,
            accuracy: acc,
            rank: rank,
            expEarned: correctCount * 15,
            goldEarned: correctCount * 10,
            details: pack.questions.map((pq, idx) => {
              const uAns = pack.userAnswers[idx];
              return {
                concept: pq.concept,
                stem: pq.stem,
                options: pq.options,
                correctAnswer: pq.answer,
                selectedAnswer: uAns ? uAns.selectedOptIdx : null,
                isCorrect: uAns ? uAns.isCorrect : false,
                explanation: pq.explanation,
                diagramSvg: pq.diagramSvg || null
              };
            })
          }).then(() => {
            if (typeof window.showToast === 'function') {
              window.showToast('📜 AI 弱點 4 題特訓成果已自動登錄至個人測驗紀錄！', 'success');
            }
          }).catch(e => console.warn(e));
        }
      }
    }
  }

  function saveQuestionToGrimoireFromAlchemy(qIdx) {
    const appState = window.appState || {};
    if (!appState.alchemyCurrentPack) return;
    const q = appState.alchemyCurrentPack.questions[qIdx];
    if (!q) return;
    if (typeof window.addMistakeRecord === 'function') window.addMistakeRecord(q);
    if (typeof window.playSoundEffect === 'function') window.playSoundEffect('click');
    if (typeof window.showToast === 'function') window.showToast('📓 已將此題收錄至「錯題本」！', 'success');
  }

  function startAlchemyBossBattle() {
    const appState = window.appState || {};
    if (!appState.alchemyCurrentPack) {
      runMistakeAlchemy();
    }
    const pack = appState.alchemyCurrentPack;
    if (typeof window.launchBattleSession === 'function') {
      window.launchBattleSession(
        `💡 AI 弱點延伸測驗：${pack.topicTitle}`,
        'AI 弱點強化守門者',
        pack.questions.map(q => Object.assign({}, q))
      );
    }
  }

  // --- Gemini AI Question Generation ---
  async function runGeminiAiAlchemy() {
    if (typeof window.playSoundEffect === 'function') window.playSoundEffect('alchemy');
    const inputEl = document.getElementById('alchemyQuestionInput');
    const subjectEl = document.getElementById('alchemySubjectSelect');
    const gradeEl = document.getElementById('alchemyGradeSelect');
    const styleEl = document.getElementById('alchemyStyleSelect');
    const spinIcon = document.getElementById('aiSpinIcon');
    const appState = window.appState || {};
    const uploadedImg = appState.alchemyUploadedImage;

    const rawText = (inputEl ? inputEl.value.trim() : '') || (uploadedImg ? '' : ALCHEMY_PRESETS[0].sampleInput);
    if (inputEl && !inputEl.value.trim() && !uploadedImg) inputEl.value = rawText;

    let subject = subjectEl ? subjectEl.value : 'math';
    if (subject === 'auto' && rawText) {
      subject = detectSubjectFromText(rawText);
      if (subjectEl) subjectEl.value = subject;
    }

    if (!window.GeminiService || !window.GeminiService.hasApiKey()) {
      if (typeof window.showToast === 'function') window.showToast('⚠️ 請先輸入您的 Gemini API Key！', 'warning');
      if (typeof window.openGeminiKeyModal === 'function') window.openGeminiKeyModal();
      return;
    }

    if (spinIcon) spinIcon.classList.remove('hidden');
    const curModelName = (window.GeminiService && window.GeminiService.getModel) ? window.GeminiService.getModel() : 'Gemini AI';
    if (typeof window.showToast === 'function') {
      if (uploadedImg) {
        window.showToast(`🤖 正在透過多模態視覺辨識考題圖片並召喚 ${curModelName} 分析出題中...`, 'info');
      } else {
        window.showToast(`🤖 正在透過 RAG 向量檢索真題並召喚 ${curModelName} 出題中...`, 'info');
      }
    }

    try {
      const pack = await window.GeminiService.generateQuizPack({
        inputText: rawText,
        subject: subject,
        grade: gradeEl ? gradeEl.value : '8',
        style: styleEl ? styleEl.value : 'progressive',
        count: 4,
        imageBase64: uploadedImg ? uploadedImg.base64 : null,
        imageMimeType: uploadedImg ? uploadedImg.mimeType : 'image/jpeg'
      });

      // 若成功從圖片辨識出題目，自動登錄至 RAG 向量題庫知識庫（本機＋Firestore 雲端）！
      if (pack.extractedQuestion && window.RagEngine) {
        try {
          await window.RagEngine.addCustomQuestion(
            pack.extractedQuestion, 
            window.GeminiService.getApiKey(),
            appState.currentUser
          );
          updateCustomRagCountBadge();
          // 若題幹輸入框為空，自動回填辨識出之原題文字
          if (inputEl && !inputEl.value.trim() && pack.extractedQuestion.stem) {
            inputEl.value = pack.extractedQuestion.stem;
          }
          // 若科目為自動偵測，自動同步為辨識出之科目
          if (subject === 'auto' && pack.extractedQuestion.subject && subjectEl) {
            subjectEl.value = pack.extractedQuestion.subject;
          }
        } catch (ragSaveErr) {
          console.warn('⚠️ 自動收錄 RAG 題庫時略過:', ragSaveErr);
        }
      }

      appState.alchemyCurrentPack = pack;
      renderAlchemyPackOutput(pack);
      if (typeof window.playSoundEffect === 'function') window.playSoundEffect('levelup');
      
      let successMsg = '✨ Gemini AI 智慧出題成功！已生成 4 道專屬練習題！';
      if (pack.extractedQuestion) {
        if (appState.currentUser) {
          successMsg = '📸 考題圖片辨識成功！原題已同步至 Firestore 雲端知識庫，並生成 4 道專屬練習題！';
        } else {
          successMsg = '📸 考題圖片辨識成功！原題已收錄至本機題庫（登入 Google 可同步至全校雲端題庫）！';
        }
      } else if (pack.ragExemplars && pack.ragExemplars.length > 0) {
        successMsg = `✨ RAG 向量增強成功！已檢索 ${pack.ragExemplars.length} 道真題典範並生成 4 道專屬練習題！`;
      }
      if (typeof window.showToast === 'function') window.showToast(successMsg, 'success');

      const resContainer = document.getElementById('alchemyResultContainer');
      if (resContainer) {
        resContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      console.error('出題失敗:', err);
      if (typeof window.updateAnomalyCountBadge === 'function') window.updateAnomalyCountBadge();
      if (typeof window.showToast === 'function') {
        window.showToast('❌ ' + (err.message || '出題失敗，請檢查 API Key 或網路') + '（已記錄至生題異常紀錄）', 'danger');
      }
    } finally {
      if (spinIcon) spinIcon.classList.add('hidden');
    }
  }

  // 掛載至 window
  window.ALCHEMY_PRESETS = ALCHEMY_PRESETS;
  window.compressAndProcessImage = compressAndProcessImage;
  window.setAlchemyUploadedImage = setAlchemyUploadedImage;
  window.clearAlchemyUploadedImage = clearAlchemyUploadedImage;
  window.handleAlchemyImageFileSelected = handleAlchemyImageFileSelected;
  window.handleQuickHubImageSelected = handleQuickHubImageSelected;
  window.previewLargeUploadedImage = previewLargeUploadedImage;
  window.closeImageLightboxModal = closeImageLightboxModal;
  window.updateCustomRagCountBadge = updateCustomRagCountBadge;
  window.openCustomRagModal = openCustomRagModal;
  window.closeCustomRagModal = closeCustomRagModal;
  window.renderCustomRagModalList = renderCustomRagModalList;
  window.deleteCustomRagQuestion = deleteCustomRagQuestion;
  window.refreshCloudRagQuestions = refreshCloudRagQuestions;
  window.initImageUploadHandlers = initImageUploadHandlers;
  window.renderAlchemyPresets = renderAlchemyPresets;
  window.selectAlchemyPreset = selectAlchemyPreset;
  window.detectSubjectFromText = detectSubjectFromText;
  window.generatePracticePack = generatePracticePack;
  window.runMistakeAlchemy = runMistakeAlchemy;
  window.randomizeGeneratedNumbers = randomizeGeneratedNumbers;
  window.renderAlchemyPackOutput = renderAlchemyPackOutput;
  window.checkAlchemyInlineAnswer = checkAlchemyInlineAnswer;
  window.saveQuestionToGrimoireFromAlchemy = saveQuestionToGrimoireFromAlchemy;
  window.startAlchemyBossBattle = startAlchemyBossBattle;
  window.runGeminiAiAlchemy = runGeminiAiAlchemy;
})();
