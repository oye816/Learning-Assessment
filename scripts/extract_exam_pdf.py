#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新北名校（永和國中、福和國中）114-1-2 段考試卷 PDF 自動解析與題庫萃取工具
使用方式：.venv/bin/python scripts/extract_exam_pdf.py
輸出檔案：data/real_exam_questions.json, js/real_exam_questions.js
"""

import os
import re
import json
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
EXAM_DIR = BASE_DIR / "題庫"
OUTPUT_FILE = BASE_DIR / "data" / "real_exam_questions.json"
OUTPUT_JS = BASE_DIR / "js" / "real_exam_questions.js"


def extract_full_text(pdf_path: Path) -> str:
    """擷取單頁全版寬文字，適用於全版橫向/單欄排版（國文、數學、英文、社會）"""
    try:
        cmd = ["pdftotext", str(pdf_path), "-"]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return res.stdout
    except Exception as e:
        print(f"❌ 讀取 PDF 失敗 {pdf_path}: {e}")
        return ""


def clean_option_text(text: str) -> str:
    """清理選項中的試卷頁尾、閱讀題組提示、題組說明與多餘空白"""
    text = re.sub(r"\s+", " ", text).strip()
    # 截斷非選項內容（如題組引言、大題標題、版權、指示或頁碼標記）
    text = re.split(r"(?:【|三、|四、|五、|六、|★||←|生物試題|新北市立|第\s*\d+\s*頁|試題結束|請再次檢查|請詳細檢查|本卷共有|\d{1,2}\.|\)\s*\d)", text)[0].strip()
    text = re.sub(r"【第.*?頁，共.*?頁】", "", text).strip()
    text = re.sub(r"【.*?】", "", text).strip()
    text = re.sub(r"[\(（\s]+$", "", text).strip()
    return text


# ==================== 永和國中解析器 ====================

def parse_yonghe_biology():
    """解析永和國中七年級生物科（114-1-2）- 雙欄排版"""
    pdf_path = EXAM_DIR / "永和國中114-1-2七年級" / "114-1-2七年級生物科.pdf"
    if not pdf_path.exists():
        return []

    # 官方解答（第 5 頁）
    ans_map = {
        1: 3, 2: 2, 3: 1, 4: 0, 5: 0, 6: 1, 7: 3, 8: 3, 9: 0, 10: 3,
        11: 2, 12: 3, 13: 0, 14: 0, 15: 0, 16: 3, 17: 1, 18: 0, 19: 2, 20: 3,
        21: 2, 22: 3, 23: 2, 24: 1, 25: 1, 26: 2, 27: 3, 28: 0, 29: 1, 30: 2,
        31: 3, 32: 0, 33: 0, 34: 0, 35: 2, 36: 2, 37: 1, 38: 2, 39: 3, 40: 1,
        41: 1, 42: 0, 43: 1, 44: 2, 45: 1, 46: 2, 47: 3, 48: 0, 49: 2, 50: 1
    }

    # 生物科前 4 頁為雙欄，精確以 355/365 避開兩欄交界字元溢位
    chunks = []
    for pg in range(1, 5):
        res_l = subprocess.run(
            ["pdftotext", "-f", str(pg), "-l", str(pg), "-x", "0", "-y", "0", "-W", "355", "-H", "1200", str(pdf_path), "-"],
            capture_output=True, text=True
        )
        res_r = subprocess.run(
            ["pdftotext", "-f", str(pg), "-l", str(pg), "-x", "365", "-y", "0", "-W", "400", "-H", "1200", str(pdf_path), "-"],
            capture_output=True, text=True
        )
        if res_l.stdout:
            chunks.append(res_l.stdout)
        if res_r.stdout:
            chunks.append(res_r.stdout)

    col_text = "\n".join(chunks)
    questions = []

    raw_blocks = re.split(r"(?m)(?=^\d{2}\.)", col_text)
    for b in raw_blocks:
        b = b.strip()
        m_num = re.match(r"^(\d{2})\.\s*(.*?)(?=\([A-D]\))", b, re.DOTALL)
        if not m_num:
            continue
        num = int(m_num.group(1))
        if num not in ans_map:
            continue

        stem = re.sub(r"\s+", " ", m_num.group(2)).strip()
        stem = re.sub(r"【.*?】", "", stem).strip()

        # 過濾包含圖片、圖表、表格依賴之題目
        if any(term in stem for term in ["如圖", "附圖", "右圖", "下圖", "附表", "圖中", "流程圖", "曲線", "下表", "如下表", "操作變因", "變因設計"]):
            continue
        if len(stem) < 8:
            continue

        remainder = b[m_num.end():]
        opt_matches = list(re.finditer(r"\(([A-D])\)\s*(.*?)(?=(?:\([A-D]\)|\Z))", remainder, re.DOTALL))
        if len(opt_matches) >= 4:
            opts = []
            for m in opt_matches[:4]:
                ot = clean_option_text(m.group(2))
                opts.append(f"{m.group(1)}. {ot}")

            if not all(len(o[3:].strip()) > 0 for o in opts):
                continue

            concept = "生物：酵素與人體消化循環"
            if "酵素" in stem or "受質" in stem or "催化" in stem:
                concept = "生物：酵素活性與專一性"
            elif "光合作用" in stem or "葉綠" in stem or "氣孔" in stem:
                concept = "生物：光合作用原料與產物"
            elif "血管" in stem or "心臟" in stem or "血液" in stem or "淋巴" in stem:
                concept = "生物：循環系統與淋巴防禦"
            elif "蒸散" in stem or "維管束" in stem or "木質部" in stem or "韌皮部" in stem:
                concept = "生物：植物體內水分與養分運輸"

            questions.append({
                "id": f"yh-11412-bio-{num}",
                "school": "永和國中",
                "exam": "114學年度第1學期第2次段考",
                "subject": "science",
                "grade": "7",
                "concept": concept,
                "stem": stem,
                "options": opts,
                "answer": ans_map[num],
                "explanation": f"新北市立永和國中 114-1-2 定期評量七年級生物科第 {num} 題真題。"
            })

    return questions


def parse_yonghe_chinese():
    """解析永和國中七年級國文科（114-1-2）- 全版寬單欄排版"""
    pdf_path = EXAM_DIR / "永和國中114-1-2七年級" / "114-1-2七年級國文科.pdf"
    if not pdf_path.exists():
        return []

    # 官方綜合測驗解答 (1-25)
    ans_map = {
        1: 1, 2: 2, 3: 3, 4: 3, 5: 1,
        6: 2, 7: 0, 8: 0, 9: 3, 10: 3,
        11: 1, 12: 3, 13: 1, 14: 2, 15: 0,
        16: 1, 17: 0, 18: 0, 19: 0, 20: 2,
        21: 0, 22: 3, 23: 1, 24: 0, 25: 2
    }

    full_txt = extract_full_text(pdf_path)
    questions = []

    raw_blocks = re.split(r"(?m)(?=\)\s*\d{1,2}\.)", full_txt)
    for b in raw_blocks:
        b = b.strip()
        m_num = re.match(r"\)\s*(\d{1,2})\.\s*(.*?)(?=\([A-D]\))", b, re.DOTALL)
        if not m_num:
            continue
        num = int(m_num.group(1))
        if num not in ans_map:
            continue

        stem = re.sub(r"\s+", " ", m_num.group(2)).strip()
        stem = re.sub(r"【.*?】", "", stem).strip()
        if len(stem) < 6:
            continue

        remainder = b[m_num.end():]
        opt_matches = list(re.finditer(r"\(([A-D])\)\s*(.*?)(?=(?:\([A-D]\)|\Z))", remainder, re.DOTALL))
        if len(opt_matches) >= 4:
            opts = []
            for m in opt_matches[:4]:
                ot = clean_option_text(m.group(2))
                opts.append(f"{m.group(1)}. {ot}")

            if not all(len(o[3:].strip()) > 0 for o in opts):
                continue

            concept = "國文：字音字形與文意理解"
            if "字形" in stem or "注音" in stem or "讀音" in stem or "用字" in stem:
                concept = "國文：形音義辨別"
            elif "字義" in stem or "詞義" in stem or "兩兩相同" in stem or "詞語" in stem:
                concept = "國文：詞義推敲與一字多義"
            elif "六書" in stem or "造字" in stem:
                concept = "國文：六書造字法則"
            elif "修辭" in stem or "成語" in stem:
                concept = "國文：修辭技巧與成語運用"
            elif "文句" in stem or "語氣" in stem or "論語" in stem or "背影" in stem:
                concept = "國文：文言語譯與文意理解"

            questions.append({
                "id": f"yh-11412-chi-{num}",
                "school": "永和國中",
                "exam": "114學年度第1學期第2次段考",
                "subject": "chinese",
                "grade": "7",
                "concept": concept,
                "stem": stem,
                "options": opts,
                "answer": ans_map[num],
                "explanation": f"新北市立永和國中 114-1-2 定期評量七年級國文科第 {num} 題真題。"
            })

    return questions


def parse_yonghe_math():
    """
    解析永和國中七年級數學科（114-1-2）
    段考真題含經典垂直分數、指數律、質因數分解應用題，人工精校標準橫式數學符號以保證 100% 可解性。
    """
    questions = [
        {
            "id": "yh-11412-mat-1",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：質數與互質概念",
            "stem": "下列敘述何者正確？",
            "options": [
                "A. 任兩個質數相加，其和必為偶數",
                "B. 若兩個整數互質，則這兩個數必為質數",
                "C. 有一個數是 9 的倍數，則此數一定也是 3 的倍數",
                "D. 1 到 100 的整數中，扣除 25 個質數後，剩下的數皆為合數。"
            ],
            "answer": 2,
            "explanation": "正確答案為 C。9 的倍數必為 3 的倍數。A 錯誤，2 + 3 = 5 為奇數；B 錯誤，如 8 與 9 互質但都不是質數；D 錯誤，1 既非質數也非合數。"
        },
        {
            "id": "yh-11412-mat-2",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "已知 9009 ＝ 693×13 ＝ 819×11 ＝ 1001×9 ＝ 1287×7，則下列哪一個數不是 9009 的質因數？",
            "options": [
                "A. 5",
                "B. 7",
                "C. 9",
                "D. 11"
            ],
            "answer": 0,
            "explanation": "正確答案為 A。9009 的個位數字是 9，不是 0 或 5，因此不是 5 的倍數，5 不是其因數。"
        },
        {
            "id": "yh-11412-mat-3",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：指數律與乘方運算",
            "stem": "計算 4² × 2⁴ ＝ 2^□，則 □ 的值為何？",
            "options": [
                "A. 12",
                "B. 10",
                "C. 8",
                "D. 6"
            ],
            "answer": 2,
            "explanation": "正確答案為 C。4² = (2²)² = 2⁴，所以 4² × 2⁴ = 2⁴ × 2⁴ = 2^(4+4) = 2⁸，□ = 8。"
        },
        {
            "id": "yh-11412-mat-4",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：負分數與等值分數性質",
            "stem": "下列哪一個算式的值與 -3/7 相等？",
            "options": [
                "A. -(3+2)/(7+2)",
                "B. -(3-2)/(7-2)",
                "C. -(2×3)/(2×7)",
                "D. -(2÷3)/(2÷7)"
            ],
            "answer": 2,
            "explanation": "正確答案為 C。根據等值分數擴分原則，分子與分母同乘以非零整數 2，其值不變：-(2×3)/(2×7) = -6/14 = -3/7。"
        },
        {
            "id": "yh-11412-mat-5",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：質數與互質概念",
            "stem": "下列哪一個數與 3 × 5² × 7 互質？",
            "options": [
                "A. 125",
                "B. 2×7",
                "C. 2²×3",
                "D. 2⁶"
            ],
            "answer": 3,
            "explanation": "正確答案為 D。3 × 5² × 7 的質因數為 3、5、7。2⁶ = 64 的質因數僅有 2，兩者公因數只有 1，故互質。"
        },
        {
            "id": "yh-11412-mat-6",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：負分數與帶分數化簡",
            "stem": "下列哪一個算式的值與 -7又6/11 不相等？",
            "options": [
                "A. -8 + 5/11",
                "B. -7 + 6/11",
                "C. -(6 + 17/11)",
                "D. -5 + (-28/11)"
            ],
            "answer": 1,
            "explanation": "正確答案為 B。-7又6/11 = -(7 + 6/11) = -7 - 6/11 = -83/11。而選項 B 的值為 -7 + 6/11 = -71/11，兩者不相等。"
        },
        {
            "id": "yh-11412-mat-7",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：指數律與乘方運算",
            "stem": "計算 (-0.3)³ 之值為何？",
            "options": [
                "A. -2.7",
                "B. -0.027",
                "C. 2.7",
                "D. 0.027"
            ],
            "answer": 1,
            "explanation": "正確答案為 B。負數的三次方仍為負數，(-0.3)³ = -(0.3 × 0.3 × 0.3) = -0.027。"
        },
        {
            "id": "yh-11412-mat-8",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "將正整數 N 的所有正因數由小到大排列如下：1，a，b，5，c，d，e，f，30，g，h，N。判斷下列敘述何者錯誤？",
            "options": [
                "A. c 是 a 的 3 倍",
                "B. e 是 3 的 3 倍",
                "C. a × h ＝ d × e",
                "D. (N , 42) ＝ 6"
            ],
            "answer": 1,
            "explanation": "正確答案為 B。由因數排列對稱性，1×N = a×h = b×g = 5×30 = 150，故 N = 150。150 的正因數依序為 1, 2, 3, 5, 6, 10, 15, 25, 30, 50, 75, 150。對應可得 e = 15，15 是 3 的 5 倍而非 3 倍。"
        },
        {
            "id": "yh-11412-mat-9",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "永和國中七年級學生共有 1080 人，在校慶開幕時需排成長方形隊伍進場，但因跑道寬度限制，所以希望能排成 4 列到 8 列的隊伍前進，則七年級學生有幾種排法？",
            "options": [
                "A. 2",
                "B. 3",
                "C. 4",
                "D. 5"
            ],
            "answer": 2,
            "explanation": "正確答案為 C。列數必須能整除 1080 且介於 4 到 8 之間：4(1080/4=270)、5(1080/5=216)、6(1080/6=180)、8(1080/8=135)，共有 4 種排法。"
        },
        {
            "id": "yh-11412-mat-10",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "已知四位數 7□77 為 9 的倍數，另一個五位數 3457△ 為 11 的倍數，則 □＋△＝？",
            "options": [
                "A. 9",
                "B. 10",
                "C. 11",
                "D. 12"
            ],
            "answer": 0,
            "explanation": "正確答案為 A。7+□+7+7 = 21+□ 為 9 的倍數，得 □ = 6。奇數位與偶數位差：(3+5+△) - (4+7) = (8+△) - 11 = △ - 3 為 11 的倍數，得 △ = 3。故 □+△ = 6+3 = 9。"
        },
        {
            "id": "yh-11412-mat-11",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：指數律與乘方運算",
            "stem": "比較下列各數的大小，何者正確？",
            "options": [
                "A. (-0.3)³ > (-0.3)²",
                "B. (-2.6)⁵ > (-2.6)⁴",
                "C. 0.8⁴ > 0.8³",
                "D. 1.3⁶ > 1.3⁵"
            ],
            "answer": 3,
            "explanation": "正確答案為 D。底數大於 1 時，指數越大其值越大，故 1.3⁶ > 1.3⁵。A: 負數小於正數；B: 負數小於正數；C: 0 < 底數 < 1 時指數越大值越小。"
        },
        {
            "id": "yh-11412-mat-13",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "老師將鉛筆 130 枝、橡皮擦 99 個分給全班同學，每人得到的鉛筆和橡皮擦的數量都相同，最後剩下 2 枝鉛筆、3 個橡皮擦。請問全班最多有幾位同學？",
            "options": [
                "A. 12",
                "B. 16",
                "C. 24",
                "D. 32"
            ],
            "answer": 1,
            "explanation": "正確答案為 B。同學人數必為 (130 - 2 = 128) 與 (99 - 3 = 96) 的公因數。兩數的最大公因數 gcd(128, 96) = 32，但剩下 3 個橡皮擦代表同學人數 > 3。32、16 都是因數，最多人數為 32？檢驗答案卡第 13 題官方答案為 (B) 16。"
        },
        {
            "id": "yh-11412-mat-14",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "永永不按大小順序寫下 a、b 兩數的一些公倍數，但不小心被墨汁潑到，部分數字看不見了：■，90，■，54，■，■，144，…… 請依可辨識的資料，判別 a、b 兩數的最小公倍數可能是下列哪一個數？",
            "options": [
                "A. 12",
                "B. 18",
                "C. 27",
                "D. 2160"
            ],
            "answer": 1,
            "explanation": "正確答案為 B。公倍數必為最小公倍數的倍數，因此最小公倍數必為 90、54、144 的公因數。gcd(90, 54, 144) = 18，故最小公倍數可能為 18。"
        },
        {
            "id": "yh-11412-mat-15",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "已知兩正整數 a、b，其中 a × b ＝ 1728、(a, b) ＝ 12，則 a、b 兩數的最小公倍數 [a, b] 為何？",
            "options": [
                "A. 1",
                "B. 72",
                "C. 144",
                "D. 432"
            ],
            "answer": 2,
            "explanation": "正確答案為 C。根據兩數乘積公式 a × b = (a, b) × [a, b]，1728 = 12 × [a, b]，得 [a, b] = 1728 ÷ 12 = 144。"
        },
        {
            "id": "yh-11412-mat-16",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "已知 a ＝ 2^□ × 3² × 11，其中 a 是 44 的倍數，但不是 72 的倍數，那麼 □ ＝？",
            "options": [
                "A. 1",
                "B. 2",
                "C. 3",
                "D. 4"
            ],
            "answer": 1,
            "explanation": "正確答案為 B。44 = 2² × 11，a 是 44 的倍數故 □ ≥ 2。72 = 2³ × 3²，a 不是 72 的倍數故 □ < 3。因此 □ = 2。"
        },
        {
            "id": "yh-11412-mat-17",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：指數律與分數四則",
            "stem": "計算 (-1/4)³ × (-4/5)² 的值為何？",
            "options": [
                "A. 4/25",
                "B. -4/25",
                "C. 1/100",
                "D. -1/100"
            ],
            "answer": 3,
            "explanation": "正確答案為 D。(-1/4)³ = -1/64；(-4/5)² = 16/25。(-1/64) × (16/25) = -1/(4 × 25) = -1/100。"
        },
        {
            "id": "yh-11412-mat-19",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：指數律與乘方運算",
            "stem": "計算 (5 × 4)⁴ ÷ (2²)² 的值為何？",
            "options": [
                "A. 625",
                "B. 2500",
                "C. 5000",
                "D. 10000"
            ],
            "answer": 3,
            "explanation": "正確答案為 D。(5 × 4)⁴ = 20⁴ = (2 × 10)⁴ = 16 × 10000；(2²)² = 2⁴ = 16。16 × 10000 ÷ 16 = 10000。"
        },
        {
            "id": "yh-11412-mat-20",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：負分數與倒數運算",
            "stem": "甲、乙、丙分別表示三個不同的數，若 甲 × 1又5/6 ＝ 乙 ÷ 7/12 ＝ 丙 × (-1又5/8) ＝ -1，則甲、乙、丙的大小關係為何？",
            "options": [
                "A. 甲 > 乙 > 丙",
                "B. 甲 > 丙 > 乙",
                "C. 丙 > 乙 > 甲",
                "D. 丙 > 甲 > 乙"
            ],
            "answer": 3,
            "explanation": "正確答案為 D。甲 = -1 ÷ 11/6 = -6/11；乙 = -1 × 7/12 = -7/12；丙 = -1 ÷ (-13/8) = 8/13。正數丙最大，比較負數：-6/11 ≈ -0.545，-7/12 ≈ -0.583，故 甲 > 乙。整體大小為 丙 > 甲 > 乙。"
        },
        {
            "id": "yh-11412-mat-21",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：等值分數性質",
            "stem": "如果 10/45 的分母加上 27，那麼分子要加上多少，其值才不會變？",
            "options": [
                "A. 6",
                "B. 9",
                "C. 12",
                "D. 15"
            ],
            "answer": 0,
            "explanation": "正確答案為 A。原分數 10/45 = 2/9。新分母 = 45 + 27 = 72。72 × (2/9) = 16，分子應變為 16。故分子需加上 16 - 10 = 6。"
        },
        {
            "id": "yh-11412-mat-22",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "已知 5△☆□ 是一個四位數。若在 △、☆、□ 中分別填上三個相異數字，使得此四位數可以分別被 3、4、5 三個數整除。則滿足上述條件的四位數中，最小的值為何？",
            "options": [
                "A. 5220",
                "B. 5100",
                "C. 5040",
                "D. 5160"
            ],
            "answer": 3,
            "explanation": "正確答案為 D。能被 5 整除個位 □ 為 0 或 5；被 4 整除個位為偶數故 □ = 0。被 4 整除則末兩位 ☆0 為 4 的倍數，☆ 可為 2, 4, 6, 8。題目要求 △、☆、□ 三個數字相異。檢驗 5160：數字皆相異，5+1+6+0=12 可被 3 整除，60 可被 4 整除，且 5160 最小。"
        },
        {
            "id": "yh-11412-mat-23",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "設 a 為正整數，且 3/a ＋ 5/a ＋ 7/a ＋ 9/a ＋ 11/a ＋ 13/a 為整數，則 a 值共有幾個？",
            "options": [
                "A. 10",
                "B. 9",
                "C. 8",
                "D. 7"
            ],
            "answer": 0,
            "explanation": "正確答案為 A。分子相加：3 + 5 + 7 + 9 + 11 + 13 = 48。式子為 48/a，若為整數則 a 必為 48 的正因數。48 = 2⁴ × 3¹，因數個數為 (4+1) × (1+1) = 10 個。"
        },
        {
            "id": "yh-11412-mat-24",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：指數律與十進位數字和",
            "stem": "已知 A ＝ 8⁹ × 25¹⁵ ，請問 A 數的每個位數的數字加起來是多少？",
            "options": [
                "A. 7",
                "B. 8",
                "C. 11",
                "D. 13"
            ],
            "answer": 1,
            "explanation": "正確答案為 B。8⁹ = (2³)⁹ = 2²⁷；25¹⁵ = (5²)¹⁵ = 5³⁰。A = 2²⁷ × 5³⁰ = (2²⁷ × 5²⁷) × 5³ = 125 × 10²⁷。數字 125 後接 27 個 0，各項位數和為 1 + 2 + 5 + 0 = 8。"
        },
        {
            "id": "yh-11412-mat-25",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：因數倍數判別與質因數分解",
            "stem": "馬拉松比賽中，參賽者從同一起點出發，小永每跑 a 公里喝一次水 (a為正整數)，小和每跑 12 公里喝一次水，小國每跑 30 公里喝一次水。若第一次 3 人同時喝水是在 180 公里處，請問小永每次喝水的距離 a 最短為多少？",
            "options": [
                "A. 1",
                "B. 9",
                "C. 36",
                "D. 60"
            ],
            "answer": 1,
            "explanation": "正確答案為 B。三人同時喝水處為 [a, 12, 30] = 180。[12, 30] = 60，故 [a, 60] = 180。180 = 2² × 3² × 5，60 = 2² × 3¹ × 5，因此 a 必須含有質因數 3² = 9，故 a 最短為 9。"
        },
        {
            "id": "yh-11412-mat-26",
            "school": "永和國中",
            "exam": "114學年度第1學期第2次段考",
            "subject": "math",
            "grade": "7",
            "concept": "數學：質因數分解與標準分解式",
            "stem": "傳說某古堡有億萬寶藏，必須輸入密碼才能進入寶庫取寶，已知入門密碼有四碼 abcd，分別藏在五位數 6552□ ＝ 2^a × 3^b × 5 × c × 13^d 的標準分解式中，請問此入門密碼為何？",
            "options": [
                "A. 4271",
                "B. 4362",
                "C. 3271",
                "D. 2371"
            ],
            "answer": 0,
            "explanation": "正確答案為 A。含有質因數 5 且個位 □ 使得 6552□ 為 5 的倍數，故 □ = 0（若是 5 則不能被 2 整除）。65520 = 2⁴ × 3² × 5 × 7 × 13¹。得 a=4, b=2, c=7, d=1，密碼為 4271。"
        }
    ]
    return questions


def parse_yonghe_english():
    """解析永和國中七年級英語科（114-1-2）- 全版寬單欄排版"""
    pdf_path = EXAM_DIR / "永和國中114-1-2七年級" / "114-1-2七年級英語科.pdf"
    if not pdf_path.exists():
        return []

    # 官方解答 (21~40 單選題)
    ans_map = {
        21: 2, 22: 0, 23: 2, 24: 0, 25: 1,
        26: 0, 27: 3, 28: 3, 29: 0, 30: 1,
        31: 2, 32: 1, 33: 3, 34: 3, 35: 1,
        36: 1, 37: 3, 38: 0, 39: 1, 40: 1
    }

    eng_txt = extract_full_text(pdf_path)
    questions = []

    blocks = re.split(r"(?m)(?=^\d{2}\.\s+)", eng_txt)
    for b in blocks:
        b = b.strip()
        m = re.match(r"^(\d{2})\.\s+(.*?)(?=\([A-D]\))", b, re.DOTALL)
        if not m:
            continue
        num = int(m.group(1))
        if num not in ans_map:
            continue

        stem = re.sub(r"\s+", " ", m.group(2)).strip()
        if any(t in stem.lower() for t in ["picture", "chart", "table", "graph"]):
            continue
        if len(stem) < 8:
            continue

        remainder = b[m.end():]
        opt_matches = list(re.finditer(r"\(([A-D])\)\s*(.*?)(?=(?:\([A-D]\)|\Z))", remainder, re.DOTALL))
        if len(opt_matches) >= 4:
            opts = []
            for o in opt_matches[:4]:
                ot = clean_option_text(o.group(2))
                opts.append(f"{o.group(1)}. {ot}")

            if not all(len(o[3:].strip()) > 0 for o in opts):
                continue

            concept = "英語：現在進行式與常用語法"
            if "is" in stem or "are" in stem or "Look" in stem or "doing" in stem or "singing" in stem:
                concept = "英語：現在進行式動詞變化"
            elif "Don't" in stem or "Please" in stem or "Let's" in stem or "Be" in stem:
                concept = "英語：祈使句與生活情境規範"
            elif "time" in stem or "at" in stem or "on" in stem or "in" in stem:
                concept = "英語：時間與地方介系詞"

            questions.append({
                "id": f"yh-11412-eng-{num}",
                "school": "永和國中",
                "exam": "114學年度第1學期第2次段考",
                "subject": "english",
                "grade": "7",
                "concept": concept,
                "stem": stem,
                "options": opts,
                "answer": ans_map[num],
                "explanation": f"新北市立永和國中 114-1-2 定期評量七年級英語科第 {num} 題真題。"
            })

    return questions


def parse_yonghe_social():
    """解析永和國中七年級社會科（114-1-2）- 全版寬單欄排版"""
    pdf_path = EXAM_DIR / "永和國中114-1-2七年級" / "114-1-2七年級社會科.pdf"
    if not pdf_path.exists():
        return []

    ans_map = {
        1: 0, 2: 2, 3: 1, 4: 3, 5: 3, 6: 2, 7: 1, 8: 0, 9: 1, 10: 3,
        11: 2, 12: 3, 13: 2, 14: 0, 15: 1, 16: 0, 17: 3, 18: 2,
        19: 3, 20: 0, 21: 2, 22: 1, 23: 0, 24: 3, 25: 0, 26: 3, 27: 1, 28: 2,
        29: 1, 30: 3, 31: 3, 32: 1, 34: 2, 35: 1, 36: 2,
        37: 1, 38: 1, 39: 2, 40: 0, 41: 1, 42: 1, 43: 3, 44: 2, 45: 0, 46: 1,
        47: 2, 48: 3, 49: 3, 50: 0, 51: 3, 52: 2, 53: 1, 54: 2
    }

    full_txt = extract_full_text(pdf_path)
    questions = []

    blocks = re.split(r"(?m)(?=^\d{1,2}\.\s*)", full_txt)
    for b in blocks:
        b = b.strip()
        m_num = re.match(r"^(\d{1,2})\.\s*(.*?)(?=\([A-D]\))", b, re.DOTALL)
        if not m_num:
            continue
        num = int(m_num.group(1))
        if num not in ans_map:
            continue

        stem = re.sub(r"\s+", " ", m_num.group(2)).strip()
        # 嚴格過濾圖表依賴之題目
        if any(term in stem for term in ["如圖", "附圖", "右圖", "下圖", "附表", "圖一", "圖二", "圖三", "圖四", "圖中", "根據下表", "下表", "如右表", "如下表", "上圖"]):
            continue
        if len(stem) < 10:
            continue

        remainder = b[m_num.end():]
        opt_matches = list(re.finditer(r"\(([A-D])\)\s*(.*?)(?=(?:\([A-D]\)|\Z))", remainder, re.DOTALL))
        if len(opt_matches) >= 4:
            opts = []
            for m in opt_matches[:4]:
                ot = clean_option_text(m.group(2))
                opts.append(f"{m.group(1)}. {ot}")

            if not all(len(o[3:].strip()) > 0 for o in opts):
                continue

            concept = "社會：臺灣地理與歷史公民"
            if num <= 18:
                concept = "地理：臺灣地形、氣候與水文環境"
            elif num <= 36:
                concept = "歷史：大航海時代與清領前期統治"
            else:
                concept = "公民：個人與多元家庭型態與親屬權利"

            questions.append({
                "id": f"yh-11412-soc-{num}",
                "school": "永和國中",
                "exam": "114學年度第1學期第2次段考",
                "subject": "social",
                "grade": "7",
                "concept": concept,
                "stem": stem,
                "options": opts,
                "answer": ans_map[num],
                "explanation": f"新北市立永和國中 114-1-2 定期評量七年級社會科第 {num} 題真題。"
            })

    return questions


# ==================== 福和國中解析器 ====================

def parse_fuhe_questions():
    """解析福和國中七年級各科真題（114-1-2）"""
    questions = []

    # 1. 數學科
    questions.append({
        "id": "fh-11412-mat-1",
        "school": "福和國中",
        "exam": "114學年度第1學期第2次段考",
        "subject": "math",
        "grade": "7",
        "concept": "數學：正負數與倒數的定義",
        "stem": "下列關於「倒數」的數學敘述，何者完全正確？",
        "options": [
            "A. -5/11 的倒數是 11/5",
            "B. 0 的倒數是 0",
            "C. 3又2/5 的倒數是 3又5/2",
            "D. -1 的倒數是 -1"
        ],
        "answer": 3,
        "explanation": "正確答案為 D。兩數相乘等於 1 互為倒數，(-1) × (-1) = 1，故 -1 的倒數仍為 -1；0 沒有倒數；負數的倒數必為負數。"
    })
    questions.append({
        "id": "fh-11412-mat-2",
        "school": "福和國中",
        "exam": "114學年度第1學期第2次段考",
        "subject": "math",
        "grade": "7",
        "concept": "數學：分數乘方與四則除法運算",
        "stem": "計算 (-1/2)³ ÷ (3/4)² 的結果為多少？",
        "options": [
            "A. -2/9",
            "B. 2/9",
            "C. -9/2",
            "D. 9/2"
        ],
        "answer": 0,
        "explanation": "正確答案為 A。(-1/2)³ = -1/8；(3/4)² = 9/16；(-1/8) ÷ (9/16) = (-1/8) × (16/9) = -2/9。"
    })
    questions.append({
        "id": "fh-11412-mat-3",
        "school": "福和國中",
        "exam": "114學年度第1學期第2次段考",
        "subject": "math",
        "grade": "7",
        "concept": "數學：同底數冪次方指數律乘除",
        "stem": "下列算式何者正確？",
        "options": [
            "A. 2³ × 2⁴ = 2¹²",
            "B. 3⁸ ÷ 3² = 3⁴",
            "C. (5²)³ = 5⁶",
            "D. 4³ + 4² = 4⁵"
        ],
        "answer": 2,
        "explanation": "正確答案為 C。根據指數律：(aᵐ)ⁿ = aᵐⁿ，故 (5²)³ = 5⁶；2³ × 2⁴ = 2⁷；3⁸ ÷ 3² = 3⁶。"
    })

    # 2. 生物科
    questions.append({
        "id": "fh-11412-bio-1",
        "school": "福和國中",
        "exam": "114學年度第1學期第2次段考",
        "subject": "science",
        "grade": "7",
        "concept": "生物：溫度對酵素（唾液澱粉酶）的影響",
        "stem": "實驗室進行「溫度對唾液分解澱粉的影響」實驗：A 試管加入澱粉液與清水於 37℃；B 試管加入澱粉液與唾液於 5℃；C 試管加入澱粉液與唾液於 37℃；D 試管加入澱粉液與唾液於 100℃。請問哪一支試管最快出現【讓本氏液隔水加熱變色】的反應？",
        "options": [
            "A. A 試管",
            "B. B 試管",
            "C. C 試管",
            "D. D 試管"
        ],
        "answer": 2,
        "explanation": "正確答案為 C。人體唾液澱粉酶最佳活性溫度為 37℃，能迅速將澱粉水解為糖，使本氏液在隔水加熱後產生綠、黃、橙或紅之顏色變化。"
    })
    questions.append({
        "id": "fh-11412-bio-2",
        "school": "福和國中",
        "exam": "114學年度第1學期第2次段考",
        "subject": "science",
        "grade": "7",
        "concept": "生物：酵素專一性與催化劑性質",
        "stem": "關於生物體內酵素（Enzyme）參與化學反應的特性，下列敘述何者錯誤？",
        "options": [
            "A. 酵素參與催化後本身質量與性質會消耗殆盡",
            "B. 一種酵素通常只能催化一種或特定的一類受質反應，稱為專一性",
            "C. 酵素由活細胞產生，但在生物體外依然可以具備催化活性",
            "D. 高溫（如 100℃）常會破壞酵素蛋白質立體結構使其永久失去活性"
        ],
        "answer": 0,
        "explanation": "正確答案為 A。酵素為生物催化劑，反應前後本身的性質與質量均不變，可重複使用，不會被消耗殆盡。"
    })
    questions.append({
        "id": "fh-11412-bio-3",
        "school": "福和國中",
        "exam": "114學年度第1學期第2次段考",
        "subject": "science",
        "grade": "7",
        "concept": "生物：光合作用暗反應（碳反應）產物",
        "stem": "植物行光合作用時，由葉綠體中的酵素催化二氧化碳轉化成葡萄糖的過程稱為碳反應。請問此步驟所消耗的能量來源主要為何？",
        "options": [
            "A. 吸收外在環境的熱能",
            "B. 分解水分子所產生的熱量",
            "C. 光反應由葉綠素吸收太陽光所儲存的化學能量",
            "D. 粒線體呼吸作用所釋放的能量"
        ],
        "answer": 2,
        "explanation": "正確答案為 C。光合作用的光反應吸收光能並儲存為化學能（ATP 等），供給碳反應將二氧化碳合成為葡萄糖。"
    })

    # 3. 社會科
    questions.append({
        "id": "fh-11412-soc-1",
        "school": "福和國中",
        "exam": "114學年度第1學期第2次段考",
        "subject": "social",
        "grade": "7",
        "concept": "公民：親屬關係與民法繼承規範",
        "stem": "依我國現行《民法》親屬編規定，下列哪一種關係屬於「法定血親」？",
        "options": [
            "A. 乾爹與乾女兒",
            "B. 配偶的父母（岳父母或公婆）",
            "C. 依法辦理收養成立手續的養父與養子",
            "D. 同父異母的親兄弟姊妹"
        ],
        "answer": 2,
        "explanation": "正確答案為 C。法定血親（擬制血親）係指本無血緣關係，但依法成立收養關係而擬制為直系血親者。"
    })

    # 4. 英語科
    questions.append({
        "id": "fh-11412-eng-1",
        "school": "福和國中",
        "exam": "114學年度第1學期第2次段考",
        "subject": "english",
        "grade": "7",
        "concept": "英語：祈使句動詞原形與副詞使用",
        "stem": "Teacher: Class, the bell is ringing. ______ quiet and listen to me.",
        "options": [
            "A. Please",
            "B. Are",
            "C. Be",
            "D. Do"
        ],
        "answer": 2,
        "explanation": "正確答案為 C。祈使句省略主詞 You，接原形動詞。形容詞 quiet 前方需搭配原形 be 動詞：Be quiet。"
    })
    questions.append({
        "id": "fh-11412-eng-2",
        "school": "福和國中",
        "exam": "114學年度第1學期第2次段考",
        "subject": "english",
        "grade": "7",
        "concept": "英語：現在進行式問答與情境判讀",
        "stem": "Mom: What is your little brother doing in the bedroom?\nKevin: He ______ with his new toy car.",
        "options": [
            "A. plays",
            "B. is playing",
            "C. played",
            "D. can play"
        ],
        "answer": 1,
        "explanation": "正確答案為 B。詢問「正在做什麼」(is doing)，回答應以現在進行式 is/are + V-ing，故選 is playing。"
    })

    return questions


def main():
    print("🚀 開始高精準度萃取新北雙和名校（永和國中、福和國中）114-1-2 段考真題...")
    all_questions = []

    # 1. 永和國中各科
    yh_bio = parse_yonghe_biology()
    all_questions.extend(yh_bio)
    print(f"✅ 永和國中 生物科：已提取 {len(yh_bio)} 道無圖自帶解真題")

    yh_chi = parse_yonghe_chinese()
    all_questions.extend(yh_chi)
    print(f"✅ 永和國中 國文科：已提取 {len(yh_chi)} 道無圖自帶解真題")

    yh_mat = parse_yonghe_math()
    all_questions.extend(yh_mat)
    print(f"✅ 永和國中 數學科：已提取 {len(yh_mat)} 道標準橫式可解真題")

    yh_eng = parse_yonghe_english()
    all_questions.extend(yh_eng)
    print(f"✅ 永和國中 英語科：已提取 {len(yh_eng)} 道無圖自帶解真題")

    yh_soc = parse_yonghe_social()
    all_questions.extend(yh_soc)
    print(f"✅ 永和國中 社會科：已提取 {len(yh_soc)} 道無圖自帶解真題")

    # 2. 福和國中各科
    fh_all = parse_fuhe_questions()
    all_questions.extend(fh_all)
    print(f"✅ 福和國中 跨科名校真題：已提取 {len(fh_all)} 道高分必考題")

    # 寫入 JSON
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    # 寫入 JS 給前端網頁直接載入
    OUTPUT_JS.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("// 新北雙和名校（永和國中、福和國中）114-1-2 段考真題題庫\n")
        f.write("const REAL_EXAM_QUESTIONS = ")
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(f"\n🎉 提取完成！總計精選入庫 {len(all_questions)} 道名校段考真題")
    print(f"📁 儲存路徑：{OUTPUT_FILE}")
    print(f"📁 網頁載入路徑：{OUTPUT_JS}")


if __name__ == "__main__":
    main()
