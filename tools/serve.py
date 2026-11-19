#!/usr/bin/env python3
"""Serve USA Atlas from its folder; disable browser caching between alpha versions."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import webbrowser

root=Path(__file__).resolve().parents[1]
os.chdir(root)

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

port=8001
try:
    server=ThreadingHTTPServer(('127.0.0.1',port),NoCacheHandler)
except OSError as error:
    raise SystemExit(f'Could not start on port {port}. Stop the atlas already using it and try again. ({error})')
print(f'USA Atlas 0.2D at http://localhost:{port}/')
print('Keep this window open. CTRL+C stops the server.')
try: webbrowser.open(f'http://localhost:{port}/')
except Exception: pass
try:
    server.serve_forever()
except KeyboardInterrupt:
    print('\nAtlas stopped.')
finally:
    server.server_close()
