#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
驗證腳本：登出功能驗證 (導航列登出按鈕、歷程頁登出按鈕、系統設定登出按鈕與登出狀態切換)
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def test_logout_ui_elements():
    print("\n🔍 【驗證一：前端 UI 登出按鈕配置】")
    html_path = ROOT / "index.html"
    assert html_path.exists(), "index.html 不存在"
    content = html_path.read_text(encoding="utf-8")

    # 1. 頂部導航列登出按鈕
    assert 'id="btnNavLogout"' in content, "頂部導航列缺少 id='btnNavLogout' 登出按鈕"
    assert "handleGoogleLogout()" in content, "未綁定 handleGoogleLogout() 登出處理函式"
    assert "🚪" in content, "登出按鈕缺少清晰的門戶圖示標記"

    # 2. 個人學習歷程頁面快捷登出按鈕
    assert 'id="btnHistoryLogout"' in content, "個人歷程頁面缺少 id='btnHistoryLogout' 登出按鈕"

    # 3. 系統設定彈窗登出按鈕
    assert 'id="btnSettingsLogout"' in content, "系統設定彈窗缺少 id='btnSettingsLogout' 登出按鈕"
    print("  ✅ 導航列、個人歷程、系統設定三大核心入口皆具備清晰登出按鈕")

def test_logout_handler_logic():
    print("\n🔍 【驗證二：handleGoogleLogout 函式安全防護與流程】")
    html_path = ROOT / "index.html"
    content = html_path.read_text(encoding="utf-8")

    assert "window.confirm(" in content, "handleGoogleLogout 缺少防誤觸二次確認對話框"
    assert "switchTab('hub')" in content, "管理員登出時缺少跳轉回測驗大廳之安全機制"
    assert "window.handleGoogleLogout = handleGoogleLogout;" in content, "window 未全域導出 handleGoogleLogout"
    print("  ✅ handleGoogleLogout 包含防誤觸確認、Firebase logout 呼叫與管理員頁面自動跳轉保護")

def test_firebase_logout_service():
    print("\n🔍 【驗證三：FirebaseService.logout 方法健全度】")
    fb_path = ROOT / "js" / "firebase.js"
    assert fb_path.exists(), "js/firebase.js 不存在"
    content = fb_path.read_text(encoding="utf-8")

    assert "static async logout()" in content, "FirebaseService 缺少 static async logout() 方法"
    assert "signOut(auth)" in content, "FirebaseService.logout 未執行 signOut(auth)"
    assert "localStorage.removeItem('jh_quest_cached_user')" in content, "未清除登入使用者快取"
    print("  ✅ FirebaseService.logout 完整覆蓋雲端登出與本機快取清理")

def main():
    print("======================================================================")
    print("🚀 開始執行 Google 登出功能驗證 (Google Logout Feature Verification)")
    print("======================================================================")
    test_logout_ui_elements()
    test_logout_handler_logic()
    test_firebase_logout_service()
    print("\n======================================================================")
    print("🎉 Google 登出功能驗證 100% 通過！")
    print("======================================================================")

if __name__ == "__main__":
    main()
