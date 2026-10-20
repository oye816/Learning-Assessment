#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新北市立海山高中（國中部）114-1-2 段考試卷 PDF 自動解析與題庫萃取工具
最小模組化萃取器：解析七年級、八年級、九年級各科真題，並合併至現有題庫。
輸出檔案：data/real_exam_questions.json, js/real_exam_questions.js
"""

import os
import re
import json
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
EXAM_BASE = BASE_DIR / "題庫" / "海山國中" / "114"
OUTPUT_FILE = BASE_DIR / "data" / "real_exam_questions.json"
OUTPUT_JS = BASE_DIR / "js" / "real_exam_questions.js"


def parse_full_answers(txt_a: str) -> dict:
    """高容錯解析試卷解答卷文字"""
    ans_map = {}
    lines = [l.strip() for l in txt_a.split("\n") if l.strip()]
    i = 0
    while i < len(lines):
        line = lines[i]
        # 情況 1: 一行中含一個或多個 1-5 BDBBC 或 1~5 ABCBA 或 1～5 BACBB
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

        # 情況 2: 一行數字，下一行字母（支持 1. 帶小數點，支持 X 送分）
        t1 = [re.sub(r"[\.、]", "", t) for t in line.split()]
        if len(t1) >= 3 and all(t.isdigit() for t in t1):
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                t2 = [t for t in next_line.split() if t in ["A", "B", "C", "D", "X"]]
                if len(t2) == len(t1):
                    for n_str, a_str in zip(t1, t2):
                        if a_str in ["A", "B", "C", "D"]:
                            ans_map[int(n_str)] = {"A": 0, "B": 1, "C": 2, "D": 3}[a_str]
                    i += 2
                    continue

        # 情況 3: 1 B 2 C 單題格式
        for m in re.finditer(r"(?:^|\s)(\d{1,2})\s*[\.、]?\s*([A-D])(?:\s|$)", line):
            num = int(m.group(1))
            if num not in ans_map and 1 <= num <= 60:
                ans_map[num] = {"A": 0, "B": 1, "C": 2, "D": 3}[m.group(2)]
        i += 1

    return ans_map


def infer_concept(subject: str, grade: int, stem: str, options: list) -> str:
    """自動為題目推斷精確之核心概念標籤"""
    combined = stem + " " + " ".join(options)
    
    if subject == "國文":
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

    elif subject == "數學":
        if any(k in combined for k in ["因數", "倍數", "質數", "合數"]):
            return "數學：因數、倍數與質數"
        if any(k in combined for k in ["最大公因數", "最小公倍數", "互質", "公倍數"]):
            return "數學：公因數、公倍數與生活應用"
        if any(k in combined for k in ["指數", "次方", "科學記號", "10的"]):
            return "數學：指數律與科學記號"
        if any(k in combined for k in ["分數", "倒數", "通分", "約分"]):
            return "數學：分數的四則運算"
        if any(k in combined for k in ["一元一次", "方程式", "未知數", "解方程式"]):
            return "數學：一元一次方程式應用"
        if any(k in combined for k in ["平方根", "根號", "最簡根式"]):
            return "數學：平方根與根式運算"
        if any(k in combined for k in ["乘法公式", "多項式", "因式分解"]):
            return "數學：多項式與乘法公式"
        return "數學：核心概念理解與運算"

    elif subject == "英語":
        if any(k in combined for k in ["now", "at that time", "was ", "were ", "listening", "playing", "doing"]):
            return "英文：現在進行式與過去進行式"
        if any(k in combined for k in ["Don't", "Let's", "Please", "wake up", "hurry"]):
            return "英文：祈使句與日常指令"
        if any(k in combined for k in ["can", "can't", "could", "should", "must"]):
            return "英文：情態助動詞用法"
        if any(k in combined for k in ["on Monday", "at 8:00", "in the morning", "at night"]):
            return "英文：時間與地方介系詞"
        if any(k in combined for k in ["What time", "What day", "Where", "When", "Why", "Who"]):
            return "英文：特殊疑問句型與日常問答"
        if any(k in combined for k in ["him", "her", "them", "his", "their", "mine"]):
            return "英文：代名詞主格、受格與所有格"
        return "英文：生活素養文法與單字運用"

    elif subject == "社會":
        if any(k in combined for k in ["荷蘭", "西班牙", "西拉雅", "鄭氏", "清帝國", "開港", "劉銘傳", "沈葆楨", "民變"]):
            return "社會：臺灣歷史重要轉折與治理發展"
        if any(k in combined for k in ["地形", "氣候", "季風", "河川", "等高線", "降雨", "水資源"]):
            return "社會：臺灣地理環境與自然生態"
        if any(k in combined for k in ["家庭", "親屬", "部落", "公民", "權益", "平等", "憲法", "人權"]):
            return "社會：現代公民素養與社會生活"
        if any(k in combined for k in ["文藝復興", "宗教改革", "莎士比亞", "達文西", "大航海", "十字軍"]):
            return "社會：世界文明起源與歷史發展"
        return "社會：社會領域核心素養"

    return f"{subject}：核心素養綜合應用"


def extract_questions_from_pdf(pdf_q: Path, pdf_a: Path, subject: str, grade: int) -> list:
    """精準提取試卷題目與選項"""
    if not pdf_q.exists() or not pdf_a.exists():
        return []

    txt_a = subprocess.run(["pdftotext", "-layout", str(pdf_a), "-"], capture_output=True, text=True).stdout
    ans_map = parse_full_answers(txt_a)

    txt_q = subprocess.run(["pdftotext", str(pdf_q), "-"], capture_output=True, text=True).stdout
    blocks = re.split(r"(?m)(?=^\s*(?:[（\(]\s*[）\)]\s*|[）\)]\s*)?\d{1,2}\s*[．\.\、])", txt_q)

    extracted = []
    sub_code_map = {
        "國文": "chinese",
        "數學": "math",
        "英語": "english",
        "社會": "social"
    }

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

        # 英語科聽力題（通常為前 10 題或前 15 題）排除
        if subject == "英語" and num <= 10:
            continue

        # 排除包含圖片、圖表依賴之題目
        if any(term in stem for term in ["如圖", "附圖", "右圖", "下圖", "附表", "如下表", "圖(一)", "圖(二)", "圖一", "圖二", "如下圖所示"]):
            continue

        if len(stem) < 5:
            continue

        remainder = b[m_num.end():]
        opt_matches = list(re.finditer(
            r"(?:[（\(]([A-DＡ-Ｄ])[）\)]|([A-DＡ-Ｄ])[．\.\、])\s*(.*?)(?=(?:[（\(][A-DＡ-Ｄ][）\)]|[A-DＡ-Ｄ][．\.\、]|\Z))",
            remainder,
            re.DOTALL
        ))

        if len(opt_matches) >= 4:
            raw_options = []
            for om in opt_matches[:4]:
                opt_text = re.sub(r"\s+", " ", om.group(3)).strip()
                # 去除頁首頁尾與接續題號
                opt_text = re.split(r"(?:第\s*\d+\s*頁|新北市立|試題結束|\d{1,2}[．\.\、])", opt_text)[0].strip()
                raw_options.append(opt_text)

            # 選項品質檢查
            if len(raw_options) == 4 and all(len(o) > 0 for o in raw_options) and len(set(raw_options)) == 4:
                prefix = ["A. ", "B. ", "C. ", "D. "]
                options = [f"{p}{o}" for p, o in zip(prefix, raw_options)]
                concept = infer_concept(subject, grade, stem, raw_options)
                
                sub_code = sub_code_map.get(subject, "general")
                q_id = f"hs-11412-g{grade}-{sub_code}-{num}"

                item = {
                    "id": q_id,
                    "school": "海山國中",
                    "exam": "114學年度第1學期第2次段考",
                    "semester": "1",
                    "stage": "2",
                    "stage_name": "第1學期・第2次段考",
                    "subject": sub_code,
                    "grade": str(grade),
                    "concept": concept,
                    "stem": stem,
                    "options": options,
                    "answer": ans_map[num],
                    "explanation": f"新北市立海山高中（國中部）定期評量{grade}年級{subject}科第 {num} 題真題。"
                }
                extracted.append(item)

    return extracted


def main():
    print("🚀 開始萃取新北海山國中 114-1-2 真題考卷...")

    configs = [
        # (年級, 資料夾名稱, 科目清單: [(科目名, 試題檔, 解答檔)])
        (
            7,
            "七年級/114-1-2七年級(不含生物)",
            [
                ("國文", "7國文段考試題卷.pdf", "7國文段考解答.pdf"),
                ("數學", "7數學段考試題卷.pdf", "7數學段考解答.pdf"),
                ("社會", "7社會段考試題卷.pdf", "7社會段考解答.pdf"),
                ("英語", "7英語段考試題卷.pdf", "7英語段考解答.pdf")
            ]
        ),
        (
            8,
            "八年級/114-1-2八年級(不含理化)",
            [
                ("國文", "8國文段考試題卷.pdf", "8國文段考解答.pdf"),
                ("數學", "8數學段考試題卷.pdf", "8數學段考解答.pdf"),
                ("社會", "8社會段考試題卷.pdf", "8社會段考解答.pdf"),
                ("英語", "8英語段考試題卷.pdf", "8英語段考解答.pdf")
            ]
        ),
        (
            9,
            "九年級/114-1-2九年級(不含自然)",
            [
                ("國文", "9國文段考試題卷.pdf", "9國文段考解答.pdf"),
                ("數學", "9數學段考試題卷.pdf", "9數學段考解答.pdf"),
                ("社會", "9社會段考試題卷.pdf", "9社會段考解答.pdf"),
                ("英語", "9英語段考試題卷.pdf", "9英語段考解答.pdf")
            ]
        )
    ]

    new_questions = []
    for grade, sub_dir, exam_files in configs:
        folder = EXAM_BASE / sub_dir
        for sub, q_file, a_file in exam_files:
            pq = folder / q_file
            pa = folder / a_file
            qs = extract_questions_from_pdf(pq, pa, sub, grade)
            print(f"  📌 海山國中 {grade} 年級 {sub} 科：成功提取 {len(qs)} 道高質量選擇題")
            new_questions.extend(qs)

    print(f"\n📊 海山國中 114-1-2 新增題庫萃取完成，共計 {len(new_questions)} 題。")

    # 讀取現有真題
    existing_questions = []
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            try:
                existing_questions = json.load(f)
            except Exception:
                existing_questions = []

    print(f"📂 既有真題數：{len(existing_questions)} 題")

    # 合併去重（以 id 或 stem 為唯一值）
    merged_map = {}
    for q in existing_questions:
        key = q.get("stem", "").strip()
        if key:
            merged_map[key] = q

    added_count = 0
    for q in new_questions:
        key = q.get("stem", "").strip()
        if key and key not in merged_map:
            merged_map[key] = q
            added_count += 1

    final_questions = list(merged_map.values())
    print(f"✨ 成功新增 {added_count} 題，總真題量擴充至：{len(final_questions)} 題！")

    # 寫入 JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_questions, f, ensure_ascii=False, indent=2)

    # 寫入 JS
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("// 新北名校（永和國中、福和國中、海山國中）114-1-2 段考真題題庫\n")
        f.write(f"// 自動彙整更新，總收錄 {len(final_questions)} 題名校段考真題\n\n")
        f.write("const REAL_EXAM_QUESTIONS = ")
        json.dump(final_questions, f, ensure_ascii=False, indent=2)
        f.write(";\n\n")
        f.write("if (typeof window !== 'undefined') {\n  window.REAL_EXAM_QUESTIONS = REAL_EXAM_QUESTIONS;\n}\n")
        f.write("if (typeof module !== 'undefined' && module.exports) {\n  module.exports = { REAL_EXAM_QUESTIONS };\n}\n")

    print(f"💾 已成功更新真題資料庫：\n   - {OUTPUT_FILE}\n   - {OUTPUT_JS}")


if __name__ == "__main__":
    main()
