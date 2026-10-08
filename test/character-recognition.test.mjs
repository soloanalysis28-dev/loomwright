import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SENSITIVITY_THRESHOLDS,
  getCharacterRecognitionConfig,
  recognizeCharacters,
} from '../character-recognition.mjs';

test('SENSITIVITY_THRESHOLDS defines strict, balanced, and loose thresholds', () => {
  assert.ok(SENSITIVITY_THRESHOLDS.strict.threshold > SENSITIVITY_THRESHOLDS.balanced.threshold);
  assert.ok(SENSITIVITY_THRESHOLDS.balanced.threshold > SENSITIVITY_THRESHOLDS.loose.threshold);
});

test('getCharacterRecognitionConfig returns expected thresholds for each sensitivity', () => {
  const strictConfig = getCharacterRecognitionConfig('strict');
  assert.equal(strictConfig.threshold, 6.8);
  assert.equal(strictConfig.highConfidenceThreshold, 9.6);

  const balancedConfig = getCharacterRecognitionConfig('balanced');
  assert.equal(balancedConfig.threshold, 5.2);
  assert.equal(balancedConfig.highConfidenceThreshold, 8.4);

  const looseConfig = getCharacterRecognitionConfig('loose');
  assert.equal(looseConfig.threshold, 3.6);
  assert.equal(looseConfig.highConfidenceThreshold, 6.8);
});

test('recognizeCharacters runs cleanly with sensitivity string', () => {
  const sampleChapters = [
    {
      id: 1,
      title: 'Chapter 1',
      text: 'Rowan stood by the window. "We must depart," Rowan whispered. Lady Cheryl arrived at the castle gate, where Rowan greeted her warmly.',
    },
  ];

  const results = recognizeCharacters(sampleChapters, 'balanced');
  assert.ok(Array.isArray(results));
  assert.ok(results.some(c => c.name === 'Rowan'));
});

test('recognizeCharacters excludes pronouns and question words as single-name candidates', () => {
  const chapters = [{
    id: 1,
    title: 'Chapter 1',
    text: 'He looked up. It was late. Who was there? He asked again. It moved. Who answered?',
  }];
  const names = recognizeCharacters(chapters, 'loose').map(candidate => candidate.name.toLowerCase());
  assert.equal(names.includes('he'), false);
  assert.equal(names.includes('it'), false);
  assert.equal(names.includes('who'), false);
});

test('recognizeCharacters keeps a recurring character connected across chapters', () => {
  const chapters = [
    { id: 1, title: 'Chapter 1', text: 'Mara entered the room. "Stay here," Mara whispered.' },
    { id: 2, title: 'Chapter 2', text: 'Mara crossed the bridge. Later, Mara returned and Mara waited.' },
  ];
  const mara = recognizeCharacters(chapters, 'balanced').find(candidate => candidate.name === 'Mara');
  assert.ok(mara);
  assert.deepEqual([...mara.sectionTitles], ['Chapter 1', 'Chapter 2']);
});
