# Loomwright

Loomwright is an offline-capable writing desk. Browser-local project data is retained as a recovery copy; the local development server synchronizes projects between the VS Code browser and an external browser through one private Codespace store.

## Run locally

From the repository root, start the shared server:

```sh
npm run dev
```

The server serves the app and shared project database at `http://localhost:3000`. Project data is saved under the git-ignored `.loomwright-data` directory and is not uploaded to a third-party cloud. The server must be running for cross-browser sync; local browser saves remain available when it is offline.

See [OFFLINE_SECURITY.md](OFFLINE_SECURITY.md) for storage and offline details.
