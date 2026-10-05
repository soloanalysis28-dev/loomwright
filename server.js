import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

const DATA_DIR = path.join(__dirname, '.loomwright-data');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'projects.json');
const BACKUP_PATH = path.join(DATA_DIR, 'projects.json.bak');

try {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
} catch (err) {
  console.warn('Could not create data dir:', err.message);
}

// In-memory state with file persistence
let sharedState = { revision: 0, record: null };
try {
  if (fs.existsSync(SNAPSHOT_PATH)) {
    const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
    const data = JSON.parse(raw);
    if (typeof data.revision === 'number') {
      sharedState = data;
    }
  }
} catch (err) {
  console.warn('Could not read saved projects snapshot:', err.message);
}

app.use(express.json({ limit: '64mb' }));

// Shared project store API
app.get('/api/sync', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.json({
    revision: sharedState.revision,
    record: sharedState.record,
  });
});

app.put('/api/sync', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const { expectedRevision, record } = req.body || {};
  if (typeof expectedRevision !== 'number' || expectedRevision < 0) {
    return res.status(400).json({ error: 'Invalid revision.' });
  }
  if (!record || typeof record !== 'object' || !Array.isArray(record.projects)) {
    return res.status(400).json({ error: 'Invalid project record.' });
  }
  if (record.projects.length > 500) {
    return res.status(400).json({ error: 'Too many projects.' });
  }

  if (expectedRevision !== sharedState.revision) {
    return res.status(409).json({
      revision: sharedState.revision,
      record: sharedState.record,
    });
  }

  if (sharedState.record !== null) {
    try {
      fs.writeFileSync(BACKUP_PATH, JSON.stringify(sharedState, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Backup write failed:', err.message);
    }
  }

  sharedState = {
    revision: sharedState.revision + 1,
    record,
  };

  try {
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(sharedState, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Snapshot write failed:', err.message);
  }

  res.json(sharedState);
});

// Protect private files from static file serving
const BLOCKED_PATHS = new Set([
  '/.loomwright-data',
  '/package.json',
  '/package-lock.json',
  '/server.js',
  '/metadata.json',
  '/.env',
  '/.env.example',
  '/.git',
]);

app.use((req, res, next) => {
  const normPath = path.normalize(req.path);
  if (
    BLOCKED_PATHS.has(normPath) ||
    normPath.startsWith('/.loomwright-data/') ||
    normPath.startsWith('/.git/')
  ) {
    return res.status(404).send('Not found');
  }
  next();
});

// Serve static assets
app.use(
  express.static(__dirname, {
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (filePath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (filePath.endsWith('.webmanifest')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      } else if (filePath.endsWith('.bcmap') || filePath.endsWith('.pfb')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      if (
        filePath.endsWith('.html') ||
        filePath.endsWith('.js') ||
        filePath.endsWith('.json')
      ) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// Fallback for HTML5 navigation
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Loomwright server listening on http://${HOST}:${PORT}`);
});
