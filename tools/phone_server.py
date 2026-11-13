"""Local-only presentation server. Supabase credentials stay on this computer."""
import json
import os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

project = Path(__file__).resolve().parents[1]
env_file = project / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            os.environ.setdefault(name.strip(), value.strip().strip("'\""))
if not all(os.getenv(key) for key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")):
    raise SystemExit("Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in village-atlas/.env first.")
URL = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/village_readings?on_conflict=id"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ROOT = Path(__file__).resolve().parents[1] / "dist"


class Presenter(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != "/api/water":
            return self.send_error(404)
        if self.headers.get("Origin") != "http://127.0.0.1:8046" or self.headers.get("Host") != "127.0.0.1:8046":
            return self.send_error(403)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size < 2048:
                return self.send_error(400)
            row = json.loads(self.rfile.read(size))
            fields = {"id","main_pct","lower_pct","chlorine","condition","alert"}
            if not isinstance(row, dict) or set(row) - {"stats"} != fields:
                return self.send_error(400)
            req = Request(URL, data=json.dumps(row).encode(), headers={
                "apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json",
                "Prefer": "resolution=ignore-duplicates,return=minimal"})
            try:
                with urlopen(req, timeout=8):
                    pass
            except HTTPError as error:
                detail = error.read(2048)
                if error.code != 400 or b"PGRST204" not in detail or b"stats" not in detail or "stats" not in row:
                    raise
                # Keep safety alerts flowing while the presenter applies the schema update.
                row.pop("stats")
                req.data = json.dumps(row).encode()
                with urlopen(req, timeout=8):
                    pass
            self.send_response(204)
            self.end_headers()
        except (ValueError, TypeError):
            self.send_error(400)
        except (URLError, TimeoutError):
            self.send_error(502, "Check Supabase connection and schema")


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8046), Presenter).serve_forever()
