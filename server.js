import express from 'express';
import path from 'path';
import fs from 'fs';
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
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aiClient = null;
function getAIClient() {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
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

app.get('/api/app-status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
    res.json({ name: packageInfo.name || 'loomwright', version: packageInfo.version || 'unknown' });
  } catch (error) {
    res.status(500).json({ error: 'Could not read the installed app version.' });
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

// AI Features Powered by Gemini
app.post('/api/ai/scan-entities', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    const { sections = [] } = req.body || {};
    if (!sections.length) {
      return res.status(400).json({ error: 'No manuscript sections provided to scan.' });
    }
    const ai = getAIClient();
    const manuscriptText = sections
      .map((s, idx) => `=== Chapter ${idx + 1}: ${s.title || 'Untitled'} ===\n${s.text || ''}`)
      .join('\n\n')
      .slice(0, 48000);

    const prompt = `You are an expert literary narrative theorist and developmental editor.
Analyze the following manuscript excerpt and extract true story entities.
Filter out false positives: do NOT treat days of the week, general titles ("Doctor", "Father", "Captain" without proper names), common words at sentence starts, or non-character entities as character names.
Categorize the entities precisely:
1. characters: Distinct named characters. Provide their narrative role (e.g. "Protagonist", "Antagonist", "Supporting", "Minor"), a vivid description of their identity/traits, and the chapters they appear in.
2. places: Distinct settings, cities, rooms, or landmarks that anchor the story world.
3. events: Key dramatic scenes, incidents, turning points, or milestones mentioned or depicted.
4. objects: Important symbolic, physical, or plot-relevant items (e.g. letters, weapons, keepsakes).
5. threads: Central ongoing mysteries, romantic tensions, investigations, or dramatic conflicts.

Manuscript:
${manuscriptText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  description: { type: Type.STRING },
                  traits: { type: Type.ARRAY, items: { type: Type.STRING } },
                  appearsIn: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['name', 'role', 'description'],
              },
            },
            places: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  significance: { type: Type.STRING },
                },
                required: ['name', 'description'],
              },
            },
            events: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  chapter: { type: Type.STRING },
                },
                required: ['name', 'description'],
              },
            },
            objects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['name', 'description'],
              },
            },
            threads: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['name', 'description'],
              },
            },
          },
          required: ['characters', 'places', 'events', 'objects', 'threads'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err) {
    console.error('Scan entities error:', err);
    res.status(500).json({ error: err.message || 'Failed to scan manuscript entities.' });
  }
});

app.post('/api/ai/write-assist', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    const { action = 'continue', text = '', chapterTitle = '', instruction = '', characters = [] } = req.body || {};
    if (!text && !instruction) {
      return res.status(400).json({ error: 'Text or instruction is required.' });
    }
    const ai = getAIClient();

    let taskPrompt = '';
    if (action === 'continue') {
      taskPrompt = `Continue this story seamlessly from the ending point. Match the author's voice, pacing, prose rhythm, and sensory perspective. Write 2 to 3 organic, beautifully crafted paragraphs that propel the scene forward naturally.`;
    } else if (action === 'sensory') {
      taskPrompt = `Enrich this passage with vivid sensory texture, atmospheric weight, and environmental presence (ambient sound, subtle scents, tactile sensation, light and shadow). Deepen the reader's immersion while honoring the author's prose cadence without over-decorating.`;
    } else if (action === 'polish') {
      taskPrompt = `Act as an elite literary line editor. Polish and elevate this passage: sharpen sentence cadences, remove clunky passive constructions, eliminate redundant phrasing, heighten imagery, and refine character voice while preserving the author's distinct style.`;
    } else if (action === 'dialogue') {
      taskPrompt = `Enhance or extend the dialogue in this scene. Provide authentic back-and-forth speech between the characters with sharp subtext, natural pauses, body language beats, and realistic tension.`;
    } else {
      taskPrompt = instruction || `Improve and develop this writing according to literary standards.`;
    }

    const charContext = characters.length ? `Known characters in story: ${characters.join(', ')}.` : '';
    const systemPrompt = `You are a master literary fiction editor and co-writer at Loomwright, dedicated to authentic authorial craft. Never produce generic AI tropes, hollow melodrama, or synthetic clichés. Write in rich, immersive, publication-ready prose that honors the author's vision.`;

    const prompt = `${taskPrompt}\n\nChapter context: "${chapterTitle || 'Manuscript Draft'}"\n${charContext}\n\nCurrent Text:\n"""\n${text}\n"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            result: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ['result'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err) {
    console.error('Write assist error:', err);
    res.status(500).json({ error: err.message || 'AI writing assistance failed.' });
  }
});

app.post('/api/ai/story-web-enhance', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    const { nodes = [], links = [], sections = [], characters = [] } = req.body || {};
    const ai = getAIClient();

    const sectionsSummary = sections
      .map((s, idx) => `Chapter ${idx + 1}: ${s.title} (${(s.text || '').slice(0, 1500)})`)
      .join('\n\n')
      .slice(0, 24000);

    const prompt = `You are a master story architect analyzing a book's Story Web graph.
Existing nodes on the map:
${nodes.map(n => `- [${n.type}] ${n.label} (id: ${n.id})`).join('\n')}

Existing links:
${links.map(l => `- ${l.from} -> ${l.to}`).join('\n')}

Manuscript chapters:
${sectionsSummary}

Characters in story:
${characters.map(c => `- ${c.name} (${c.role || 'Character'})`).join('\n')}

Task:
Suggest 3 to 6 NEW critical story nodes (type: "place", "event", "object", or "thread") and 4 to 8 meaningful connection links between new or existing nodes that capture the dramatic web of the narrative.
Ensure every link has a clear narrative relationship label (e.g. "Visits", "Investigates", "Conceals", "Takes place at", "Tangled in", "Betrayed by").
Return valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedNodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "Must be 'place', 'event', 'object', or 'thread'" },
                  label: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['type', 'label'],
              },
            },
            suggestedLinks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  from: { type: Type.STRING, description: "Node label or id" },
                  to: { type: Type.STRING, description: "Node label or id" },
                  relationship: { type: Type.STRING },
                },
                required: ['from', 'to', 'relationship'],
              },
            },
            architectureInsight: { type: Type.STRING, description: "Brief advice on plot web structure" },
          },
          required: ['suggestedNodes', 'suggestedLinks', 'architectureInsight'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err) {
    console.error('Story web enhance error:', err);
    res.status(500).json({ error: err.message || 'Failed to enhance story web.' });
  }
});

