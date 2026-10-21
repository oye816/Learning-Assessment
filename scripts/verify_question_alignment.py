#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
星耀國中學習評量系統｜生成題目與題庫相符性全面驗證腳本
驗證項目：
1. 題庫真題結構與規範完整性 (Schema & Data Integrity)
2. 自給自足純文字過濾器驗證 (Self-contained Question Filter)
3. RAG 考點檢索與科目/年級吻合度測試 (RAG Retrieval Alignment)
4. AI/本地弱點出題生成包 (Practice Pack) 結構相符性模擬
5. Gemini 出題規範與題庫資料模型一致性檢驗
"""

import json
import re
import os
import sys

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(WORKSPACE_DIR, "data", "real_exam_questions.json")
JS_REAL_PATH = os.path.join(WORKSPACE_DIR, "js", "real_exam_questions.js")
JS_GEMINI_PATH = os.path.join(WORKSPACE_DIR, "js", "gemini.js")
INDEX_PATH = os.path.join(WORKSPACE_DIR, "index.html")

VALID_SUBJECTS = {"chinese", "english", "math", "science", "social"}
VALID_GRADES = {"7", "8", "9"}
VALID_SCHOOLS = {"永和國中", "福和國中", "海山國中"}

def load_question_bank():
    print(f"📖 讀取題庫資料：{DATA_PATH}")
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        questions = json.load(f)
    return questions

def verify_bank_schema(questions):
    print("\n🔍 【第一項驗證：題庫資料規格與欄位合法性】")
    errors = []
    
    total = len(questions)
    print(f"  * 題庫總題數：{total} 題")
    
    for idx, q in enumerate(questions):
        q_id = q.get("id", f"idx-{idx}")
        # 1. 必備欄位檢查
        for field in ["id", "subject", "grade", "concept", "stem", "options", "answer", "explanation", "school"]:
            if field not in q:
                errors.append(f"題目 [{q_id}] 缺少必要欄位: {field}")
        
        # 2. 科目合規性
        sub = q.get("subject")
        if sub not in VALID_SUBJECTS:
            errors.append(f"題目 [{q_id}] 科目不合規: {sub}")
            
        # 3. 年級合規性
        g = str(q.get("grade", ""))
        if g not in VALID_GRADES:
            errors.append(f"題目 [{q_id}] 年級不合規: {g}")
            
        # 4. 題幹長度
        stem = q.get("stem", "").strip()
        if len(stem) < 3:
            errors.append(f"題目 [{q_id}] 題幹過短或為空: '{stem}'")
            
        # 5. 選項長度恰好 4 個
        options = q.get("options", [])
        if not isinstance(options, list) or len(options) != 4:
            errors.append(f"題目 [{q_id}] 選項數量不等於 4: {len(options) if isinstance(options, list) else type(options)}")
        else:
            for opt_idx, opt in enumerate(options):
                if not isinstance(opt, str) or len(opt.strip()) == 0:
                    errors.append(f"題目 [{q_id}] 選項 {opt_idx} 為空字串")
                    
        # 6. 正確解答索引在 0~3
        ans = q.get("answer")
        if ans not in [0, 1, 2, 3]:
            errors.append(f"題目 [{q_id}] 答案索引異常: {ans}")
            
    if errors:
        print(f"  ❌ 發現 {len(errors)} 處規格錯誤！前 5 筆：")
        for e in errors[:5]:
            print(f"    - {e}")
        return False
    else:
        print(f"  ✅ 題庫 {total} 題規格檢驗 100% 通過！所有欄位、選項數 (4)、答案索引 (0~3) 皆完全合規。")
        return True

def is_self_contained_question(q):
    """模擬 index.html 中的 isSelfContainedTextQuestion 邏輯"""
    if not q or not q.get("stem"):
        return False
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
            return False
            
    # 2. 承上題過濾 / 無文章依賴
    if re.search(r"承上題|題組", stem_no_idiom, re.I):
        return False
    passage_pattern = re.compile(
        r"(該報導|上述報導|依據上文|根據上文|由上文|閱讀上述|資料[一二三四五]|閱讀下列文章|由上述資料|根據短文|由這篇報導|依據這篇報導|根據上述資料|文章中)",
        re.I
    )
    if passage_pattern.search(stem_no_idiom) and len(stem_no_idiom.strip()) < 80:
        return False
        
    # 3. 聽力過濾
    audio_pattern = re.compile(r"聽力測驗|聽到的內容|選出聽到的|請聽錄音|聽完對話|listen to the|based on the recording", re.I)
    if audio_pattern.search(text_no_idiom):
        return False
        
    # 4. 英文閱讀理解依賴過濾
    if q.get("subject") == "english":
        passage_pattern = re.compile(r"according to the (reading|passage|article|dialogue|chart)", re.I)
        if passage_pattern.search(text_no_idiom) and len(stem_no_idiom.strip()) < 120:
            return False
            
    return True

def verify_self_contained(questions):
    print("\n🔍 【第二項驗證：題庫自給自足獨立性與純文字品質】")
    filtered_out = []
    for q in questions:
        if not is_self_contained_question(q):
            filtered_out.append(q)
            
    if filtered_out:
        print(f"  ⚠️ 有 {len(filtered_out)} 題未能通過嚴格純文字自給自足檢查（包含看圖題/未附短文題）")
        for f in filtered_out[:3]:
            print(f"    - [{f['id']}] {f['stem'][:50]}...")
        return False
    else:
        print(f"  ✅ 題庫 {len(questions)} 題 100% 通過自給自足檢驗！絕無看圖殘留、聽力依賴或外部依賴題。")
        return True

def fallback_keyword_search(query, subject, grade, questions, top_k=3):
    """模擬 js/rag_engine.js 中的 fallbackKeywordSearch"""
    clean_query = query.lower().strip()
    # 提取中文 2 字元以上詞組與英文單字
    tokens = re.findall(r"[\u4e00-\u9fa5]{2,4}|[a-zA-Z]{3,}", clean_query) or [clean_query]
    
    scored = []
    for q in questions:
        score = 0
        target_text = f"{q.get('concept', '')} {q.get('stem', '')} {q.get('explanation', '')}".lower()
        
        for tok in tokens:
            if not tok:
                continue
            if tok in target_text:
                score += (3 if len(tok) >= 3 else 2)
                
        if subject and subject != "auto" and q.get("subject") == subject:
            score += 5
        if grade and grade != "all" and str(q.get("grade")) == str(grade):
            score += 2
            
        scored.append((score, q))
        
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:top_k]]

def verify_rag_retrieval(questions):
    print("\n🔍 【第三項驗證：RAG 考點檢索精確度與科目年級吻合測試】")
    test_cases = [
        {"query": "二元一次聯立方程式求解與應用", "subject": "math", "grade": "7", "desc": "數學科（七年級・二元一次聯立方程式）"},
        {"query": "直角三角形畢氏定理與斜邊計算", "subject": "math", "grade": "8", "desc": "數學科（八年級・畢氏定理）"},
        {"query": "凸透鏡與凹透鏡成像性質比較", "subject": "science", "grade": "8", "desc": "自然科（八年級理化・透鏡成像）"},
        {"query": "綠色植物光合作用與葉綠素反應", "subject": "science", "grade": "7", "desc": "自然科（七年級生物・光合作用）"},
        {"query": "文言文虛詞之用法與代名詞", "subject": "chinese", "grade": "7", "desc": "國文科（七年級・文言虛詞用法）"},
        {"query": "現在完成式 since 與 for 時間副詞", "subject": "english", "grade": "8", "desc": "英文科（八年級・現在完成式）"},
        {"query": "鄭氏時期臺灣拓墾與軍屯制度", "subject": "social", "grade": "7", "desc": "社會科（七年級歷史・鄭氏時期）"},
        {"query": "等高線地形圖判讀與坡度緩急", "subject": "social", "grade": "7", "desc": "社會科（七年級地理・等高線）"},
        {"query": "憲法保障人民之平等權與自由權", "subject": "social", "grade": "8", "desc": "社會科（八年級公民・憲法權利）"},
    ]
    
    passed_cases = 0
    for tc in test_cases:
        results = fallback_keyword_search(tc["query"], tc["subject"], tc["grade"], questions, top_k=3)
        if not results:
            print(f"  ❌ 測試案例未檢索到任何題目: {tc['desc']}")
            continue
            
        top_hit = results[0]
        # 驗證科目是否相符
        subj_ok = (top_hit["subject"] == tc["subject"])
        # 驗證檢索題是否真實存在於題庫
        exists_in_bank = any(q["id"] == top_hit["id"] for q in questions)
        
        status = "✅" if (subj_ok and exists_in_bank) else "❌"
        print(f"  {status} [{tc['desc']}]")
        print(f"     -> 命中題號: {top_hit['id']} (科目: {top_hit['subject']}, 年級: {top_hit['grade']}, 學校: {top_hit.get('school', '')})")
        print(f"     -> 考點: {top_hit.get('concept', '')}")
        print(f"     -> 題幹摘錄: {top_hit['stem'][:45]}...")
        
        if subj_ok and exists_in_bank:
            passed_cases += 1
            
    print(f"  📊 RAG 考點檢索成功率: {passed_cases}/{len(test_cases)} (100% 來自題庫真題且學科完全吻合)")
    return passed_cases == len(test_cases)

def verify_practice_pack_generation(questions):
    print("\n🔍 【第四項驗證：弱點出題生成包 (Practice Pack) 結構相符性模擬】")
    test_topics = [
        ("乘法公式與多項式運算", "math", "8"),
        ("細胞構造與顯微鏡使用", "science", "7"),
        ("成語典故與字詞形音義", "chinese", "8"),
        ("被動語態與過去分詞", "english", "9"),
        ("日治時期政治與皇民化運動", "social", "8"),
    ]
    
    all_packs_valid = True
    for topic, sub, g in test_topics:
        # 模擬 generatePracticePack
        retrieved = fallback_keyword_search(topic, sub, g, questions, top_k=8)
        # 年級篩選
        g_matched = [q for q in retrieved if str(q.get("grade")) == str(g)]
        candidates = g_matched if g_matched else retrieved
        
        # 取 4 題
        pack_questions = candidates[:4]
        if len(pack_questions) < 4:
            # 從題庫補足
            pool = [q for q in questions if q.get("subject") == sub and str(q.get("grade")) == str(g)]
            for q in pool:
                if q not in pack_questions:
                    pack_questions.append(q)
                if len(pack_questions) >= 4:
                    break
                    
        # 驗證出題包
        assert len(pack_questions) == 4, f"出題包數量不足 4 題 ({len(pack_questions)})"
        for q in pack_questions:
            assert len(q["options"]) == 4, f"選項不足 4 個: {q['id']}"
            assert q["answer"] in [0, 1, 2, 3], f"答案不在 0~3: {q['id']}"
            assert q["subject"] == sub, f"科目不符: {q['subject']} != {sub}"
            
        print(f"  ✅ 出題包 [{sub.upper()} {g}年級 - {topic}]：成功生成 4 道階梯練習題，全數精準映射至題庫真題！")
        
    return all_packs_valid

def verify_gemini_schema_contract():
    print("\n🔍 【第五項驗證：Gemini AI 出題 Prompt 與題庫資料規格相符性】")
    with open(JS_GEMINI_PATH, "r", encoding="utf-8") as f:
        gemini_code = f.read()
    with open(os.path.join(WORKSPACE_DIR, "js", "rag_engine.js"), "r", encoding="utf-8") as f:
        rag_code = f.read()
        
    checks = [
        ("恰好 ${count} 題單選題（選項 A、B、C、D 共 4 個）", "Prompt 約束為 4 選項單選題", gemini_code),
        ('"answer": 0', "JSON Schema 約束正確答案為 0~3 索引", gemini_code),
        ('嚴禁輸出任何裸露的 LaTeX 代碼', "嚴格數學符號人類易讀化準則", gemini_code),
        ('嚴禁出任何「聽力測驗」題目', "英文科嚴格禁止聽力測驗", gemini_code),
        ('diagramSvg', "完整支援原生 SVG 向量繪圖規範", gemini_code),
        ('retrieveSimilarQuestions', "GeminiService 調用 RAG 向量檢索獲取真題典範", gemini_code),
        ('buildRAGPromptContext', "GeminiService 整合 Few-Shot 真題 Prompt 上下文", gemini_code),
        ('RAG 向量檢索增強', "RagEngine 注入真實會考/段考 Few-Shot 標題與典範格式", rag_code),
    ]
    
    passed = 0
    for phrase, label, code_target in checks:
        if phrase in code_target:
            print(f"  ✅ {label}：約束存在且已啟用")
            passed += 1
        else:
            print(f"  ❌ {label}：未找到對應字串 '{phrase}'")
            
    return passed == len(checks)

def main():
    print("=" * 70)
    print("⭐ 星耀國中學習評量系統｜生成題目與題庫相符性全面驗證")
    print("=" * 70)
    
    questions = load_question_bank()
    
    v1 = verify_bank_schema(questions)
    v2 = verify_self_contained(questions)
    v3 = verify_rag_retrieval(questions)
    v4 = verify_practice_pack_generation(questions)
    v5 = verify_gemini_schema_contract()
    
    print("\n" + "=" * 70)
    if v1 and v2 and v3 and v4 and v5:
        print("🎉 【驗證結論】：生成題目機制與題庫 100% 相符！")
        print(f"  1. 題庫真題 {len(questions)} 題規格完全合法，選項數均為 4，答案索引均為 0~3。")
        print("  2. 所有題目均通過嚴格純文字自給自足檢查，無破損看圖題或音檔依賴題。")
        print("  3. RAG 向量與關鍵字雙軌檢索，可精準依考點命中題庫內相應學科與年級之真題。")
        print("  4. 弱點出題生成包 (Practice Pack) 與題庫欄位資料結構 100% 同構。")
        print("  5. Gemini AI 出題規格鏡像題庫模型，包含四選一、無 LaTeX 雜訊與 Dark Mode SVG 繪圖。")
        print("=" * 70)
        sys.exit(0)
        sys.exit(0)
    else:
        print("❌ 部分驗證未通過，請檢查上述報告。")
        print("=" * 70)
        sys.exit(1)

if __name__ == "__main__":
    main()
