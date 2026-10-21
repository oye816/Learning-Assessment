#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
星耀國中學習評量系統｜題庫真題提純與純文字自給自足清洗腳本
功能：
1. 清除選項末端附帶之 PDF/OCR 排版雜訊（如「題組」、「請根據以下...回答第...題」等）。
2. 剔除不具自給自足性之題目（缺乏短文、無 SVG 卻要求看圖、聽力測驗、承上題）。
3. 同步輸出乾淨之 data/real_exam_questions.json 與 js/real_exam_questions.js。
"""

import json
import re
import os

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JSON_PATH = os.path.join(WORKSPACE_DIR, "data", "real_exam_questions.json")
DATA_JS_PATH = os.path.join(WORKSPACE_DIR, "js", "real_exam_questions.js")

NOISE_PATTERN = re.compile(
    r"[\s\n\r]*("
    r"[※◎●★◆▲⚫]?\s*(?:請|試|請依據|依據|根據|閱讀|請閱讀|試閱讀|請根據)\s*(?:下列|以下|下文|文本|文章|報導|專題|資料|表格|新聞).*(?:回答|選出).*"
    r"|[◎●★◆▲⚫※]?\s*題組.*"
    r"|[一二三四五六七八九十]+、\s*(?:閱讀)?題組.*"
    r"|請翻[面續].*"
    r"|請繼續作答.*"
    r"|背面尚有.*"
    r"|第\s*\d+[-~～]\d+\s*題.*"
    r"|(?:圖|表)\s*[(（]?\s*[一二三四五六七八九十0-9]+[)）]?\s*$"
    r")",
    re.DOTALL
)

def clean_option_text(opt):
    """清除單一選項末端的題組與排版雜訊"""
    if not isinstance(opt, str):
        return opt
    m = NOISE_PATTERN.search(opt)
    if m:
        cleaned = opt[:m.start()].strip()
        cleaned = re.sub(r"[\s※◎●★◆▲⚫]+$", "", cleaned).strip()
        return cleaned
    return opt.strip()

def is_self_contained(q):
    """檢驗題目是否為獨立純文字或具備內嵌 SVG 的自給自足題目"""
    stem = q.get("stem", "")
    opts = q.get("options", [])
    text = (stem + " " + " ".join(opts)).lower()
    
    # 排除「看圖說故事」成語干擾
    text_no_idiom = text.replace("看圖說故事", "")
    stem_no_idiom = stem.replace("看圖說故事", "")
    
    has_svg = bool(q.get("diagramSvg") and "<svg" in q.get("diagramSvg", ""))
    
    # 1. 圖片過濾 (無 SVG 卻要求看圖/附圖/地圖)
    if not has_svg:
        img_pattern = re.compile(
            r"如[附右左下]?圖|見[附右左下]?圖|看[附右左下]?圖|附圖[為中]|圖中[的為]|地圖[中上代號]|"
            r"圖\s*[(（]?\s*[一二三四五六七八九十0-9]+|依據[附右左下]?圖|根據[附右左下]?圖|"
            r"代號[甲乙丙丁戊己庚辛abcd]{1,4}代表|代號[甲乙丙丁戊己庚辛abcd]{1,4}為|代號[甲乙丙丁戊己庚辛]|★標示之處",
            re.I
        )
        if img_pattern.search(text_no_idiom) and not re.search(r"甲[:：]|乙[:：]", stem_no_idiom):
            return False, "img"
            
    # 2. 承上題 / 無文章依賴
    if re.search(r"承上題|題組", stem_no_idiom, re.I):
        return False, "prev_q"
        
    passage_pattern = re.compile(
        r"(該報導|上述報導|依據上文|根據上文|由上文|閱讀上述|資料[一二三四五]|閱讀下列文章|由上述資料|根據短文|由這篇報導|依據這篇報導|根據上述資料|文章中)",
        re.I
    )
    if passage_pattern.search(stem_no_idiom) and len(stem_no_idiom.strip()) < 80:
        return False, "passage_short"
        
    # 3. 聽力過濾
    audio_pattern = re.compile(r"聽力測驗|聽到的內容|選出聽到的|請聽錄音|聽完對話|listen to the|based on the recording", re.I)
    if audio_pattern.search(text_no_idiom):
        return False, "audio"
        
    # 4. 英文閱讀短文依賴過濾
    if q.get("subject") == "english":
        eng_passage = re.compile(r"according to the (reading|passage|article|dialogue|chart)", re.I)
        if eng_passage.search(text_no_idiom) and len(stem_no_idiom.strip()) < 120:
            return False, "eng_passage_short"

    # 5. 選項規格與題幹洩漏審查 (嚴禁題幹夾帶至選項、嚴禁標籤缺失倒錯)
    if not isinstance(opts, list) or len(opts) != 4:
        return False, "invalid_options_len"

    expected_labels = ["A", "B", "C", "D"]
    actual_labels = []
    for opt in opts:
        if not isinstance(opt, str):
            return False, "non_string_opt"
        m = re.match(r"^([A-D])[\.、\s]", opt.strip())
        actual_labels.append(m.group(1) if m else "?")
        # 嚴禁題幹洩漏：包含填空底線 ___、人名對話 (如 Anna: 或 Nick:)、長問句
        if "___" in opt or ("?" in opt and len(opt) > 30) or re.search(r"\b[A-Z][a-z]{1,8}:\s*", opt):
            return False, "stem_leak_in_options"

    if actual_labels != expected_labels:
        return False, "options_order_mismatch"
            
    return True, "ok"

def main():
    print("=" * 60)
    print("🧹 開始執行題庫真題提純與純文字自給自足清洗")
    print("=" * 60)
    
    with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
        raw_questions = json.load(f)
        
    total_raw = len(raw_questions)
    print(f"📖 原始題庫題數：{total_raw} 題")
    
    cleaned_options_count = 0
    purified_questions = []
    removed_records = []
    
    for q in raw_questions:
        # 清洗選項末端排版雜訊
        orig_opts = q.get("options", [])
        cleaned_opts = [clean_option_text(o) for o in orig_opts]
        
        if cleaned_opts != orig_opts:
            cleaned_options_count += 1
            
        q_clean = dict(q)
        q_clean["options"] = cleaned_opts
        
        valid, reason = is_self_contained(q_clean)
        if valid:
            purified_questions.append(q_clean)
        else:
            removed_records.append((q["id"], reason, q["stem"][:40]))
            
    purified_count = len(purified_questions)
    removed_count = len(removed_records)
    
    print(f"✨ 選項末尾排版雜訊清洗：共修復 {cleaned_options_count} 道題目")
    print(f"🗑️  剔除外部依賴/無附圖/無短文題目：共移除 {removed_count} 題")
    print(f"🎯 提純後純淨真題總數：{purified_count} 題")
    
    # 儲存至 data/real_exam_questions.json
    with open(DATA_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(purified_questions, f, ensure_ascii=False, indent=2)
    print(f"💾 已更新 JSON 題庫：{DATA_JSON_PATH}")
    
    # 儲存至 js/real_exam_questions.js
    with open(DATA_JS_PATH, "w", encoding="utf-8") as f:
        f.write("// 新北升學名校（永和國中、福和國中、海山國中）段考全真題庫\n")
        f.write(f"// 自動彙整全學期三大段考真題，總收錄 {purified_count} 題名校純淨自給自足真題\n\n")
        f.write("const REAL_EXAM_QUESTIONS = ")
        json.dump(purified_questions, f, ensure_ascii=False, indent=2)
        f.write(";\n\n")
        f.write("if (typeof window !== 'undefined') {\n")
        f.write("  window.REAL_EXAM_QUESTIONS = REAL_EXAM_QUESTIONS;\n")
        f.write("}\n")
        f.write("if (typeof module !== 'undefined' && module.exports) {\n")
        f.write("  module.exports = { REAL_EXAM_QUESTIONS };\n")
        f.write("}\n")
    print(f"💾 已更新 JS 題庫：{DATA_JS_PATH}")
    
    print("=" * 60)
    print("✅ 題庫提純作業圓滿完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()