app.post('/api/ai/metrics-critique', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  try {
    const { sections = [], stats = {} } = req.body || {};
    const ai = getAIClient();

    const chapterSummaries = sections.map((s, idx) => {
      const plain = (s.text || '').replace(/\s+/g, ' ');
      return `Chapter ${idx + 1} "${s.title}": ${s.wordCount || 0} words. Excerpt: "${plain.slice(0, 1000)}..."`;
    }).join('\n\n').slice(0, 32000);

    const prompt = `You are a senior publishing house manuscript editor conducting an in-depth editorial metrics critique of this manuscript in progress.
Total Sections: ${sections.length}
Total Word Count: ${stats.totalWords || 0}
Estimated Reading Time: ${stats.readTime || 'N/A'}

Manuscript Overview:
${chapterSummaries}

Provide a comprehensive, encouraging, and deeply perceptive editorial review covering:
1. overallAssessment: A clear executive summary of the narrative arc, hook strength, and manuscript momentum.
2. pacingAnalysis: Analysis of chapter length balance, scene propulsion, cliffhangers, and narrative breathing room.
3. characterBalance: Review of character distribution, spotlight balance, dialogue share, and agency.
4. toneAtmosphere: Assessment of mood consistency, sensory richness, and world-building cohesion.
5. recommendations: Exactly 3 to 5 concrete, actionable editorial steps for the author's next revision round.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallAssessment: { type: Type.STRING },
            pacingAnalysis: { type: Type.STRING },
            characterBalance: { type: Type.STRING },
            toneAtmosphere: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['overallAssessment', 'pacingAnalysis', 'characterBalance', 'toneAtmosphere', 'recommendations'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err) {
    console.error('Metrics critique error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate metrics critique.' });
  }
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
