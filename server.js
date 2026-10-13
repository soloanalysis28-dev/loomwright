import express from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';

// Load .env file manually (no extra dependency needed)
try {
  const envPath = new URL('.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
} catch (e) {
  // .env file not found, continue with existing env vars
}
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const DATA_DIR = path.join(__dirname, '.loomwright-data');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'projects.json');
const BACKUP_PATH = path.join(DATA_DIR, 'projects.json.bak');
const gitSyncState = { running: false, action: null, step: null, startedAt: null, finishedAt: null, ok: null, output: '', error: '' };

async function runGit(args) {
  return execFileAsync('git', args, { cwd: __dirname, maxBuffer: 2 * 1024 * 1024, timeout: 120000 });
}

async function readGitStatus() {
  const [branchResult, commitResult, logResult, statusResult] = await Promise.all([
    runGit(['branch', '--show-current']),
    runGit(['rev-parse', '--short', 'HEAD']),
    runGit(['log', '-1', '--format=%s']),
    runGit(['-c', 'color.ui=false', 'status', '--short', '--branch']),
  ]);
  const summary = statusResult.stdout.trim();
  return {
    branch: branchResult.stdout.trim() || 'detached',
    commit: commitResult.stdout.trim(),
    message: logResult.stdout.trim(),
    summary,
    dirty: summary.split('\n').slice(1).some(Boolean),
    operation: { ...gitSyncState },
  };
}

function startGitOperation(action, args) {
  if (gitSyncState.running) return false;
  gitSyncState.running = true;
  gitSyncState.action = action;
  gitSyncState.startedAt = new Date().toISOString();
  gitSyncState.finishedAt = null;
  gitSyncState.ok = null;
  gitSyncState.output = '';
  gitSyncState.error = '';
  runGit(args).then(({ stdout = '', stderr = '' }) => {
    gitSyncState.output = `${stdout}${stderr}`.trim();
    gitSyncState.ok = true;
  }).catch(error => {
    gitSyncState.output = `${error.stdout || ''}${error.stderr || ''}`.trim();
    gitSyncState.error = error.message || `Git ${action} failed.`;
    gitSyncState.ok = false;
  }).finally(() => {
    gitSyncState.running = false;
    gitSyncState.finishedAt = new Date().toISOString();
  });
  return true;
}

function startGitUpdate() {
  if (gitSyncState.running) return false;
  gitSyncState.running = true;
  gitSyncState.action = 'update';
  gitSyncState.step = 'pull';
  gitSyncState.startedAt = new Date().toISOString();
  gitSyncState.finishedAt = null;
  gitSyncState.ok = null;
  gitSyncState.output = '';
  gitSyncState.error = '';
  (async () => {
    const pull = await runGit(['pull', '--ff-only', 'origin', 'main']);
    gitSyncState.output = `${pull.stdout || ''}${pull.stderr || ''}`.trim();
    gitSyncState.step = 'push';
    const push = await runGit(['push', 'origin', 'main']);
    gitSyncState.output = `${gitSyncState.output}\n${push.stdout || ''}${push.stderr || ''}`.trim();
    gitSyncState.ok = true;
  })().catch(error => {
    gitSyncState.output = `${gitSyncState.output}\n${error.stdout || ''}${error.stderr || ''}`.trim();
    gitSyncState.error = error.message || 'Git update failed.';
    gitSyncState.ok = false;
  }).finally(() => {
    gitSyncState.running = false;
    gitSyncState.step = null;
    gitSyncState.finishedAt = new Date().toISOString();
  });
  return true;
}

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

app.get('/api/app-status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
    res.json({ name: packageInfo.name || 'loomwright', version: packageInfo.version || 'unknown' });
  } catch (error) {
    res.status(500).json({ error: 'Could not read the installed app version.' });
  }
});

app.get('/api/git/status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    res.json(await readGitStatus());
  } catch (error) {
    res.status(500).json({ error: error.message || 'Git status is unavailable.', operation: { ...gitSyncState } });
  }
});

app.post('/api/git/sync', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (gitSyncState.running) return res.status(409).json({ error: 'An update is already running.', operation: { ...gitSyncState } });
  try {
    const status = await readGitStatus();
    if (status.branch !== 'main') return res.status(409).json({ error: `Update is limited to the main branch (currently ${status.branch}).`, ...status });
    if (status.dirty) return res.status(409).json({ error: 'Update blocked: local changes must be committed or stashed before updating.', ...status });
    startGitUpdate();
    res.status(202).json({ accepted: true, operation: { ...gitSyncState } });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not start the Git update.' });
  }
});

app.post('/api/git/pull', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (gitSyncState.running) return res.status(409).json({ error: 'A Git operation is already running.', operation: { ...gitSyncState } });
  try {
    const status = await readGitStatus();
    if (status.branch !== 'main') return res.status(409).json({ error: `Pull is limited to the main branch (currently ${status.branch}).`, ...status });
    if (status.dirty) return res.status(409).json({ error: 'Pull blocked because there are uncommitted local changes. Commit or stash them first.', ...status });
    startGitOperation('pull', ['pull', '--ff-only', 'origin', 'main']);
    res.status(202).json({ accepted: true, operation: { ...gitSyncState } });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not start Git pull.' });
  }
});

app.post('/api/git/push', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (gitSyncState.running) return res.status(409).json({ error: 'A Git operation is already running.', operation: { ...gitSyncState } });
  try {
    const status = await readGitStatus();
    if (status.branch !== 'main') return res.status(409).json({ error: `Push is limited to the main branch (currently ${status.branch}).`, ...status });
    startGitOperation('push', ['push', 'origin', 'main']);
    res.status(202).json({ accepted: true, operation: { ...gitSyncState } });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not start Git push.' });
  }
});

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
      if (filePath.endsWith('sw.js') || filePath.endsWith('offline-assets.json')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      } else if (
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
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Loomwright server listening on http://${HOST}:${PORT}`);
});
