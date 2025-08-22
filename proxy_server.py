#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yahoo Finance API 代理服務器
解決前端CORS跨域問題，安全地獲取股票數據
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import logging
from urllib.error import URLError, HTTPError

# 配置日誌
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class YahooFinanceProxyHandler(http.server.BaseHTTPRequestHandler):
    """Yahoo Finance API代理處理器"""
    
    def do_GET(self):
        """處理GET請求"""
        try:
            # 解析請求路徑
            if self.path.startswith('/api/quote/'):
                self.handle_yahoo_api()
            elif self.path == '/':
                self.serve_index()
            else:
                self.serve_static_file()
                
        except Exception as e:
            logger.error(f"處理請求失敗: {e}")
            self.send_error_response(500, f"服務器內部錯誤: {str(e)}")
    
    def do_OPTIONS(self):
        """處理OPTIONS請求（CORS預檢）"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def send_cors_headers(self):
        """發送CORS標頭"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '3600')
    
    def handle_yahoo_api(self):
        """處理Yahoo Finance API請求"""
        try:
            # 解析URL參數
            url_parts = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(url_parts.query)
            
            # 提取股票代碼
            symbol = self.path.split('/api/quote/')[1].split('?')[0]
            if not symbol:
                self.send_error_response(400, "缺少股票代碼")
                return
            
            # 構建Yahoo Finance API URL
            period1 = params.get('period1', [''])[0]
            period2 = params.get('period2', [''])[0]
            interval = params.get('interval', ['1d'])[0]
            
            if not period1 or not period2:
                self.send_error_response(400, "缺少時間參數")
                return
            
            yahoo_url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
            yahoo_params = {
                'period1': period1,
                'period2': period2,
                'interval': interval
            }
            
            full_url = f"{yahoo_url}?{urllib.parse.urlencode(yahoo_params)}"
            logger.info(f"請求Yahoo Finance API: {full_url}")
            
            # 發送請求到Yahoo Finance
            request = urllib.request.Request(full_url)
            request.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            
            with urllib.request.urlopen(request, timeout=10) as response:
                data = response.read()
                
            # 驗證JSON格式
            try:
                json_data = json.loads(data.decode('utf-8'))
                logger.info(f"成功獲取 {symbol} 的數據")
            except json.JSONDecodeError:
                raise ValueError("API返回的不是有效的JSON格式")
            
            # 發送響應
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'public, max-age=300')  # 緩存5分鐘
            self.end_headers()
            self.wfile.write(data)
            
        except HTTPError as e:
            logger.error(f"Yahoo Finance API錯誤: {e.code} - {e.reason}")
            if e.code == 404:
                self.send_error_response(404, f"找不到股票代碼: {symbol}")
            else:
                self.send_error_response(502, f"Yahoo Finance API錯誤: {e.reason}")
                
        except URLError as e:
            logger.error(f"網絡錯誤: {e.reason}")
            self.send_error_response(503, "無法連接到Yahoo Finance服務")
            
        except Exception as e:
            logger.error(f"處理Yahoo API請求失敗: {e}")
            self.send_error_response(500, f"代理服務器錯誤: {str(e)}")
    
    def serve_index(self):
        """提供主頁面"""
        try:
            with open('index.html', 'r', encoding='utf-8') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))
            
        except FileNotFoundError:
            self.send_error_response(404, "找不到index.html文件")
    
    def serve_static_file(self):
        """提供靜態文件"""
        try:
            # 移除開頭的斜線
            file_path = self.path.lstrip('/')
            
            # 安全檢查：防止路徑遍歷攻擊
            if '..' in file_path or file_path.startswith('/'):
                self.send_error_response(403, "禁止訪問")
                return
            
            # 確定內容類型
            if file_path.endswith('.css'):
                content_type = 'text/css; charset=utf-8'
            elif file_path.endswith('.js'):
                content_type = 'application/javascript; charset=utf-8'
            elif file_path.endswith('.html'):
                content_type = 'text/html; charset=utf-8'
            else:
                content_type = 'application/octet-stream'
            
            # 讀取並發送文件
            with open(file_path, 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', content_type)
            self.send_header('Cache-Control', 'public, max-age=3600')  # 緩存1小時
            self.end_headers()
            self.wfile.write(content)
            
        except FileNotFoundError:
            self.send_error_response(404, f"找不到文件: {file_path}")
        except Exception as e:
            logger.error(f"提供靜態文件失敗: {e}")
            self.send_error_response(500, "服務器錯誤")
    
    def send_error_response(self, code, message):
        """發送錯誤響應"""
        self.send_response(code)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        
        error_data = {
            'error': True,
            'code': code,
            'message': message,
            'timestamp': self.date_time_string()
        }
        
        self.wfile.write(json.dumps(error_data, ensure_ascii=False).encode('utf-8'))
    
    def log_message(self, format, *args):
        """自定義日誌格式"""
        logger.info(f"{self.client_address[0]} - {format % args}")

def main():
    """主函數"""
    PORT = 8080
    
    print("🚀 Yahoo Finance 代理服務器")
    print("=" * 50)
    print(f"🌐 啟動代理服務器，端口: {PORT}")
    print(f"🔗 前端訪問: http://localhost:{PORT}")
    print(f"📡 API代理: http://localhost:{PORT}/api/quote/{{symbol}}")
    print("=" * 50)
    print("📝 API使用說明：")
    print("   GET /api/quote/{symbol}?period1=...&period2=...&interval=1d")
    print("   範例: /api/quote/2330.TW?period1=1640995200&period2=1672531200")
    print("-" * 50)
    
    try:
        with socketserver.TCPServer(("", PORT), YahooFinanceProxyHandler) as httpd:
            logger.info(f"代理服務器已啟動在端口 {PORT}")
            print("✅ 服務器運行中...")
            print("💡 提示：按 Ctrl+C 停止服務器")
            print("-" * 50)
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 代理服務器已停止")
    except OSError as e:
        if e.errno == 48:
            print(f"❌ 端口 {PORT} 已被占用")
            print("💡 請修改端口號或終止占用的程序")
        else:
            print(f"❌ 啟動服務器失敗: {e}")
    except Exception as e:
        logger.error(f"服務器錯誤: {e}")
        print(f"❌ 未知錯誤: {e}")

if __name__ == "__main__":
    main()