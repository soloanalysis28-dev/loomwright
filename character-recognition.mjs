export const CHARACTER_RECOGNITION_CONFIG = Object.freeze({
  maxNameTokens: 4,
  threshold: 5.2,
  highConfidenceThreshold: 8.4,
  weights: Object.freeze({
    capRatio: 4.5,
    speechVerbRate: 2.6,
    subjectOfActionVerbRate: 2.2,
    dialogueAdjacency: 1.6,
    pronounFollowRate: 1.5,
    precededByTheRate: -2.4,
    locationPrepositionRate: -3.1,
    objectOrPlaceSuffix: -4.3,
  }),
  titleWords: new Set([
    'captain', 'colonel', 'commander', 'count', 'countess', 'doctor', 'dr',
    'duke', 'duchess', 'father', 'general', 'judge', 'king', 'lady', 'lord',
    'madam', 'major', 'master', 'miss', 'mr', 'mrs', 'ms', 'prince',
    'princess', 'professor', 'queen', 'reverend', ' sergeant', 'sir', 'sister',
  ].map(value => value.trim())),
  speechVerbs: new Set([
    'answered', 'asked', 'called', 'cried', 'exclaimed', 'murmured', 'muttered',
    'replied', 'responded', 'said', 'shouted', 'sighed', 'whispered', 'yelled',
  ]),
  actionVerbs: new Set([
    'agreed', 'arrived', 'asked', 'began', 'brought', 'came', 'carried', 'caught',
    'climbed', 'closed', 'continued', 'crossed', 'decided', 'entered', 'fell',
    'felt', 'found', 'grabbed', 'held', 'knew', 'left', 'looked', 'made', 'moved',
    'opened', 'reached', 'ran', 'realized', 'remembered', 'returned', 'saw',
    'seemed', 'stood', 'turned', 'walked', 'wanted', 'watched', 'went', 'wondered',
  ]),
  pronouns: new Set(['he', 'her', 'hers', 'him', 'his', 'she', 'their', 'them', 'they']),
  locationPrepositions: new Set(['at', 'from', 'in', 'near', 'to']),
  placeSuffixes: new Set([
    'academy', 'bay', 'bridge', 'castle', 'cathedral', 'cave', 'city', 'church',
    'coast', 'forest', 'fort', 'fortress', 'gate', 'harbor', 'harbour', 'hill',
    'island', 'keep', 'kingdom', 'lake', 'market', 'mountain', 'mountains',
    'palace', 'park', 'port', 'road', 'river', 'sea', 'shore', 'square', 'street',
    'temple', 'tower', 'town', 'valley', 'village', 'woods',
  ]),
});

