"""
One-time Etsy OAuth setup — run this once to get your access token.

Usage:
    python etsy_oauth.py

Steps:
  1. Kills any stale process on port 3003
  2. Starts the callback server (port 3003)
  3. Generates PKCE values and auth URL
  4. Opens the URL in your browser automatically
  5. Catches the callback, exchanges code for token
  6. Auto-updates .env with ETSY_ACCESS_TOKEN
"""
import base64
import hashlib
import json
import os
import secrets
import socket
import subprocess
import sys
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

REDIRECT_PORT = 3003
REDIRECT_URI = f"http://localhost:{REDIRECT_PORT}/oauth/redirect"
SCOPE = "listings_r listings_w shops_r shops_w"

# ── Load credentials from .env ────────────────────────────────────────────────
env_path = Path(__file__).parent / ".env"
env: dict[str, str] = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

CLIENT_ID = os.getenv("ETSY_API_KEY") or env.get("ETSY_API_KEY", "")
if not CLIENT_ID:
    print("ERROR: ETSY_API_KEY not found in .env"); sys.exit(1)

# ── Kill any stale process on port 3003 ──────────────────────────────────────
def _kill_port(port: int) -> None:
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True
        )
        for line in result.stdout.splitlines():
            if f":{port} " in line and "LISTENING" in line:
                pid = line.strip().split()[-1]
                subprocess.run(["taskkill", "/F", "/PID", pid],
                               capture_output=True)
    except Exception:
        pass

_kill_port(REDIRECT_PORT)

# ── Start server first, then generate URL ────────────────────────────────────
server = HTTPServer(("localhost", REDIRECT_PORT), None)  # placeholder handler

# ── PKCE ─────────────────────────────────────────────────────────────────────
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

code_verifier = _b64url(secrets.token_bytes(32))
code_challenge = _b64url(hashlib.sha256(code_verifier.encode()).digest())
state = secrets.token_urlsafe(8)

# Persist to disk so the handler can read them even if something re-imports
state_file = Path(__file__).parent / "etsy_oauth_state.json"
state_file.write_text(json.dumps({
    "state": state,
    "code_verifier": code_verifier,
}))

# ── Build auth URL ────────────────────────────────────────────────────────────
params = {
    "response_type": "code",
    "redirect_uri": REDIRECT_URI,
    "scope": SCOPE,
    "client_id": CLIENT_ID,
    "state": state,
    "code_challenge": code_challenge,
    "code_challenge_method": "S256",
}
auth_url = "https://www.etsy.com/oauth/connect?" + urllib.parse.urlencode(params)
Path(__file__).parent.joinpath("etsy_oauth_url.txt").write_text(auth_url)

# ── Handler ───────────────────────────────────────────────────────────────────
_result: dict = {}
_handled = False

class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass

    def do_GET(self):
        global _handled
        parsed = urllib.parse.urlparse(self.path)

        if not parsed.path.startswith("/oauth/redirect"):
            self.send_response(404); self.end_headers()
            return

        if _handled:
            self.send_response(200); self.end_headers()
            self.wfile.write(b"Already handled.")
            return

        qs = urllib.parse.parse_qs(parsed.query)
        auth_code = (qs.get("code") or [""])[0]
        returned_state = (qs.get("state") or [""])[0]

        # Read state from disk (immune to in-memory mismatch across runs)
        saved = json.loads(state_file.read_text())
        expected_state = saved["state"]
        verifier = saved["code_verifier"]

        if returned_state != expected_state:
            self.send_response(400); self.end_headers()
            self.wfile.write(
                f"State mismatch: got '{returned_state}', expected '{expected_state}'".encode()
            )
            return

        _handled = True

        # Exchange code for token
        token_payload = json.dumps({
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "code": auth_code,
            "code_verifier": verifier,
        }).encode()

        req = urllib.request.Request(
            "https://api.etsy.com/v3/public/oauth/token",
            data=token_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                token_data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            token_data = {"error": str(e), "body": body}

        _result.update(token_data)

        msg = b"<h1>Done!</h1><p>Access token saved. You can close this tab.</p>"
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(msg)
        self.server.server_close()

        import threading
        threading.Thread(target=self.server.shutdown, daemon=True).start()


server.RequestHandlerClass = _Handler

print("\n" + "=" * 60)
print("ETSY OAUTH SETUP")
print("=" * 60)
print(f"\nOpening browser... if it doesn't open, visit:\n\n{auth_url}\n")
print("Waiting for Etsy callback on localhost:3003 ...")
print("=" * 60 + "\n")

webbrowser.open(auth_url)
server.serve_forever()

# ── Save result ───────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
if "access_token" in _result:
    token = _result["access_token"]
    refresh = _result.get("refresh_token", "")
    print("SUCCESS!\n")

    content = env_path.read_text()
    lines = content.splitlines()
    updated = []
    added_refresh = False
    for line in lines:
        if line.startswith("ETSY_ACCESS_TOKEN="):
            updated.append(f"ETSY_ACCESS_TOKEN={token}")
        elif line.startswith("ETSY_REFRESH_TOKEN="):
            updated.append(f"ETSY_REFRESH_TOKEN={refresh}")
            added_refresh = True
        else:
            updated.append(line)
    if refresh and not added_refresh:
        updated.append(f"ETSY_REFRESH_TOKEN={refresh}")

    env_path.write_text("\n".join(updated) + "\n")
    print(".env updated with ETSY_ACCESS_TOKEN")
    print(f"Token expires in: {_result.get('expires_in', '?')}s")

    # Clean up temp files
    state_file.unlink(missing_ok=True)
else:
    print("FAILED:")
    print(json.dumps(_result, indent=2))
print("=" * 60 + "\n")
