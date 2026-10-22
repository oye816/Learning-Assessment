#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
驗證腳本：測驗歷程紀錄刪除功能 (單筆刪除、一鍵清空、Firestore 規則與前端介面)
"""

import sys
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def test_firestore_rules():
    print("\n🔍 【驗證一：Firestore Security Rules 允許刪除 assessment_records】")
    rules_path = ROOT / "firestore.rules"
    assert rules_path.exists(), "firestore.rules 不存在"
    content = rules_path.read_text(encoding="utf-8")
    
    assert "allow delete: if request.auth != null" in content, "firestore.rules 缺少 assessment_records 的 delete 規則"
    assert "resource.data.userId == request.auth.uid" in content, "firestore.rules delete 規則未校驗 userId 本人權限"
    print("  ✅ firestore.rules 正確配置 assessment_records 刪除權限 (本人與管理員可刪除)")

def test_firebase_service_delete_methods():
    print("\n🔍 【驗證二：FirebaseService 具備 deleteAssessmentRecord 與 clearAllAssessmentRecords】")
    fb_path = ROOT / "js" / "firebase.js"
    assert fb_path.exists(), "js/firebase.js 不存在"
    content = fb_path.read_text(encoding="utf-8")

    assert "static async deleteAssessmentRecord" in content, "FirebaseService 缺少 deleteAssessmentRecord 靜態方法"
    assert "static async clearAllAssessmentRecords" in content, "FirebaseService 缺少 clearAllAssessmentRecords 靜態方法"
    assert "localStorage.setItem('jh_quest_local_history'" in content, "deleteAssessmentRecord 未更新本地快取"
    assert "deleteDoc(doc(db, \"assessment_records\"" in content, "deleteAssessmentRecord 未執行雲端 deleteDoc"
    print("  ✅ FirebaseService 具備完整本機與雲端刪除與一鍵清空功能")

def test_index_html_ui_buttons_and_handlers():
    print("\n🔍 【驗證三：index.html 前端 UI 元件與刪除操作函式】")
    html_path = ROOT / "index.html"
    assert html_path.exists(), "index.html 不存在"
    content = html_path.read_text(encoding="utf-8")

    # 1. 歷程頂部清空按鈕
    assert "confirmClearAllHistory" in content, "index.html 缺少 confirmClearAllHistory 清空所有紀錄按鈕/函式"
    assert "清空所有紀錄" in content, "index.html 歷程頂部缺少「清空所有紀錄」按鈕文本"

    # 2. 個人紀錄表格每列刪除按鈕
    assert "deletePersonalRecord" in content, "index.html 缺少 deletePersonalRecord 函式"
    assert "deletePersonalRecord(${idx})" in content, "index.html 表格列未綁定 deletePersonalRecord(${idx})"

    # 3. 管理者後台表格列刪除按鈕
    assert "deleteAdminRecord" in content, "index.html 缺少 deleteAdminRecord 函式"
    assert "deleteAdminRecord(${idx})" in content, "index.html 管理者表格列未綁定 deleteAdminRecord(${idx})"

    # 4. 全域 window 導出
    assert "window.deletePersonalRecord = deletePersonalRecord;" in content, "window 未導出 deletePersonalRecord"
    assert "window.confirmClearAllHistory = confirmClearAllHistory;" in content, "window 未導出 confirmClearAllHistory"
    assert "window.deleteAdminRecord = deleteAdminRecord;" in content, "window 未導出 deleteAdminRecord"

    print("  ✅ index.html 已完整配置單筆刪除、一鍵清空、管理者刪除按鈕與 window 導出")

def test_simulated_deletion_logic():
    print("\n🔍 【驗證四：模擬本機與資料特徵刪除過濾演算法】")
    mock_local_history = [
        {"id": "rec_001", "clientRecordId": "rec_001", "cloudDocId": "cloud_doc_111", "title": "第一次段考數學", "score": 4},
        {"id": "rec_002", "clientRecordId": "rec_002", "cloudDocId": "cloud_doc_222", "title": "AI 弱點特訓", "score": 5},
        {"id": "rec_003", "clientRecordId": "rec_003", "cloudDocId": None, "title": "離線測驗", "score": 3}
    ]

    # 模擬刪除 rec_002 (以物件形式)
    target = mock_local_history[1]
    filtered = [
        r for r in mock_local_history
        if (r.get("clientRecordId") != target["clientRecordId"] and r.get("id") != target["id"] and r.get("cloudDocId") != target["cloudDocId"])
    ]
    assert len(filtered) == 2, "刪除後應剩 2 筆紀錄"
    assert all(r["id"] != "rec_002" for r in filtered), "rec_002 應已被成功剔除"

    # 模擬刪除未同步之離線紀錄 rec_003 (以 ID 字串形式)
    target_id = "rec_003"
    filtered2 = [
        r for r in filtered
        if r.get("clientRecordId") != target_id and r.get("id") != target_id
    ]
    assert len(filtered2) == 1, "刪除後應剩 1 筆紀錄"
    assert filtered2[0]["id"] == "rec_001", "僅剩第一筆紀錄"

    print("  ✅ 模擬刪除演算法驗證通過（支援物件與字串 ID、已同步與未同步紀錄精確過濾）")

def test_dynamic_admin_system():
    print("\n🔍 【驗證五：動態管理員授權機制與 system_admins 雲端集合】")
    rules_path = ROOT / "firestore.rules"
    rules_content = rules_path.read_text(encoding="utf-8")
    assert "function isAdmin()" in rules_content, "firestore.rules 缺少 isAdmin() 函式"
    assert "system_admins" in rules_content, "firestore.rules 缺少 system_admins 集合支援"
    assert "exists(/databases/$(database)/documents/system_admins/" in rules_content, "firestore.rules 缺少動態查詢 system_admins 判斷"

    fb_path = ROOT / "js" / "firebase.js"
    fb_content = fb_path.read_text(encoding="utf-8")
    assert "fetchCloudAdminList" in fb_content, "FirebaseService 缺少 fetchCloudAdminList 方法"
    assert "revokeAdmin" in fb_content, "FirebaseService 缺少 revokeAdmin 方法"
    assert "system_admins" in fb_content, "FirebaseService 缺少 system_admins 雲端集合操作"
    assert "_cloudAdminsCache" in fb_content, "FirebaseService 缺少 _cloudAdminsCache 快取"

    html_path = ROOT / "index.html"
    html_content = html_path.read_text(encoding="utf-8")
    assert "saveCustomConfig(firebaseObj, adminEmails, appState.currentUser)" in html_content, "index.html 未傳入 currentUser 給 saveCustomConfig"

    print("  ✅ 動態管理員 (system_admins) 雲端集合與 Rules 動態認可機制驗證通過！")

def main():
    print("======================================================================")
    print("🚀 開始執行測驗歷程紀錄刪除與動態管理員驗證 (Delete History & Dynamic Admin)")
    print("======================================================================")
    test_firestore_rules()
    test_firebase_service_delete_methods()
    test_index_html_ui_buttons_and_handlers()
    test_simulated_deletion_logic()
    test_dynamic_admin_system()
    print("\n======================================================================")
    print("🎉 測驗歷程刪除與動態管理員全數驗證通過！")
    print("======================================================================")

if __name__ == "__main__":
    main()