const WORD_PATTERN = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)?/gu;
const QUOTE_PATTERN = /["“”]/g;
const SENTENCE_BOUNDARY_PATTERN = /[.!?…\n\r]/;
const POSSESSIVE_SUFFIX_PATTERN = /(?:['’]s|s['’])$/iu;

function normalizeToken(value) {
  return value.replace(POSSESSIVE_SUFFIX_PATTERN, '').replace(/^['’]|['’]$/gu, '');
}

function tokenize(text) {
  const tokens = [];
  let lastEnd = 0;
  for (const match of text.matchAll(WORD_PATTERN)) {
    const value = match[0], start = match.index, end = start + value.length;
    const word = normalizeToken(value);
    const lower = word.toLocaleLowerCase();
    const upper = word.toLocaleUpperCase();
    tokens.push({
      value: word,
      lower,
      start,
      end,
      capitalized: /^\p{Lu}/u.test(word) && word !== upper,
      sentenceInitial: tokens.length === 0 || SENTENCE_BOUNDARY_PATTERN.test(text.slice(lastEnd, start)),
    });
    lastEnd = end;
  }
  return tokens;
}

function isJoined(text, previous, current, config) {
  const gap = text.slice(previous.end, current.start);
  if (/^\s+$/u.test(gap)) return !current.sentenceInitial;
  return /^\.\s+$/u.test(gap) && config.titleWords.has(previous.lower);
}

function getCandidateLabel(tokens) {
  return tokens.map(token => token.value).join(' ');
}

function candidateKey(tokens) {
  return tokens.map(token => token.lower).join(' ');
}

function createCandidate(tokens) {
  return {
    key: candidateKey(tokens),
    name: getCandidateLabel(tokens),
    parts: tokens.map(token => token.lower),
    count: 0,
    capitalizedMidSentence: 0,
    capitalizedSentenceInitial: 0,
    lowercaseOccurrences: 0,
    sectionTitles: new Set(),
    contextHits: {
      speechVerbRate: 0,
      subjectOfActionVerbRate: 0,
      dialogueAdjacency: 0,
      pronounFollowRate: 0,
      precededByTheRate: 0,
      locationPrepositionRate: 0,
    },
  };
}

export function extractCharacterCandidates(chapters, config = CHARACTER_RECOGNITION_CONFIG) {
  const normalizedChapters = chapters.map(chapter => ({
    id: chapter.id,
    title: chapter.title || 'Untitled',
    text: String(chapter.text || ''),
    tokens: tokenize(String(chapter.text || '')),
  }));
  const candidates = new Map();

  for (const chapter of normalizedChapters) {
    const { text, tokens } = chapter;
    for (let start = 0; start < tokens.length; start++) {
      const first = tokens[start];
      if (!first.capitalized) continue;

      if (!config.titleWords.has(first.lower)) {
        const single = createCandidate([first]);
        if (!candidates.has(single.key)) candidates.set(single.key, single);
      }

      const run = [first];
      for (let end = start + 1; end < tokens.length && run.length < config.maxNameTokens; end++) {
        const next = tokens[end];
        if (!next.capitalized || !isJoined(text, tokens[end - 1], next, config)) break;
        run.push(next);
        const candidate = createCandidate(run);
        if (!config.titleWords.has(first.lower) || run.length > 1) {
          if (!candidates.has(candidate.key)) candidates.set(candidate.key, candidate);
        }
      }
    }
  }

  const sortedCandidates = [...candidates.values()].sort((first, second) => first.parts.length - second.parts.length);
  for (const chapter of normalizedChapters) {
    const { text, tokens } = chapter;
    const quoteOffsets = [...text.matchAll(QUOTE_PATTERN)].map(match => match.index);
    for (let start = 0; start < tokens.length; start++) {
      for (let length = 1; length <= config.maxNameTokens && start + length <= tokens.length; length++) {
        const candidate = candidates.get(tokens.slice(start, start + length).map(token => token.lower).join(' '));
        if (!candidate) continue;
        const span = tokens.slice(start, start + length);
        const capitalized = span.every(token => token.capitalized);
        if (!capitalized) {
          candidate.lowercaseOccurrences++;
          continue;
        }

        candidate.count++;
        candidate.sectionTitles.add(chapter.title);
        if (span[0].sentenceInitial) candidate.capitalizedSentenceInitial++;
        else candidate.capitalizedMidSentence++;

        const previous = tokens[start - 1]?.lower || '';
        const after = tokens.slice(start + length, start + length + 6);
        const nearby = tokens.slice(Math.max(0, start - 3), start)
          .concat(tokens.slice(start + length, start + length + 3));
        if (nearby.some(token => config.speechVerbs.has(token.lower))) candidate.contextHits.speechVerbRate++;
        if (tokens.slice(start + length, start + length + 3).some(token => config.actionVerbs.has(token.lower))) candidate.contextHits.subjectOfActionVerbRate++;
        if (after.some(token => config.pronouns.has(token.lower))) candidate.contextHits.pronounFollowRate++;
        if (previous === 'the') candidate.contextHits.precededByTheRate++;
        if (config.locationPrepositions.has(previous)) candidate.contextHits.locationPrepositionRate++;

        const nearbyQuotes = quoteOffsets.some(offset => {
          const distance = offset < span[0].start ? span[0].start - offset : offset - span.at(-1).end;
          return distance >= 0 && distance <= 48;
        });
        if (nearbyQuotes) candidate.contextHits.dialogueAdjacency++;
      }
    }
  }

  return sortedCandidates.filter(candidate => candidate.count > 0);
}

export function scoreCharacterCandidate(candidate, config = CHARACTER_RECOGNITION_CONFIG) {
  const allOccurrences = candidate.capitalizedMidSentence + candidate.capitalizedSentenceInitial + candidate.lowercaseOccurrences;
  const capRatio = allOccurrences ? candidate.capitalizedMidSentence / allOccurrences : 0;
  const mentions = Math.max(1, candidate.count);
  const features = {
    capRatio,
    speechVerbRate: candidate.contextHits.speechVerbRate / mentions,
    subjectOfActionVerbRate: candidate.contextHits.subjectOfActionVerbRate / mentions,
    dialogueAdjacency: candidate.contextHits.dialogueAdjacency / mentions,
    pronounFollowRate: candidate.contextHits.pronounFollowRate / mentions,
    precededByTheRate: candidate.contextHits.precededByTheRate / mentions,
    locationPrepositionRate: candidate.contextHits.locationPrepositionRate / mentions,
    objectOrPlaceSuffix: config.placeSuffixes.has(candidate.parts.at(-1)) ? 1 : 0,
  };
  const score = Object.entries(config.weights).reduce((total, [feature, weight]) => total + features[feature] * weight, 0);
  const confidence = score >= config.highConfidenceThreshold ? 'high' : score >= config.threshold ? 'medium' : 'low';
  const reasons = [];
  if (features.capRatio > 0) reasons.push(`mid-sentence capitals ${candidate.capitalizedMidSentence}/${allOccurrences}`);
  if (candidate.contextHits.speechVerbRate) reasons.push(`speech verbs x${candidate.contextHits.speechVerbRate}`);
  if (candidate.contextHits.subjectOfActionVerbRate) reasons.push(`action verbs x${candidate.contextHits.subjectOfActionVerbRate}`);
  if (candidate.contextHits.dialogueAdjacency) reasons.push(`dialogue x${candidate.contextHits.dialogueAdjacency}`);
  if (candidate.contextHits.pronounFollowRate) reasons.push(`pronouns follow x${candidate.contextHits.pronounFollowRate}`);
  if (candidate.contextHits.precededByTheRate) reasons.push(`preceded by “the” x${candidate.contextHits.precededByTheRate}`);
  if (candidate.contextHits.locationPrepositionRate) reasons.push(`location prepositions x${candidate.contextHits.locationPrepositionRate}`);
  if (features.objectOrPlaceSuffix) reasons.push(`place suffix “${candidate.parts.at(-1)}”`);
  return {...candidate, features, capRatio, score, confidence, reasons};
}

export function recognizeCharacters(chapters, config = CHARACTER_RECOGNITION_CONFIG) {
  return extractCharacterCandidates(chapters, config)
    .map(candidate => scoreCharacterCandidate(candidate, config))
    .sort((first, second) => second.score - first.score || second.count - first.count || first.name.localeCompare(second.name));
}