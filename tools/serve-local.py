#!/usr/bin/env python3
"""Serve Loomwright with a private, revisioned project store."""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

MAX_RECORD_BYTES = 64 * 1024 * 1024


class LoomwrightHandler(SimpleHTTPRequestHandler):
    server: "LoomwrightServer"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(self.server.root), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def translate_path(self, path):
        translated = Path(super().translate_path(path)).resolve()
        try:
            translated.relative_to(self.server.data_dir)
        except ValueError:
            return str(translated)
        return str(self.server.root / "__private_data_not_found__")

    def do_GET(self):
        if urlsplit(self.path).path == "/api/sync":
            try:
                self.send_json(200, self.server.read_snapshot())
            except sqlite3.Error:
                self.send_error(503, "The shared project store is temporarily unavailable.")
            return
        super().do_GET()

    def do_PUT(self):
        if urlsplit(self.path).path != "/api/sync":
            self.send_error(404)
            return
        if not self.same_origin_write():
            self.send_error(403, "Same-origin writes only.")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400, "Invalid content length.")
            return
        if length <= 0 or length > MAX_RECORD_BYTES:
            self.send_error(413, "Project data is empty or too large.")
            return
        try:
            payload = json.loads(self.rfile.read(length))
            expected_revision = payload["expectedRevision"]
            record = payload["record"]
            if not isinstance(expected_revision, int) or expected_revision < 0:
                raise ValueError("Invalid revision.")
            if not isinstance(record, dict) or not isinstance(record.get("projects"), list):
                raise ValueError("Invalid project record.")
            if len(record["projects"]) > 500:
                raise ValueError("Too many projects.")
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            self.send_error(400, "Invalid project record.")
            return

        try:
            connection = self.server.connect()
            connection.execute("BEGIN IMMEDIATE")
            current = self.server.read_snapshot(connection)
            if expected_revision != current["revision"]:
                connection.rollback()
                self.send_json(409, current)
                return
            updated = {"revision": current["revision"] + 1, "record": record}
            if current["record"] is not None:
                self.server.write_backup(current)
            self.server.write_snapshot(updated, connection)
            connection.commit()
            connection.close()
        except (OSError, sqlite3.Error):
            self.send_error(503, "The shared project store could not be saved.")
            return
        self.send_json(200, updated)

    def same_origin_write(self):
        origin = self.headers.get("Origin")
        if not origin:
            return False
        origin_host = urlsplit(origin).netloc.lower()
        request_hosts = {
            self.headers.get("Host", "").lower(),
            self.headers.get("X-Forwarded-Host", "").split(",", 1)[0].strip().lower(),
        }
        return bool(origin_host and origin_host in request_hosts)

    def send_json(self, status, value):
        body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        if urlsplit(self.path).path != "/api/sync":
            super().log_message(format, *args)


class LoomwrightServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, root: Path, data_dir: Path):
        self.root = root.resolve()
        self.data_dir = data_dir.resolve()
        self.data_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        try:
            os.chmod(self.data_dir, 0o700)
        except OSError:
            pass
        self.database_path = self.data_dir / "projects.sqlite3"
        self.backup_path = self.data_dir / "projects.json.bak"
        with self.connect() as connection:
            connection.execute("CREATE TABLE IF NOT EXISTS shared_state (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, record TEXT)")
            connection.execute("INSERT OR IGNORE INTO shared_state (id, revision, record) VALUES (1, 0, NULL)")
        try:
            os.chmod(self.database_path, 0o600)
        except OSError:
            pass
        super().__init__(address, LoomwrightHandler)

    def connect(self):
        return sqlite3.connect(self.database_path, timeout=10)

    def read_snapshot(self, connection=None):
        owns_connection = connection is None
        connection = connection or self.connect()
        try:
            row = connection.execute("SELECT revision, record FROM shared_state WHERE id = 1").fetchone()
            return {"revision": row[0], "record": json.loads(row[1]) if row[1] else None}
        finally:
            if owns_connection:
                connection.close()

    def write_snapshot(self, value, connection):
        connection.execute("UPDATE shared_state SET revision = ?, record = ? WHERE id = 1", (value["revision"], json.dumps(value["record"], ensure_ascii=False)))

    def write_backup(self, value):
        temporary = self.backup_path.with_suffix(".json.bak.tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        try:
            os.chmod(temporary, 0o600)
        except OSError:
            pass
        temporary.replace(self.backup_path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--also-port", type=int, action="append")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--data-dir", type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    data_dir = args.data_dir or root / ".loomwright-data"
    ports = list(dict.fromkeys([args.port, *(args.also_port or ([8001] if args.port == 8000 else [8000]))]))
    servers = []
    try:
        for port in ports:
            servers.append(LoomwrightServer((args.host, port), root, data_dir))
    except OSError:
        for server in servers:
            server.server_close()
        raise
    threads = [threading.Thread(target=server.serve_forever, daemon=True) for server in servers]
    for thread in threads:
        thread.start()
    print(f"Serving {root} on ports {', '.join(map(str, ports))}.")
    print(f"Shared project data is stored outside source files at {data_dir.resolve()}")
    print("Keep the forwarded Codespace port private; press Ctrl-C to stop.")
    try:
        for thread in threads:
            thread.join()
    except KeyboardInterrupt:
        pass
    finally:
        for server in servers:
            server.server_close()


if __name__ == "__main__":
    main()