# Loomwright

Loomwright is an offline-capable writing desk. Browser-local project data is retained as a recovery copy; the local development server synchronizes projects between the VS Code browser and an external browser through one private Codespace store.

## Run locally

From the repository root, start the shared server:

```sh
python3 tools/serve-local.py
```

The server serves the same app and shared project database at `http://127.0.0.1:8000` and `http://127.0.0.1:8001`. Use either address in both browser sessions. Project data is saved under the git-ignored `.loomwright-data` directory and is not uploaded to a third-party cloud. Keep a Codespace forwarded port private. The server must be running for cross-browser sync; local browser saves remain available when it is offline.

In Windows PowerShell, run `tools/serve-local.ps1` instead. Python 3 is required for both launchers.

See [OFFLINE_SECURITY.md](OFFLINE_SECURITY.md) for storage and offline details.
