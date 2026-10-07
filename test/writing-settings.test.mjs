import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WRITING_DEFAULTS,
  BUNDLED_FONTS,
  normalizeWritingSettings,
} from '../writing-settings.mjs';

test('WRITING_DEFAULTS contains all expected writing settings with correct initial values', () => {
  assert.equal(WRITING_DEFAULTS.pageStyle, 'paper');
  assert.equal(WRITING_DEFAULTS.fontFamily, 'Lora');
  assert.equal(WRITING_DEFAULTS.fontSize, 18);
  assert.equal(WRITING_DEFAULTS.lineHeight, 1.7);
  assert.equal(WRITING_DEFAULTS.columnWidth, 'medium');
  assert.equal(WRITING_DEFAULTS.firstLineIndent, false);
  assert.equal(WRITING_DEFAULTS.toolbarMode, 'auto');
  assert.deepEqual(WRITING_DEFAULTS.focusHides, { nav: true, toolbar: true, footer: false });
  assert.equal(WRITING_DEFAULTS.typewriterScroll, false);
  assert.equal(WRITING_DEFAULTS.spellcheck, true);
  assert.equal(WRITING_DEFAULTS.smartQuotes, true);
  assert.equal(WRITING_DEFAULTS.autosave, true);
  assert.equal(WRITING_DEFAULTS.autosaveDelayMs, 1500);
  assert.equal(WRITING_DEFAULTS.dailyGoal, 500);
  assert.equal(WRITING_DEFAULTS.dashSeparatesWords, true);
  assert.equal(WRITING_DEFAULTS.recogniserSensitivity, 'balanced');
});

test('normalizeWritingSettings returns full defaults when input is empty or invalid', () => {
  assert.deepEqual(normalizeWritingSettings(null), WRITING_DEFAULTS);
  assert.deepEqual(normalizeWritingSettings(undefined), WRITING_DEFAULTS);
  assert.deepEqual(normalizeWritingSettings({}), WRITING_DEFAULTS);
  assert.deepEqual(normalizeWritingSettings('not an object'), WRITING_DEFAULTS);
});

test('normalizeWritingSettings preserves valid values and deep-merges focusHides', () => {
  const custom = {
    pageStyle: 'flat',
    fontFamily: 'EB Garamond',
    fontSize: 22,
    lineHeight: 1.9,
    columnWidth: 'wide',
    firstLineIndent: true,
    toolbarMode: 'pinned',
    focusHides: {
      nav: false,
      footer: true,
    },
    typewriterScroll: true,
    spellcheck: false,
    smartQuotes: false,
    autosave: false,
    autosaveDelayMs: 4000,
    dailyGoal: 1200,
    dashSeparatesWords: false,
    recogniserSensitivity: 'strict',
  };

  const normalized = normalizeWritingSettings(custom);
  assert.equal(normalized.pageStyle, 'flat');
  assert.equal(normalized.fontFamily, 'EB Garamond');
  assert.equal(normalized.fontSize, 22);
  assert.equal(normalized.lineHeight, 1.9);
  assert.equal(normalized.columnWidth, 'wide');
  assert.equal(normalized.firstLineIndent, true);
  assert.equal(normalized.toolbarMode, 'pinned');
  assert.deepEqual(normalized.focusHides, { nav: false, toolbar: true, footer: true });
  assert.equal(normalized.typewriterScroll, true);
  assert.equal(normalized.spellcheck, false);
  assert.equal(normalized.smartQuotes, false);
  assert.equal(normalized.autosave, false);
  assert.equal(normalized.autosaveDelayMs, 4000);
  assert.equal(normalized.dailyGoal, 1200);
  assert.equal(normalized.dashSeparatesWords, false);
  assert.equal(normalized.recogniserSensitivity, 'strict');
});

test('normalizeWritingSettings clamps numeric ranges and ignores unknown fonts/enums', () => {
  const bad = {
    pageStyle: 'neon-cyberpunk',
    fontFamily: 'Comic Sans MS',
    fontSize: 999, // clamp to 28
    lineHeight: 0.2, // clamp to 1.3
    columnWidth: 'infinite',
    toolbarMode: 'floating',
    autosaveDelayMs: 120, // clamp to 500
    dailyGoal: 50000, // clamp to 20000
    recogniserSensitivity: 'hyper',
  };

  const normalized = normalizeWritingSettings(bad);
  assert.equal(normalized.pageStyle, 'paper');
  assert.equal(normalized.fontFamily, 'Lora');
  assert.equal(normalized.fontSize, 28);
  assert.equal(normalized.lineHeight, 1.3);
  assert.equal(normalized.columnWidth, 'medium');
  assert.equal(normalized.toolbarMode, 'auto');
  assert.equal(normalized.autosaveDelayMs, 500);
  assert.equal(normalized.dailyGoal, 20000);
  assert.equal(normalized.recogniserSensitivity, 'balanced');
});

test('BUNDLED_FONTS contains all 8 offline-bundled fonts', () => {
  assert.equal(BUNDLED_FONTS.length, 8);
  assert.ok(BUNDLED_FONTS.includes('Bitter'));
  assert.ok(BUNDLED_FONTS.includes('Crimson Text'));
  assert.ok(BUNDLED_FONTS.includes('EB Garamond'));
  assert.ok(BUNDLED_FONTS.includes('Libre Baskerville'));
  assert.ok(BUNDLED_FONTS.includes('Lora'));
  assert.ok(BUNDLED_FONTS.includes('Merriweather'));
  assert.ok(BUNDLED_FONTS.includes('PT Serif'));
  assert.ok(BUNDLED_FONTS.includes('Playfair Display'));
});
