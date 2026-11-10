"""Tiny local webhook receiver for demos.

    python scripts/webhook_receiver.py            # listens on :9000
    WEBHOOK_SECRET=s3cret python scripts/webhook_receiver.py

Then submit a training with callback_url=http://localhost:9000/hook
(from inside Docker use http://host.docker.internal:9000/hook).
"""

import hashlib
import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = os.getenv("WEBHOOK_SECRET")


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        verdict = ""
        if SECRET:
            expected = "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
            ok = hmac.compare_digest(expected, self.headers.get("X-Webhook-Signature", ""))
            verdict = " signature=OK" if ok else " signature=INVALID"
        print(f"\n--- webhook received on {self.path}{verdict}")
        print(json.dumps(json.loads(body), indent=2), flush=True)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9000
    print(f"listening on http://0.0.0.0:{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
