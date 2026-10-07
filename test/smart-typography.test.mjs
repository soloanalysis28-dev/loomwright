import test from 'node:test';
import assert from 'node:assert/strict';
import { smartenInput, smartenText } from '../smart-typography.mjs';

test('opening and closing double quotes', () => {
  // Opening quotes at start of text or after whitespace
  assert.equal(smartenInput('', '"'), '“');
  assert.equal(smartenInput(' ', '"'), '“');
  assert.equal(smartenInput('\n', '"'), '“');
  assert.equal(smartenInput('\t', '"'), '“');

  // Closing quotes after word characters and sentence punctuation
  assert.equal(smartenInput('word', '"'), '”');
  assert.equal(smartenInput('.', '"'), '”');
  assert.equal(smartenInput('!', '"'), '”');
  assert.equal(smartenInput('?', '"'), '”');
  assert.equal(smartenInput(',', '"'), '”');
  assert.equal(smartenInput(')', '"'), '”');
});

test('apostrophes inside words and single quotes', () => {
  // Inside words: apostrophes (U+2019)
  assert.equal(smartenInput('n', "'"), '’'); // don't
  assert.equal(smartenInput('t', "'"), '’');
  assert.equal(smartenInput('s', "'"), '’'); // cat's
  assert.equal(smartenInput('re', "'"), '’'); // they're
  assert.equal(smartenInput('2024', "'"), '’'); // '90s

  // Opening single quotes at start of text or after whitespace
  assert.equal(smartenInput('', "'"), '‘');
  assert.equal(smartenInput(' ', "'"), '‘');

  // Closing single quotes after punctuation
  assert.equal(smartenInput('.', "'"), '’');
  assert.equal(smartenInput('!', "'"), '’');
});

test('quotes after em dashes, en dashes, and brackets', () => {
  // Double quotes after em dash and brackets
  assert.equal(smartenInput('—', '"'), '“');
  assert.equal(smartenInput('–', '"'), '“');
  assert.equal(smartenInput('(', '"'), '“');
  assert.equal(smartenInput('[', '"'), '“');
  assert.equal(smartenInput('{', '"'), '“');
  assert.equal(smartenInput('<', '"'), '“');

  // Single quotes after em dash and brackets
  assert.equal(smartenInput('—', "'"), '‘');
  assert.equal(smartenInput('–', "'"), '‘');
  assert.equal(smartenInput('(', "'"), '‘');
  assert.equal(smartenInput('[', "'"), '‘');
});

test('nested quotes context', () => {
  // Single quote inside double quotes: “' -> “‘
  assert.equal(smartenInput('“', "'"), '‘');
  assert.equal(smartenInput('“', '"'), '”');

  // Double quote inside single quotes: ‘" -> ‘“
  assert.equal(smartenInput('‘', '"'), '“');

  // Closing nested quotes
  assert.equal(smartenInput('end’', '"'), '”');
  assert.equal(smartenInput('end”', "'"), '’');
});

test('double hyphen replaces with em dash', () => {
  assert.equal(smartenInput('-', '-'), '—');
  assert.equal(smartenInput('word-', '-'), '—');
  assert.equal(smartenInput(' ', '-'), '-');
  assert.equal(smartenInput('a', '-'), '-');
});

test('triple dot replaces with ellipsis', () => {
  assert.equal(smartenInput('..', '.'), '…');
  assert.equal(smartenInput('sentence..', '.'), '…');
  assert.equal(smartenInput('.', '.'), '.');
  assert.equal(smartenInput('a', '.'), '.');
});

test('smartenText converts full sentences accurately', () => {
  const input = '"Hello," she said--\'are you sure...\'';
  const expected = '“Hello,” she said—‘are you sure…’';
  assert.equal(smartenText(input), expected);
});
