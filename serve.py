#!/usr/bin/env python3
"""
NEXUS Pixel Cat Dashboard — Local Server
Run: python3 serve.py
Then open: http://localhost:8080/dashboard.html
"""
import http.server, socketserver, webbrowser, os

PORT = 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  [{self.address_string()}] {fmt % args}")

print(f"\n🐱 NEXUS Pixel Cat — Starting server on http://localhost:{PORT}")
print(f"   Dashboard: http://localhost:{PORT}/dashboard.html")
print(f"   Press Ctrl+C to stop\n")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    webbrowser.open(f"http://localhost:{PORT}/dashboard.html")
    httpd.serve_forever()
