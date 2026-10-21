#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新北三大升學名校（海山、福和、永和國中）全段考真題批次解析與萃取工具
支援學期：第 1 學期、第 2 學期
支援段考：第 1 次段考、第 2 次段考、第 3 次段考（期末考）
涵蓋年級：七年級、八年級、九年級
涵蓋科目：國文、英文、數學、自然（生物/理化）、社會（歷史/地理/公民）

嚴格篩選品質規範：
1. 100% 純文字自給自足：排除依賴圖片、地圖、實驗圖之看圖題。
2. 排除聽力測驗題與無短文之閱讀題組。
3. 嚴謹四選項 (A, B, C, D) 完整對齊與官方答案匹配。
4. 人類化符號清洗，避免任何裸露 LaTeX 代碼。
"""

import os
import re
import json
import argparse
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
EXAM_BASE = BASE_DIR / "題庫"
OUTPUT_FILE = BASE_DIR / "data" / "real_exam_questions.json"
OUTPUT_JS = BASE_DIR / "js" / "real_exam_questions.js"


def clean_math_text(text: str) -> str:
    """清洗數學與符號標籤為人類直觀顯示格式"""
    if not text:
        return ""
    text = re.sub(r"\\frac\{([^{}]+)\}\{([^{}]+)\}", r"(\1 / \2)", text)
    text = text.replace("\\times", " × ").replace("\\div", " ÷ ")
    text = text.replace("\\sqrt", "√").replace("\\le", "≤").replace("\\ge", "≥").replace("\\ne", "≠")
    text = text.replace("$", "")
    return text.strip()


def clean_option_text(text: str) -> str:
    """清理選項中的多餘空白、版面標籤、頁碼說明、次頁題組洩漏"""
    text = re.sub(r"\s+", " ", text).strip()
    text = re.split(r"第\s*\d+\s*頁.*共\s*\d+\s*頁", text)[0]
    text = re.split(r"新北市立.*?(?:試題卷|答案卷|定期評量)", text)[0]
    text = re.split(r"【.*?(?:頁|試題).*?】", text)[0]
    text = re.split(r"■\s*題組[:：]?", text)[0]
    text = re.split(r"背面尚有.*", text)[0]
    text = re.split(r"試題結束.*", text)[0]
    text = re.split(r"請詳細檢查.*", text)[0]
    text = re.split(r"請再次檢查.*", text)[0]
    text = re.split(r"(?:【|三、|四、|五、|六、|★||←|本卷共有|本試卷共有)", text)[0]
    text = re.split(r"\b\d{1,2}\s*[\.、]\s*[^\n]{0,20}(?:何者|下列|請問)", text)[0]
    text = re.sub(r"[\(（\s]+$", "", text).strip()
    return clean_math_text(text)


def clean_stem_text(stem: str) -> str:
    """清理題幹中的頁面資訊、版面標籤與題組開頭雜訊"""
    text = stem
    text = re.sub(r"^[（\(]\s*\d+\s*[）\)]\s*", "", text)
    text = re.split(r"第\s*\d+\s*頁.*共\s*\d+\s*頁", text)[0]
    text = re.split(r"新北市立.*?(?:試題卷|答案卷|定期評量)", text)[0]
    text = re.split(r"【.*?(?:頁|試題).*?】", text)[0]
    text = re.split(r"■\s*題組[:：]?", text)[0]
    text = re.split(r"背面尚有.*", text)[0]
    text = re.split(r"試題結束.*", text)[0]
    return clean_math_text(text).strip()


def parse_full_answers(txt_a: str) -> dict:
    """多格式容錯解答解析器"""
    ans_map = {}
    lines = [l.strip() for l in txt_a.split("\n") if l.strip()]
    i = 0
    while i < len(lines):
        line = lines[i]

        # 格式 1: 1-5 BDBBC 或 1~5 ABCBA
        found_range = False
        for m in re.finditer(r"(\d+)\s*[-~～]\s*(\d+)\s+([A-D\s,]+)", line):
            start = int(m.group(1))
            letters = [ch for ch in m.group(3) if ch in "ABCD"]
            for idx, ch in enumerate(letters):
                ans_map[start + idx] = {"A": 0, "B": 1, "C": 2, "D": 3}[ch]
            found_range = True
        if found_range:
            i += 1
            continue

        # 格式 2: 表格兩行式（上一行數字，下一行字母）
        t1 = [re.sub(r"[\.、]", "", t) for t in line.split()]
        if len(t1) >= 3 and all(t.isascii() and t.isdigit() and 1 <= int(t) <= 60 for t in t1):
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                t2 = [t for t in next_line.split() if t in ["A", "B", "C", "D", "X"]]
                if len(t2) == len(t1):
                    for n_str, a_str in zip(t1, t2):
                        if a_str in ["A", "B", "C", "D"]:
                            ans_map[int(n_str)] = {"A": 0, "B": 1, "C": 2, "D": 3}[a_str]
                    i += 2
                    continue

        # 格式 3: 單題式 1. B 或 1 B
        for m in re.finditer(r"(?:^|\s)(\d{1,2})\s*[\.、]?\s*([A-D])(?:\s|$)", line):
            num = int(m.group(1))
            if num not in ans_map and 1 <= num <= 60:
                ans_map[num] = {"A": 0, "B": 1, "C": 2, "D": 3}[m.group(2)]
        i += 1

    return ans_map


def infer_concept(subject: str, grade: str, stem: str, options: list) -> str:
    """依題幹與選項自動推斷核心觀念標籤"""
    combined = stem + " " + " ".join(options)

    if subject == "chinese":
        if any(k in combined for k in ["讀音", "字音", "何者讀音", "音同"]):
            return "國文：字音辨析與破音字"
        if any(k in combined for k in ["字形", "錯字", "何字", "字義"]):
            return "國文：字形辨正與形似字"
        if any(k in combined for k in ["成語", "用字完全正確", "題辭"]):
            return "國文：成語運用與語境判斷"
        if any(k in combined for k in ["詞性", "動詞", "名詞", "形容詞", "副詞"]):
            return "國文：詞性辨析與句型結構"
        if any(k in combined for k in ["修辭", "摹寫", "譬喻", "誇飾", "轉化", "映襯"]):
            return "國文：修辭技巧與感官摹寫"
        if any(k in combined for k in ["主旨", "寓意", "這段話", "作者想要", "啟示"]):
            return "國文：白話文意理解與主旨分析"
        if any(k in combined for k in ["孔子", "論語", "史記", "孟子", "世說新語", "文言"]):
            return "國文：文言文閱讀與經典文學常識"
        return "國文：語文素養與生活閱讀理解"

    elif subject == "math":
        if any(k in combined for k in ["因數", "倍數", "質數", "合數"]):
            return "數學：因數、倍數與質數"
        if any(k in combined for k in ["最大公因數", "最小公倍數", "互質", "公倍數"]):
            return "數學：公因數、公倍數與生活應用"
        if any(k in combined for k in ["指數", "次方", "科學記號", "10的", "10^"]):
            return "數學：指數律與科學記號"
        if any(k in combined for k in ["分數", "倒數", "通分", "約分"]):
            return "數學：分數的四則運算"
        if any(k in combined for k in ["一元一次", "方程式", "未知數", "解方程式", "打折", "成本", "售價"]):
            return "數學：一元一次方程式應用"
        if any(k in combined for k in ["二元一次", "聯立"]):
            return "數學：二元一次聯立方程式"
        if any(k in combined for k in ["平方根", "根號", "最簡根式"]):
            return "數學：平方根與根式運算"
        if any(k in combined for k in ["乘法公式", "多項式", "因式分解"]):
            return "數學：多項式與乘法公式"
        if any(k in combined for k in ["畢氏定理", "直角三角形", "勾股"]):
            return "數學：畢氏定理與幾何計算"
        if any(k in combined for k in ["等差數列", "級數", "公差"]):
            return "數學：等差數列與級數"
        if any(k in combined for k in ["機率", "擲骰子", "抽牌"]):
            return "數學：機率與統計"
        return "數學：核心概念理解與運算"

    elif subject == "english":
        if any(k in combined for k in ["since", "for ", "have ", "has ", "haven't", "hasn't"]):
            return "英文：現在完成式與時態"
        if any(k in combined for k in ["who", "which", "that", "whose", "whom"]):
            return "英文：關係代名詞與子句"
        if any(k in combined for k in ["now", "at that time", "was ", "were ", "listening", "playing", "doing"]):
            return "英文：進行式與過去時態"
        if any(k in combined for k in ["Don't", "Let's", "Please", "wake up", "hurry"]):
            return "英文：祈使句與日常指令"
        if any(k in combined for k in ["can", "can't", "could", "should", "must"]):
            return "英文：情態助動詞用法"
        if any(k in combined for k in ["on Monday", "at 8:00", "in the morning", "at night"]):
            return "英文：時間與地方介系詞"
        if any(k in combined for k in ["What time", "What day", "Where", "When", "Why", "Who"]):
            return "英文：特殊疑問句型與日常問答"
        return "英文：生活素養文法與單字運用"

    elif subject == "science":
        if any(k in combined for k in ["細胞", "光合作用", "呼吸作用", "顯微鏡", "葉綠"]):
            return "生物：細胞構造與能量代謝"
        if any(k in combined for k in ["消化", "循環", "酵素", "血液", "神經", "內分泌"]):
            return "生物：人體生理與器官協調"
        if any(k in combined for k in ["基因", "遺傳", "DNA", "染色體", "天擇", "演化"]):
            return "生物：遺傳法則與生物演化"
        if any(k in combined for k in ["密度", "浮力", "壓力", "帕斯卡"]):
            return "理化：密度、浮力與壓力"
        if any(k in combined for k in ["莫耳", "濃度", "化學式", "原子量", "分子量"]):
            return "理化：莫耳濃度與化學計量"
        if any(k in combined for k in ["酸鹼", "pH", "電解質", "鹽類", "氧化", "還原"]):
            return "理化：酸鹼中和與氧化還原"
        if any(k in combined for k in ["牛頓", "速度", "加速度", "力學", "功與能"]):
            return "理化：運動學與牛頓運動定律"
        if any(k in combined for k in ["板塊", "地震", "岩石", "大氣", "天氣", "洋流", "潮汐"]):
            return "地科：地球構造與天氣大氣現象"
        return "自然科學：核心科學觀念理解"

    elif subject == "social":
        if any(k in combined for k in ["荷蘭", "西班牙", "鄭氏", "清朝", "日本", "民國", "開港", "劉銘傳"]):
            return "社會：臺灣歷史變遷與發展"
        if any(k in combined for k in ["商朝", "周朝", "秦漢", "唐宋", "明清", "辛亥"]):
            return "社會：中國歷史重要朝代演進"
        if any(k in combined for k in ["希臘", "羅馬", "文藝復興", "工業革命", "世界大戰"]):
            return "社會：世界文明與世界歷史"
        if any(k in combined for k in ["地形", "氣候", "季風", "等高線", "經緯度", "河川"]):
            return "社會：地理環境與氣候地貌判讀"
        if any(k in combined for k in ["民法", "刑法", "憲法", "人權", "行政", "政府", "權力分立", "供給", "需求"]):
            return "社會：公民權利、法治與經濟生活"
        return "社會：社會領域核心素養"

    return "核心素養綜合評量"


def extract_questions_from_text(txt_q: str, ans_map: dict, meta: dict) -> list:
    """從題幹文字中分割題目區塊，進行四選項提取與品質過濾"""
    blocks = re.split(r"(?m)(?=^\s*(?:[（\(]\s*[）\)]\s*|[）\)]\s*)?\d{1,2}\s*[．\.\、])", txt_q)
    extracted = []

    for b in blocks:
        b = b.strip()
        m_num = re.match(
            r"^(?:[（\(]\s*[）\)]\s*|[）\)]\s*)?(\d{1,2})\s*[．\.\、]\s*(?:[（\(]\s*[）\)]\s*)?(.*?)(?=(?:[（\(][A-DＡ-Ｄ][）\)]|[A-DＡ-Ｄ][．\.\、]))",
            b,
            re.DOTALL
        )
        if not m_num:
            continue

        num = int(m_num.group(1))
        if num not in ans_map:
            continue

        stem = re.sub(r"\s+", " ", m_num.group(2)).strip()
        stem = re.sub(r"^[（\(]\s*[）\)]\s*", "", stem).strip()

        # 1. 英文科聽力題與閱讀題組過濾
        if meta["subject"] == "english":
            if num <= 10 and any(w in stem.lower() for w in ["listen", "picture", "conversation", "part"]):
                continue
            if any(term in stem.lower() for term in ["the reading", "this reading", "the passage", "the story"]):
                if len(stem) < 160:
                    continue
            if num >= 35:
                continue

        # 2. 嚴格過濾承上題、前題短文依賴之試題
        if re.search(r"承[上前]題|呈[上前]題|如前題|如上一題|閱讀上述短文.*回答第", stem):
            continue

        # 3. 嚴格過濾包含圖片、圖表、地圖依賴之題目
        img_pattern = re.compile(
            r"(如[附右左下]?圖|見[附右左下]?圖|看[附右左下]?圖|附圖[為中]|圖中[的為]|地圖[中上代號]|圖\s*[(（]?\s*[一二三四五六七八九十0-9]+|依據[附右左下]?圖|根據[附右左下]?圖|下圖\s*[(（]?\s*[一二三四五六七八九十0-9]+|圖[一二三四五六七八九十0-9]+[為是位於]|\([圖地]|\(如圖|下表|附表|如下表|流程圖|曲線圖|折線圖|長條圖)"
        )
        if img_pattern.search(stem):
            continue

        stem = clean_stem_text(stem)
        if len(stem) < 10:
            continue

        # 4. 提取四個選項
        remainder = b[m_num.end():]
        opt_matches = list(re.finditer(r"(?:[（\(]([A-DＡ-Ｄ])[）\)]|([A-DＡ-Ｄ])[．\.\、])\s*(.*?)(?=(?:[（\(][A-DＡ-Ｄ][）\)]|[A-DＡ-Ｄ][．\.\、]|\Z))", remainder, re.DOTALL))
        if len(opt_matches) < 4:
            continue

        opts = []
        letter_map = {"Ａ": "A", "Ｂ": "B", "Ｃ": "C", "Ｄ": "D"}
        for m in opt_matches[:4]:
            ltr = m.group(1) or m.group(2)
            ltr = letter_map.get(ltr, ltr)
            ot = clean_option_text(m.group(3))
            # 選項若含有看圖標記亦排除
            if any(k in ot for k in ["如圖", "如下圖", "圖中", "如附圖"]):
                opts = []
                break
            opts.append(f"{ltr}. {ot}")

        if len(opts) < 4 or not all(len(o[3:].strip()) > 0 for o in opts):
            continue

        clean_raw_opts = [o[3:].strip() for o in opts]
        # 選項為純代號或重複率過高者排除
        if set(clean_raw_opts).issubset({"甲", "乙", "丙", "丁", "A", "B", "C", "D", "a", "b", "c", "d"}):
            continue
        if len(set(clean_raw_opts)) < 3:
            continue

        # 4. 判斷概念標籤與題幹清洗
        stem = clean_math_text(stem)
        concept = infer_concept(meta["subject"], meta["grade"], stem, opts)
        ans_idx = ans_map[num]

        correct_opt = opts[ans_idx] if 0 <= ans_idx < len(opts) else ""
        explanation = f"正確答案為【{chr(65 + ans_idx)}】。本題測驗核心為「{concept}」，解題關鍵在於依循題幹定義與觀念邏輯推導。"

        q_obj = {
            "id": f"{meta['school_id']}-{meta['semester']}{meta['stage']}-{meta['grade']}-{meta['sub_abbr']}-{num}",
            "school": meta["school"],
            "exam": f"114學年度第{meta['semester']}學期第{meta['stage']}次段考",
            "semester": str(meta["semester"]),
            "stage": str(meta["stage"]),
            "stage_name": f"第{meta['semester']}學期・第{meta['stage']}次段考",
            "subject": meta["subject"],
            "grade": str(meta["grade"]),
            "concept": concept,
            "stem": stem,
            "options": opts,
            "answer": ans_idx,
            "hint": f"請回想「{concept}」之基礎定義與核心解題步驟。",
            "explanation": explanation
        }
        extracted.append(q_obj)

    return extracted


def detect_subject_from_filename(filename: str):
    """從檔案名稱識別科目代碼"""
    fn = filename.lower()
    if any(k in fn for k in ["國文", "國", "chi"]):
        return "chinese", "chi"
    if any(k in fn for k in ["英文", "英", "英語", "eng"]):
        return "english", "eng"
    if any(k in fn for k in ["數學", "數", "mat"]):
        return "math", "mat"
    if any(k in fn for k in ["生物", "生", "理化", "理", "自然", "sci", "bio"]):
        return "science", "sci"
    if any(k in fn for k in ["社會", "歷史", "歷", "地理", "地", "公民", "公", "soc"]):
        return "social", "soc"
    return None, None


def detect_stage_info(path_str: str):
    """從目錄路徑識別學期與段考次數"""
    m = re.search(r"114[-_](\d)[-_](\d)", path_str)
    if m:
        return int(m.group(1)), int(m.group(2))
    return 1, 2


def detect_grade_info(path_str: str):
    """從目錄路徑識別年級"""
    if "七年級" in path_str or "7年級" in path_str:
        return "7"
    if "八年級" in path_str or "8年級" in path_str:
        return "8"
    if "九年級" in path_str or "9年級" in path_str:
        return "9"
    return "8"


def process_haishan_exams():
    """解析海山國中各段考試卷"""
    results = []
    hs_dir = EXAM_BASE / "海山國中" / "114"
    if not hs_dir.exists():
        return results

    for grade_dir in hs_dir.glob("*年級"):
        grade = detect_grade_info(str(grade_dir))
        for exam_dir in grade_dir.glob("114-*"):
            sem, stg = detect_stage_info(str(exam_dir))
            pdfs = list(exam_dir.glob("*.pdf"))

            # 分離題目卷與答案卷
            q_files = [p for p in pdfs if "試題卷" in p.name or "試題" in p.name]
            a_files = [p for p in pdfs if "解答" in p.name or "答案卷" in p.name and "a4" not in p.name.lower()]

            for q_pdf in q_files:
                sub, sub_abbr = detect_subject_from_filename(q_pdf.name)
                if not sub:
                    continue

                # 尋找對應答案卷
                a_pdf = None
                for ap in a_files:
                    ap_sub, _ = detect_subject_from_filename(ap.name)
                    if ap_sub == sub:
                        a_pdf = ap
                        break

                if not a_pdf:
                    continue

                txt_a = subprocess.run(["pdftotext", "-layout", str(a_pdf), "-"], capture_output=True, text=True).stdout
                ans_map = parse_full_answers(txt_a)
                if not ans_map:
                    continue

                txt_q = subprocess.run(["pdftotext", str(q_pdf), "-"], capture_output=True, text=True).stdout
                meta = {
                    "school": "海山國中",
                    "school_id": "hs",
                    "semester": sem,
                    "stage": stg,
                    "grade": grade,
                    "subject": sub,
                    "sub_abbr": sub_abbr
                }
                qs = extract_questions_from_text(txt_q, ans_map, meta)
                results.extend(qs)

    return results


def process_fuhe_exams():
    """解析福和國中各段考試卷"""
    results = []
    fh_dir = EXAM_BASE / "福和國中" / "114"
    if not fh_dir.exists():
        return results

    for grade_dir in fh_dir.glob("*年級"):
        grade = detect_grade_info(str(grade_dir))
        for exam_dir in grade_dir.glob("114-*"):
            sem, stg = detect_stage_info(str(exam_dir))
            all_pdfs = list(exam_dir.rglob("*.pdf"))

            q_files = [p for p in all_pdfs if not any(k in p.name.lower() for k in ["a.pdf", "解答", "答案", "空白", "聽力稿", "錄音"])]
            a_files = [p for p in all_pdfs if any(k in p.name.lower() for k in ["a.pdf", "解答", "答案"]) and "空白" not in p.name]

            for q_pdf in q_files:
                sub, sub_abbr = detect_subject_from_filename(q_pdf.name)
                if not sub:
                    continue

                a_pdf = None
                for ap in a_files:
                    ap_sub, _ = detect_subject_from_filename(ap.name)
                    if ap_sub == sub:
                        a_pdf = ap
                        break

                if not a_pdf:
                    continue

                txt_a = subprocess.run(["pdftotext", "-layout", str(a_pdf), "-"], capture_output=True, text=True).stdout
                ans_map = parse_full_answers(txt_a)
                if not ans_map:
                    continue

                txt_q = subprocess.run(["pdftotext", str(q_pdf), "-"], capture_output=True, text=True).stdout
                meta = {
                    "school": "福和國中",
                    "school_id": "fh",
                    "semester": sem,
                    "stage": stg,
                    "grade": grade,
                    "subject": sub,
                    "sub_abbr": sub_abbr
                }
                qs = extract_questions_from_text(txt_q, ans_map, meta)
                results.extend(qs)

    return results


def process_yonghe_exams():
    """解析永和國中各段考試卷（解答位於 PDF 最後一頁）"""
    results = []
    yh_dir = EXAM_BASE / "永和國中" / "114"
    if not yh_dir.exists():
        return results

    for grade_dir in yh_dir.glob("*年級"):
        grade = detect_grade_info(str(grade_dir))
        for exam_dir in grade_dir.glob("114-*"):
            sem, stg = detect_stage_info(str(exam_dir))
            for pdf_path in exam_dir.glob("*.pdf"):
                if "作文" in pdf_path.name or "空白" in pdf_path.name:
                    continue

                sub, sub_abbr = detect_subject_from_filename(pdf_path.name)
                if not sub:
                    continue

                raw_txt = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], capture_output=True, text=True).stdout
                pages = raw_txt.split("\x0c")
                if len(pages) < 2:
                    continue

                # 永和國中解答通常位於最後 1~2 頁
                ans_page = pages[-2] if len(pages) > 1 else pages[-1]
                ans_map = parse_full_answers(ans_page)
                if not ans_map and len(pages) >= 3:
                    ans_map = parse_full_answers(pages[-3])

                if not ans_map:
                    continue

                # 題目內文排除最後一頁解答
                q_text = "\x0c".join(pages[:-2])
                meta = {
                    "school": "永和國中",
                    "school_id": "yh",
                    "semester": sem,
                    "stage": stg,
                    "grade": grade,
                    "subject": sub,
                    "sub_abbr": sub_abbr
                }
                qs = extract_questions_from_text(q_text, ans_map, meta)
                results.extend(qs)

    return results


def main():
    parser = argparse.ArgumentParser(description="新北升學名校段考真題批次/增量萃取工具")
    parser.add_argument("--school", "-s", choices=["all", "haishan", "fuhe", "yonghe"], default="all", help="指定萃取的學校：haishan (海山), fuhe (福和), yonghe (永和), all (全選，預設)")
    parser.add_argument("--clean", action="store_true", help="強制清空舊題庫重新建立（預設為 False，自動與舊題庫增量去重合併）")
    args = parser.parse_args()

    print("=" * 60)
    print(f"🚀 啟動新北升學名校真題萃取工具 (目標: {args.school} | 模式: {'全新重構' if args.clean else '增量追加'})")
    print("=" * 60)

    # 1. 讀取既有題庫並自動進行語意品質審查與清洗
    existing_questions = []
    if not args.clean and OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            try:
                raw_existing = json.load(f)
                img_pat = re.compile(
                    r"(如[附右左下]?圖|見[附右左下]?圖|看[附右左下]?圖|附圖[為中]|圖中[的為]|地圖[中上代號]|圖\s*[(（]?\s*[一二三四五六七八九十0-9]+|依據[附右左下]?圖|根據[附右左下]?圖|下圖\s*[(（]?\s*[一二三四五六七八九十0-9]+|圖[一二三四五六七八九十0-9]+[為是位於]|\([圖地]|\(如圖|下表|附表|如下表|流程圖|曲線圖|折線圖|長條圖)"
                )
                for q in raw_existing:
                    stem = clean_stem_text(q.get("stem", ""))
                    if len(stem) < 10 or re.search(r"承[上前]題|呈[上前]題|如前題|如上一題|閱讀上述短文.*回答第", stem):
                        continue
                    opts = [clean_option_text(o) for o in q.get("options", [])]
                    if len(opts) != 4 or not all(len(o[3:].strip()) > 0 for o in opts):
                        continue
                    clean_raw_opts = [o[3:].strip() for o in opts]
                    if set(clean_raw_opts).issubset({"甲", "乙", "丙", "丁", "A", "B", "C", "D", "a", "b", "c", "d"}) or len(set(clean_raw_opts)) < 3:
                        continue
                    if img_pat.search(stem):
                        continue
                    q_clean = dict(q)
                    q_clean["stem"] = stem
                    q_clean["options"] = opts
                    existing_questions.append(q_clean)
            except Exception:
                existing_questions = []
    print(f"📂 既有題庫題目數（經語意高標準清洗後）：{len(existing_questions)} 題")

    all_new = []
    if args.school in ["all", "haishan"]:
        print("\n🔍 正在解析 海山國中 全學年段考試卷...")
        hs_questions = process_haishan_exams()
        print(f"  ✅ 海山國中萃取完成：{len(hs_questions)} 題符合純文字標準試題")
        all_new.extend(hs_questions)

    if args.school in ["all", "fuhe"]:
        print("\n🔍 正在解析 福和國中 全學年段考試卷...")
        fh_questions = process_fuhe_exams()
        print(f"  ✅ 福和國中萃取完成：{len(fh_questions)} 題符合純文字標準試題")
        all_new.extend(fh_questions)

    if args.school in ["all", "yonghe"]:
        print("\n🔍 正在解析 永和國中 全學年段考試卷...")
        yh_questions = process_yonghe_exams()
        print(f"  ✅ 永和國中萃取完成：{len(yh_questions)} 題符合純文字標準試題")
        all_new.extend(yh_questions)

    # 3. 合併與去重（以 stem 題幹文字為唯一識別鍵）
    merged_map = {}
    for q in existing_questions:
        key = q.get("stem", "").strip()
        if key:
            merged_map[key] = q

    new_added = 0
    for q in all_new:
        key = q.get("stem", "").strip()
        if key and key not in merged_map:
            merged_map[key] = q
            new_added += 1

    final_questions = list(merged_map.values())

    print("\n" + "=" * 60)
    print(f"🎉 批次萃取合併完成！新增入庫：{new_added} 題，總題庫量：{len(final_questions)} 題")
    print("=" * 60)

    # 統計報表
    by_stage = {}
    by_subject = {}
    by_grade = {}
    for q in final_questions:
        stg_key = q.get("stage_name", f"第{q.get('semester','1')}學期・第{q.get('stage','2')}次段考")
        by_stage[stg_key] = by_stage.get(stg_key, 0) + 1
        sub_key = q.get("subject", "math")
        by_subject[sub_key] = by_subject.get(sub_key, 0) + 1
        grd_key = f"{q.get('grade', '8')}年級"
        by_grade[grd_key] = by_grade.get(grd_key, 0) + 1

    print("\n📊 【段考次數分布統計】")
    for k, v in sorted(by_stage.items()):
        print(f"  • {k}: {v} 題")

    print("\n📊 【學科領域分布統計】")
    sub_names = {"chinese": "國文", "english": "英文", "math": "數學", "science": "自然", "social": "社會"}
    for k, v in sorted(by_subject.items()):
        print(f"  • {sub_names.get(k, k)} ({k}): {v} 題")

    print("\n📊 【年級分布統計】")
    for k, v in sorted(by_grade.items()):
        print(f"  • {k}: {v} 題")

    # 4. 寫入 data/real_exam_questions.json
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_questions, f, ensure_ascii=False, indent=2)

    # 5. 寫入 js/real_exam_questions.js
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("// 新北升學名校（永和國中、福和國中、海山國中）段考全真題庫\n")
        f.write(f"// 自動彙整全學期三大段考真題，總收錄 {len(final_questions)} 題名校真題\n\n")
        f.write("const REAL_EXAM_QUESTIONS = ")
        json.dump(final_questions, f, ensure_ascii=False, indent=2)
        f.write(";\n\n")
        f.write("if (typeof window !== 'undefined') {\n  window.REAL_EXAM_QUESTIONS = REAL_EXAM_QUESTIONS;\n}\n")
        f.write("if (typeof module !== 'undefined' && module.exports) {\n  module.exports = { REAL_EXAM_QUESTIONS };\n}\n")

    print(f"\n💾 成功更新真題題庫檔案：")
    print(f"   - {OUTPUT_FILE}")
    print(f"   - {OUTPUT_JS}")


if __name__ == "__main__":
    main()
