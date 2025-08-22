#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yahoo股票技術分析工具 - 本地服務器啟動腳本
簡化項目運行過程，自動處理CORS問題
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """支援CORS的HTTP請求處理器"""
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def main():
    """主函數"""
    # 設置端口
    PORT = 8000
    
    # 確保在正確的目錄中運行
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print("🚀 Yahoo股票技術分析工具")
    print("=" * 50)
    print(f"📂 工作目錄: {script_dir}")
    print(f"🌐 啟動本地服務器，端口: {PORT}")
    print(f"🔗 訪問地址: http://localhost:{PORT}")
    print("=" * 50)
    
    try:
        # 創建服務器
        with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
            print(f"✅ 服務器已啟動在端口 {PORT}")
            print("📝 提示：")
            print("   - 按 Ctrl+C 停止服務器")
            print("   - 支援CORS，可直接調用Yahoo Finance API")
            print("   - 自動在瀏覽器中打開頁面")
            print("-" * 50)
            
            # 自動在瀏覽器中打開
            try:
                webbrowser.open(f'http://localhost:{PORT}')
                print("🌐 已在瀏覽器中打開頁面")
            except Exception as e:
                print(f"⚠️  無法自動打開瀏覽器: {e}")
                print(f"🔗 請手動訪問: http://localhost:{PORT}")
            
            print("-" * 50)
            
            # 啟動服務器
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 服務器已停止")
        sys.exit(0)
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ 端口 {PORT} 已被占用")
            print("💡 解決方案：")
            print(f"   1. 終止占用端口的程序")
            print(f"   2. 使用其他端口（修改腳本中的PORT變數）")
        else:
            print(f"❌ 啟動服務器失敗: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 未知錯誤: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()