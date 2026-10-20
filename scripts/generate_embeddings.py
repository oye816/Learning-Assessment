#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成星耀國中冒險學院題庫向量索引 (RAG Vector Embeddings)
使用 Google Gemini embedding 模型 (gemini-embedding-2, 768 維)
具備進度快取、429 自動退避重試
"""

import json
import math
import os
import re
import sys
import time
import urllib.request
import urllib.error

def get_api_key():
    env_key = os.environ.get("GEMINI_API_KEY")
    if env_key:
        return env_key
    config_path = os.path.join(os.path.dirname(__file__), "..", "config.js")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            match = re.search(r'defaultGeminiApiKey:\s*["\']([^"\']+)["\']', f.read())
            if match:
                return match.group(1)
    return ""

API_KEY = get_api_key()
EMBEDDING_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key={API_KEY}"
DIM = 768
CACHE_PATH = os.path.join(os.path.dirname(__file__), "embeddings_cache.json")

SUBJECT_NAMES = {
    "chinese": "國文領域",
    "english": "英文領域",
    "math": "數學領域",
    "science": "自然科學領域",
    "social": "社會領域"
}

def load_questions():
    questions = []
    
    # 1. 讀取 js/real_exam_questions.js
    real_path = os.path.join(os.path.dirname(__file__), "..", "js", "real_exam_questions.js")
    with open(real_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    import subprocess
    cmd = [
        "node", "-e",
        "const fs = require('fs');"
        "const realFile = fs.readFileSync('" + real_path + "', 'utf8');"
        "eval(realFile.replace('const REAL_EXAM_QUESTIONS', 'global.REAL_EXAM_QUESTIONS'));"
        "console.log(JSON.stringify(global.REAL_EXAM_QUESTIONS));"
    ]
    out = subprocess.check_output(cmd).decode("utf-8")
    real_list = json.loads(out)
    print(f"✅ 成功載入歷屆段考/會考真題：{len(real_list)} 題")
    questions.extend(real_list)

    # 2. 讀取 index.html 中的 CORE_QUESTIONS
    index_path = os.path.join(os.path.dirname(__file__), "..", "index.html")
    cmd = [
        "node", "-e",
        "const fs = require('fs');"
        "const indexFile = fs.readFileSync('" + index_path + "', 'utf8');"
        "const m = indexFile.match(/const CORE_QUESTIONS\\s*=\\s*(\\[[\\s\\S]*?\\n\\s*\\]);/);"
        "if (m) {"
        "  eval('global.CORE_QUESTIONS = ' + m[1]);"
        "  console.log(JSON.stringify(global.CORE_QUESTIONS));"
        "} else {"
        "  console.log('[]');"
        "}"
    ]
    out = subprocess.check_output(cmd).decode("utf-8")
    core_list = json.loads(out)
    print(f"✅ 成功載入核心基礎題：{len(core_list)} 題")
    questions.extend(core_list)

    unique_map = {}
    for q in questions:
        stem = q.get("stem", "").strip()
        if stem and stem not in unique_map:
            unique_map[stem] = q
            
    final_list = list(unique_map.values())
    print(f"📊 總計待向量化題目數（去重後）：{len(final_list)} 題")
    return final_list

def make_search_text(q):
    sub_name = SUBJECT_NAMES.get(q.get("subject", ""), "綜合")
    grade = q.get("grade", "8")
    concept = q.get("concept", "")
    stem = q.get("stem", "")
    return f"【{sub_name} {grade}年級】考點：{concept}。題幹：{stem}"

def batch_embed(texts, batch_size=20):
    cache = {}
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                cache = json.load(f)
            print(f"📂 從快取載入 {len(cache)} 筆既有向量")
        except Exception:
            cache = {}

    all_embeddings = []
    total = len(texts)
    
    for i in range(0, total, batch_size):
        chunk_texts = texts[i:i+batch_size]
        
        # 檢查快取
        missing_indices = []
        chunk_results = [None] * len(chunk_texts)
        for idx, t in enumerate(chunk_texts):
            if t in cache:
                chunk_results[idx] = cache[t]
            else:
                missing_indices.append(idx)
                
        if missing_indices:
            print(f"🚀 正在請求向量 API 第 {i+1} ~ {min(i+batch_size, total)} / {total} 題（其中 {len(missing_indices)} 題需計算）...")
            reqs = [{
                "model": "models/gemini-embedding-2",
                "content": {"parts": [{"text": chunk_texts[idx]}]},
                "outputDimensionality": DIM
            } for idx in missing_indices]
            
            payload = json.dumps({"requests": reqs}).encode("utf-8")
            req = urllib.request.Request(EMBEDDING_URL, data=payload, headers={"Content-Type": "application/json"})
            
            success = False
            for attempt in range(6):
                try:
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                        embs = [item["values"] for item in res.get("embeddings", [])]
                        for m_idx, emb in zip(missing_indices, embs):
                            chunk_results[m_idx] = emb
                            cache[chunk_texts[m_idx]] = emb
                        success = True
                        break
                except urllib.error.HTTPError as e:
                    wait_sec = (attempt + 1) * 8
                    print(f"⚠️ 遇到 API 頻率限制 (HTTP {e.code})，自動冷卻暫停 {wait_sec} 秒後重試...")
                    time.sleep(wait_sec)
                except Exception as e:
                    wait_sec = (attempt + 1) * 5
                    print(f"⚠️ 網路錯誤: {e}，等待 {wait_sec} 秒後重試...")
                    time.sleep(wait_sec)
                    
            if not success:
                raise RuntimeError(f"❌ 批量向量化第 {i} 題時連續重試失敗！")
                
            # 即時儲存快取
            with open(CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False)
                
            time.sleep(2.5) # 安全間隔避開 RPM
        else:
            print(f"⚡ 第 {i+1} ~ {min(i+batch_size, total)} 題已命中快取")
            
        all_embeddings.extend(chunk_results)
        
    return all_embeddings

def main():
    questions = load_questions()
    texts = [make_search_text(q) for q in questions]
    
    start_time = time.time()
    embeddings = batch_embed(texts, batch_size=20)
    elapsed = time.time() - start_time
    print(f"🎉 全部向量化完成！共耗時 {elapsed:.2f} 秒。")
    
    records = []
    for q, emb, text in zip(questions, embeddings, texts):
        norm = math.sqrt(sum(v*v for v in emb))
        norm_emb = [round(v / norm, 5) if norm > 0 else 0 for v in emb]
        
        records.append({
            "id": q.get("id"),
            "subject": q.get("subject"),
            "grade": str(q.get("grade", "8")),
            "concept": q.get("concept", ""),
            "stem": q.get("stem", ""),
            "options": q.get("options", []),
            "answer": q.get("answer", 0),
            "hint": q.get("hint", ""),
            "explanation": q.get("explanation", ""),
            "school": q.get("school", "會考/段考精選"),
            "search_text": text,
            "vector": norm_emb
        })
        
    output_path = os.path.join(os.path.dirname(__file__), "..", "js", "question_embeddings.js")
    
    js_content = f"""// 星耀國中冒險學院｜RAG 題庫向量特徵資料庫 (Question Embeddings 768-dim)
// 自動生成於 {time.strftime('%Y-%m-%d %H:%M:%S')}，模型: gemini-embedding-2
// 共收錄 {len(records)} 道會考與名校段考真題之高維語意向量

const QUESTION_EMBEDDINGS = {json.dumps(records, ensure_ascii=False)};

if (typeof window !== 'undefined') {{
  window.QUESTION_EMBEDDINGS = QUESTION_EMBEDDINGS;
}}
if (typeof module !== 'undefined' && module.exports) {{
  module.exports = {{ QUESTION_EMBEDDINGS }};
}}
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(js_content)
        
    print(f"💾 成功寫入向量特徵庫檔案：{output_path} ({os.path.getsize(output_path) / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
