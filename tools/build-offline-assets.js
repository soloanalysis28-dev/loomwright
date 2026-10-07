import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const ALLOWED_ASSET_SUFFIXES = new Set(['.js', '.mjs', '.css', '.woff2', '.bcmap', '.ttf', '.pfb']);

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (dirent.isFile() && ALLOWED_ASSET_SUFFIXES.has(path.extname(dirent.name).toLowerCase())) {
      results.push('./' + path.relative(ROOT, fullPath).replace(/\\/g, '/'));
    }
  }
  return results;
}

const assets = new Set([
  './',
  './index.html',
  './app.js',
  './writing-settings.mjs',
  './smart-typography.mjs',
  './character-recognition.mjs',
  './fonts.css',
  './manifest.webmanifest',
  './app-icon.svg',
  './app-icon-192.png',
  './app-icon-512.png',
  './sw.js',
  './theme-bootstrap.js',
  './offline-assets.json',
]);

['fonts', 'vendor'].forEach(dir => {
  const dirPath = path.join(ROOT, dir);
  if (fs.existsSync(dirPath)) {
    walk(dirPath).forEach(asset => assets.add(asset));
  }
});

const sortedAssets = Array.from(assets).sort();
const destination = path.join(ROOT, 'offline-assets.json');
fs.writeFileSync(destination, JSON.stringify(sortedAssets, null, 2) + '\n', 'utf-8');
console.log(`Wrote ${sortedAssets.length} same-origin runtime assets to ${path.basename(destination)}`);
