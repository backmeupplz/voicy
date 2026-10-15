#!/usr/bin/env python3
"""Lets workers on other hosts download through this host's --local Bot API.

A --local telegram-bot-api server returns absolute paths from getFile and does
not serve files over HTTP. This proxy forwards getMe/getFile, rewrites
file_path relative to the bot's data dir, and serves /file/bot<token>/<path>
from that dir. Remote workers then download files over 20 MB the same way as
from the cloud Bot API, without logging the bot into a second Bot API server.

Usage: telegram-bot-api-file-proxy.py <bot api --dir> [port] [upstream]
Expose it on the tailnet: tailscale serve --bg --https=8443 http://127.0.0.1:8082
"""
import json
import os
import re
import shutil
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

DATA_DIR = os.path.realpath(sys.argv[1])
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8082
UPSTREAM = sys.argv[3] if len(sys.argv) > 3 else "http://127.0.0.1:8081"
TOKEN = re.compile(r"\d+:[A-Za-z0-9_-]+")


def bot_dir(token):
    """The server's per-bot dir (Windows stores ':' in the token as '~')."""
    if not TOKEN.fullmatch(token):
        return None
    for name in (token.replace(":", "~"), token):
        path = os.path.join(DATA_DIR, name)
        if os.path.isdir(path):
            return path
    return None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        parts = url.path.split("/", 3)
        if len(parts) == 3 and parts[1].startswith("bot") and parts[2] in ("getMe", "getFile"):
            directory = bot_dir(parts[1][3:])
            if directory:
                return self.forward(directory, url)
        if len(parts) == 4 and parts[1] == "file" and parts[2].startswith("bot"):
            directory = bot_dir(parts[2][3:])
            if directory:
                return self.send_file(directory, unquote(parts[3]))
        self.send_error(404)

    def forward(self, directory, url):
        try:
            with urllib.request.urlopen(f"{UPSTREAM}{url.path}?{url.query}", timeout=600) as response:
                status, body = response.status, json.load(response)
        except urllib.error.HTTPError as error:
            status, body = error.code, json.load(error)
        result = body.get("result")
        if isinstance(result, dict) and os.path.isabs(result.get("file_path", "")):
            result["file_path"] = os.path.relpath(result["file_path"], directory).replace(os.sep, "/")
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_file(self, directory, relative):
        root = os.path.realpath(directory)
        path = os.path.realpath(os.path.join(root, relative))
        if os.path.commonpath([root, path]) != root or not os.path.isfile(path):
            return self.send_error(404)
        self.send_response(200)
        self.send_header("Content-Length", str(os.path.getsize(path)))
        self.end_headers()
        with open(path, "rb") as source:
            shutil.copyfileobj(source, self.wfile)

    def log_message(self, *args):  # request paths contain the bot token
        pass


ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
