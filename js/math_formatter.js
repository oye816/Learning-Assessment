/**
 * 數學與理化公式人類易讀化模組 (Math Formatter)
 * 將 LaTeX 格式（如 $\frac{x}{0.8} - 150$、\times、\sqrt 等）轉換為自然易讀的文字與標準數學符號
 */

/**
 * 輔助函式：提取字串中成對大括號內容，支援多層巢狀結構
 * @param {string} str 輸入字串
 * @param {number} startIndex 左大括號的位置
 * @returns {{ content: string, endIndex: number } | null}
 */
function extractBracedContent(str, startIndex) {
  if (str[startIndex] !== '{') return null;
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return {
          content: str.substring(startIndex + 1, i),
          endIndex: i
        };
      }
    }
  }
  return null;
}

/**
 * 將含有 LaTeX 或程式碼式標記的數學式，轉換為人類直觀易讀的繁體中文自然數學格式
 * @param {string} text 原始文字
 * @returns {string} 轉換後之自然易讀字串
 */
export function humanizeMath(text) {
  if (!text || typeof text !== 'string') return text || '';

  let res = text;

  // 1. 去除 LaTeX 常見文字樣式標籤：\text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}
  res = res.replace(/\\(?:text|mathrm|mathbf|mathit)\{([^{}]+)\}/g, '$1');

  // 2. 角度次方的 ^\circ 或 ^{\circ} -> ° (必須在單獨 \circ 前處理)
  res = res.replace(/\^\{\\circ\}|\^\\circ|\^°/g, '°');

  // 3. 根號轉換 \sqrt[n]{A} 與 \sqrt{A} (支援花括號平衡與巢狀)
  const rootSuperscripts = {
    '2': '√',
    '3': '³√',
    '4': '⁴√',
    '5': '⁵√',
    '6': '⁶√',
    '7': '⁷√',
    '8': '⁸√',
    '9': '⁹√'
  };

  let sqrtLoop = 0;
  while (sqrtLoop < 10) {
    const idx = res.search(/\\sqrt\s*(\[\d+\])?\s*\{/);
    if (idx === -1) break;
    const fullMatch = res.slice(idx).match(/^\\sqrt\s*(\[(\d+)\])?\s*\{/);
    if (!fullMatch) break;
    const rootN = fullMatch[2] || '';
    const braceIdx = idx + fullMatch[0].length - 1;
    const braced = extractBracedContent(res, braceIdx);
    if (!braced) break;

    const inner = humanizeMath(braced.content).trim();
    let rep = '';
    const prefix = rootN ? (rootSuperscripts[rootN] || `${rootN}√`) : '√';
    if (!rootN && inner.length <= 2 && !/[\s+\-*/±×÷]/.test(inner)) {
      rep = `${prefix}${inner}`;
    } else {
      rep = `${prefix}(${inner})`;
    }

    res = res.substring(0, idx) + rep + res.substring(braced.endIndex + 1);
    sqrtLoop++;
  }

  // 4. 分數轉換 \frac{A}{B} 或 \dfrac{A}{B} (支援花括號平衡與巢狀運算)
  let fracLoop = 0;
  while (fracLoop < 10) {
    const idx = res.search(/\\(?:d?frac)\s*\{/);
    if (idx === -1) break;
    const firstBraceIdx = res.indexOf('{', idx);
    const first = extractBracedContent(res, firstBraceIdx);
    if (!first) break;

    let secondBraceIdx = -1;
    for (let i = first.endIndex + 1; i < res.length; i++) {
      if (res[i] === ' ' || res[i] === '\t') continue;
      if (res[i] === '{') {
        secondBraceIdx = i;
        break;
      }
      break;
    }
    if (secondBraceIdx === -1) break;
    const second = extractBracedContent(res, secondBraceIdx);
    if (!second) break;

    const num = humanizeMath(first.content).trim();
    const den = humanizeMath(second.content).trim();

    // 分子若包含加減運算或空格且未被外層括號包裹，則加上括號
    const wrapNum = /[\s+\-±×÷]/.test(num) && !(/^\([^(]+?\)$/.test(num));
    // 分母若包含加減乘除或空格且未被外層括號包裹，則加上括號
    const wrapDen = /[\s+\-±×÷*/]/.test(den) && !(/^\([^(]+?\)$/.test(den));
    const nStr = wrapNum ? `(${num})` : num;
    const dStr = wrapDen ? `(${den})` : den;
    const rep = `${nStr} / ${dStr}`;

    res = res.substring(0, idx) + rep + res.substring(second.endIndex + 1);
    fracLoop++;
  }

  // 5. 幾何線段、射線與向量
  res = res.replace(/\\(?:overline|bar)\{([^{}]+)\}/g, '線段 $1');
  res = res.replace(/\\vec\{([^{}]+)\}/g, '向量 $1');

  // 6. 常見運算符號與希臘/幾何符號對應表
  const symbolMap = {
    '\\\\times': ' × ',
    '\\\\div': ' ÷ ',
    '\\\\pm': ' ± ',
    '\\\\mp': ' ∓ ',
    '\\\\cdot': ' · ',
    '\\\\leq': ' ≤ ',
    '\\\\le': ' ≤ ',
    '\\\\geq': ' ≥ ',
    '\\\\ge': ' ≥ ',
    '\\\\neq': ' ≠ ',
    '\\\\ne': ' ≠ ',
    '\\\\approx': ' ≈ ',
    '\\\\equiv': ' ≡ ',
    '\\\\sim': ' ~ ',
    '\\\\cong': ' ≅ ',
    '\\\\infty': '∞',
    '\\\\pi': 'π',
    '\\\\theta': 'θ',
    '\\\\alpha': 'α',
    '\\\\beta': 'β',
    '\\\\gamma': 'γ',
    '\\\\Delta': '△',
    '\\\\triangle': '△',
    '\\\\angle': '∠',
    '\\\\perp': '⊥',
    '\\\\parallel': '//',
    '\\\\rightarrow': ' → ',
    '\\\\to': ' → ',
    '\\\\leftarrow': ' ← ',
    '\\\\degree': '°',
    '\\\\circ': '°',
    '\\\\%': '%'
  };

  for (const [pattern, repl] of Object.entries(symbolMap)) {
    res = res.replace(new RegExp(pattern, 'g'), repl);
  }

  // 7. 常見上標 (平方、立方、數字 0~9、正負號、變數 n, x, y)
  const superscripts = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', 'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ'
  };
  res = res.replace(/\^\{([0-9+\-nxy])\}/g, (m, p) => superscripts[p] || m);
  res = res.replace(/\^([0-9])/g, (m, p) => superscripts[p] || m);
  // 其他多字元或負數上標 ^{...}
  res = res.replace(/\^\{([^{}]+)\}/g, '^($1)');

  // 8. 常見下標 _{0~9} (化學式與數列常用)
  const subscripts = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
  };
  res = res.replace(/_\{([0-9])\}/g, (m, p) => subscripts[p] || m);
  res = res.replace(/_([0-9])/g, (m, p) => subscripts[p] || m);
  res = res.replace(/_\{([^{}]+)\}/g, '_($1)');

  // 9. LaTeX 括號與間距修飾符
  res = res.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
  res = res.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
  res = res.replace(/\\left\\\{/g, '{').replace(/\\right\\\}/g, '}');
  res = res.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
  res = res.replace(/\\[,;:!]/g, ' ');
  res = res.replace(/\\quad|\\qquad/g, ' ');

  // 10. 去除 LaTeX 行內與塊級數學定界符 $...$ 或 $$...$$
  res = res.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  res = res.replace(/\$([^\$]+)\$/g, '$1');

  // 11. 清除殘留反斜線跳脫字元（如 \$、\% 等）
  res = res.replace(/\\([%$#&_])/g, '$1');

  // 12. 清理多餘連續空白與符號修正
  res = res.replace(/\^°/g, '°');
  res = res.replace(/[ \t]{2,}/g, ' ');

  return res.trim();
}

// 掛載至全域 window，確保一般 script 標籤與 ES Module 皆可無縫存取
if (typeof window !== 'undefined') {
  window.humanizeMath = humanizeMath;
}
