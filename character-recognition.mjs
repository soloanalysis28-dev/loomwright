export const SENSITIVITY_THRESHOLDS = Object.freeze({
  strict: Object.freeze({
    threshold: 6.8,
    highConfidenceThreshold: 9.6,
  }),
  balanced: Object.freeze({
    threshold: 5.2,
    highConfidenceThreshold: 8.4,
  }),
  loose: Object.freeze({
    threshold: 3.6,
    highConfidenceThreshold: 6.8,
  }),
});

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
    precededByTheRate: -2.8,
    locationPrepositionRate: -3.1,
    objectOrPlaceSuffix: -4.5,
  }),
  titleWords: new Set([
    'aunt', 'brother', 'captain', 'coach', 'colonel', 'col', 'commander', 'count', 'countess',
    'cousin', 'deacon', 'detective', 'doctor', 'dr', 'duke', 'duchess', 'elder', 'father',
    'general', 'gen', 'governor', 'gov', 'grandpa', 'grandma', 'grandfather', 'grandmother',
    'inspector', 'judge', 'king', 'lady', 'lord', 'lt', 'madam', 'major', 'master', 'miss',
    'mistress', 'mr', 'mrs', 'ms', 'officer', 'pastor', 'prince', 'princess', 'professor',
    'prof', 'queen', 'reverend', 'rev', 'senator', 'sen', 'sergeant', 'sgt', 'sir', 'sister', 'uncle',
  ]),
  speechVerbs: new Set([
    'answered', 'asked', 'called', 'chuckled', 'cried', 'demanded', 'exclaimed',
    'gasped', 'groaned', 'grunted', 'insisted', 'laughed', 'murmured', 'muttered',
    'nodded', 'paused', 'rebutted', 'replied', 'responded', 'said', 'screamed',
    'shouted', 'sighed', 'snapped', 'stated', 'urged', 'warned', 'whispered', 'yelled',
  ]),
  actionVerbs: new Set([
    'agreed', 'arrived', 'asked', 'began', 'brought', 'came', 'carried', 'caught',
    'clasped', 'climbed', 'closed', 'continued', 'crossed', 'decided', 'entered',
    'fell', 'felt', 'found', 'grabbed', 'held', 'knew', 'left', 'looked', 'lunged',
    'made', 'moved', 'nodded', 'opened', 'paused', 'reached', 'ran', 'realized',
    'remembered', 'returned', 'saw', 'seemed', 'stepped', 'stood', 'struck',
    'turned', 'walked', 'wanted', 'watched', 'went', 'wondered',
  ]),
  pronouns: new Set(['he', 'her', 'hers', 'him', 'his', 'she', 'their', 'them', 'they']),
  locationPrepositions: new Set(['at', 'from', 'in', 'near', 'to', 'into', 'onto', 'towards', 'toward']),
  placeSuffixes: new Set([
    'academy', 'alley', 'avenue', 'bar', 'bay', 'bridge', 'building', 'camp', 'castle',
    'cathedral', 'cave', 'center', 'centre', 'chamber', 'chapel', 'church', 'city', 'cliff',
    'cliffs', 'clinic', 'coast', 'college', 'court', 'desert', 'district', 'drive', 'dungeon',
    'estate', 'field', 'fields', 'forest', 'fort', 'fortress', 'garden', 'gardens', 'gate',
    'hall', 'hallway', 'harbor', 'harbour', 'haven', 'hill', 'hospital', 'house', 'inn',
    'island', 'keep', 'kingdom', 'lab', 'laboratory', 'lake', 'lane', 'library', 'mansion',
    'manor', 'market', 'meadow', 'monastery', 'mountain', 'mountains', 'ocean', 'office',
    'palace', 'park', 'path', 'plaza', 'port', 'prison', 'pub', 'realm', 'river', 'road',
    'room', 'sanctuary', 'school', 'sea', 'shop', 'shore', 'shrine', 'square', 'station',
    'store', 'street', 'tavern', 'temple', 'tower', 'town', 'university', 'valley', 'village',
    'woods',
  ]),
  excludedSingleWords: new Set([
    'a', 'an', 'and', 'all', 'am', 'any', 'are', 'as', 'at', 'be', 'because', 'been',
    'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'both',
    'but', 'by', 'can', 'chapter', 'could', 'did', 'do', 'does', 'down', 'during',
    'each', 'either', 'every', 'few', 'for', 'from', 'he', 'her', 'hers', 'him',
    'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me', 'many',
    'may', 'maybe', 'might', 'more', 'most', 'much', 'must', 'my', 'neither', 'no',
    'nobody', 'none', 'nor', 'not', 'nothing', 'now', 'of', 'off', 'on', 'one',
    'or', 'our', 'ours', 'out', 'over', 'she', 'should', 'since', 'so', 'some',
    'someone', 'something', 'than', 'that', 'the', 'their', 'theirs', 'them',
    'then', 'there', 'these', 'they', 'this', 'those', 'though', 'through', 'to',
    'too', 'under', 'until', 'up', 'us', 'we', 'were', 'what', 'when', 'where',
    'which', 'who', 'whom', 'whose', 'why', 'will', 'with', 'would', 'you',
    'your', 'yours', 'prologue', 'epilogue', 'interlude', 'preface', 'introduction',
    'part', 'act', 'scene', 'book', 'volume', 'section',
    'whoever', 'whomever', 'everyone', 'everybody', 'anyone', 'anybody', 'somebody',
    'everywhere', 'anywhere', 'nowhere', 'somewhere', 'anything', 'everything',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september',
    'october', 'november', 'december',
    'zero', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
    'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
    'eighty', 'ninety', 'hundred', 'thousand', 'million',
    'first', 'second', 'third', 'fourth', 'fifth', 'last', 'next',
    'yes', 'yeah', 'yep', 'nope', 'sure', 'fine', 'okay', 'alright', 'well', 'oh',
    'ah', 'aha', 'ugh', 'hmm', 'huh', 'wow', 'oops', 'alas', 'amen', 'ha', 'haha',
    'hah', 'nah', 'shh', 'um', 'uh', 'whoa', 'yay', 'yuck', 'whew', 'phew', 'whoops',
    'gosh', 'gee', 'dang', 'darn', 'ouch', 'ooh', 'aye', 'nay',
    'hello', 'hi', 'hey', 'goodbye', 'bye', 'sorry', 'please', 'thanks', 'thank',
    'welcome', 'congratulations',
    'alone', 'apparently', 'certainly', 'definitely', 'finally', 'eventually',
    'suddenly', 'meanwhile', 'normally', 'however', 'instead', 'otherwise', 'still',
    'also', 'even', 'soon', 'later', 'probably', 'perhaps', 'almost', 'already',
    'always', 'never', 'indeed', 'surely', 'truly', 'actually', 'merely', 'simply',
    'instantly', 'immediately', 'quickly', 'slowly', 'quietly', 'softly', 'loudly',
    'gently', 'carefully', 'silently', 'nearly', 'barely', 'hardly', 'naturally',
    'clearly', 'obviously', 'mostly', 'partly', 'largely', 'deeply', 'highly',
    'somehow', 'somewhat', 'anyway', 'anyways', 'ahead', 'behind', 'nearby',
    'upstairs', 'downstairs', 'inside', 'outside', 'indoors', 'outdoors', 'along',
    'around', 'across', 'forward', 'backward', 'together', 'apart', 'aside',
    'further', 'furthermore', 'moreover', 'nevertheless', 'nonetheless',
    'consequently', 'accordingly', 'therefore', 'thus', 'hence', 'fortunately',
    'unfortunately', 'admittedly', 'undoubtedly', 'basically', 'essentially',
    'generally', 'typically', 'especially', 'particularly', 'specifically',
    'look', 'listen', 'wait', 'stop', 'come', 'go', 'let', 'tell', 'remember',
    'forget', 'leave', 'see', 'stand', 'forgive', 'talk', 'getting', 'like', 'english',
    'get', 'got', 'sit', 'sat', 'put', 'take', 'took', 'taken', 'give', 'gave', 'given',
    'make', 'made', 'say', 'said', 'ask', 'asked', 'tell', 'told', 'speak', 'spoke',
    'has', 'had', 'have', 'having', 'was', 'were', 'am', 'are', 'been', 'being',
    'do', 'does', 'did', 'doing', 'done', 'shall', 'should', 'would', 'could',
    'hear', 'heard', 'feel', 'felt', 'think', 'thought', 'know', 'knew', 'known',
    'watch', 'find', 'found', 'turn', 'turned', 'start', 'started', 'begin', 'began',
    'open', 'opened', 'close', 'closed', 'walk', 'walked', 'run', 'ran', 'move',
    'moved', 'step', 'stepped', 'reach', 'reached', 'stay', 'stayed', 'hold', 'held',
    'keep', 'kept', 'bring', 'brought', 'carry', 'carried', 'drop', 'dropped',
    'pull', 'pulled', 'push', 'pushed', 'pass', 'passed', 'fall', 'fell', 'rise', 'rose',
    'seem', 'seemed', 'appear', 'appeared', 'show', 'showed', 'try', 'tried',
    'help', 'helped', 'want', 'wanted', 'need', 'needed', 'wonder', 'wondered',
    'decide', 'decided',
    'today', 'tonight', 'tomorrow', 'yesterday', 'morning', 'afternoon', 'evening',
    'night', 'midnight', 'noon', 'dawn', 'dusk', 'moment', 'minute', 'hour', 'day',
    'week', 'month', 'year', 'time', 'faint', 'house',
  ]),
});

const WORD_PATTERN = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;
const QUOTE_PATTERN = /["“”«»„‟]/g;
const SENTENCE_BOUNDARY_PATTERN = /[.!?…\n\r]/;
const CONTRACTION_PATTERN = /^[\p{L}\p{M}]+['’](?:m|re|ve|ll|d|t|s)$/iu;

function normalizeToken(value) {
  return value
    .replace(/['’]s$/iu, '')
    .replace(/['’]$/u, '')
    .replace(/^['’]/u, '');
}

export function isExcludedToken(lower, config = CHARACTER_RECOGNITION_CONFIG) {
  if (!lower) return true;
  if (config.excludedSingleWords?.has(lower)) return true;
  if (CONTRACTION_PATTERN.test(lower)) return true;
  return false;
}

function tokenize(text) {
  const tokens = [];
  let lastEnd = 0;
  for (const match of text.matchAll(WORD_PATTERN)) {
    const value = match[0], start = match.index, end = start + value.length;
    const word = normalizeToken(value);
    if (!word) continue;
    const lower = word.toLocaleLowerCase();
    tokens.push({
      value: word,
      lower,
      start,
      end,
      capitalized: /^\p{Lu}/u.test(word),
      sentenceInitial: tokens.length === 0 || SENTENCE_BOUNDARY_PATTERN.test(text.slice(lastEnd, start)),
    });
    lastEnd = end;
  }
  return tokens;
}

function isJoined(text, previous, current, config) {
  const gap = text.slice(previous.end, current.start);
  if (/^[\s\u2010-\u2015\-]+$/u.test(gap)) return !current.sentenceInitial;
  if (/^\.\s+$/u.test(gap)) {
    return config.titleWords.has(previous.lower) || (previous.capitalized && previous.value.length === 1);
  }
  return false;
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

function isValidCandidate(tokens, config) {
  if (!tokens || !tokens.length) return false;
  if (tokens.length === 1) {
    const w = tokens[0].lower;
    if (tokens[0].value && tokens[0].value.length < 2) return false;
    return !config.titleWords.has(w) && !isExcludedToken(w, config);
  }
  const first = tokens[0].lower;
  const last = tokens[tokens.length - 1].lower;
  if (isExcludedToken(first, config) && !config.titleWords.has(first)) return false;
  if (isExcludedToken(last, config)) return false;
  return tokens.some(t => !config.titleWords.has(t.lower) && !isExcludedToken(t.lower, config));
}

function hasNearbyQuote(quoteOffsets, start, end, maxDistance = 48) {
  if (!quoteOffsets || !quoteOffsets.length) return false;
  let low = 0, high = quoteOffsets.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const offset = quoteOffsets[mid];
    if (offset >= start - maxDistance && offset <= end + maxDistance) return true;
    if (offset < start - maxDistance) low = mid + 1;
    else high = mid - 1;
  }
  return false;
}

export function extractCharacterCandidates(chapters, config = CHARACTER_RECOGNITION_CONFIG) {
  const normalizedChapters = (chapters || []).filter(Boolean).map(chapter => ({
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

      if (isValidCandidate([first], config)) {
        const single = createCandidate([first]);
        if (!candidates.has(single.key)) candidates.set(single.key, single);
      }

      const run = [first];
      for (let end = start + 1; end < tokens.length && run.length < config.maxNameTokens; end++) {
        const next = tokens[end];
        if (!next.capitalized || !isJoined(text, tokens[end - 1], next, config)) break;
        run.push(next);
        if (isValidCandidate(run, config)) {
          const candidate = createCandidate(run);
          if (!candidates.has(candidate.key)) candidates.set(candidate.key, candidate);
        }
      }
    }
  }

  for (const chapter of normalizedChapters) {
    const { text, tokens } = chapter;
    const quoteOffsets = [...text.matchAll(QUOTE_PATTERN)].map(match => match.index);
    for (let start = 0; start < tokens.length; start++) {
      for (let length = 1; length <= config.maxNameTokens && start + length <= tokens.length; length++) {
        let joinedRun = true;
        for (let j = 1; j < length; j++) {
          if (!isJoined(text, tokens[start + j - 1], tokens[start + j], config)) {
            joinedRun = false;
            break;
          }
        }
        if (!joinedRun) break;

        const key = tokens.slice(start, start + length).map(token => token.lower).join(' ');
        const candidate = candidates.get(key);
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

        const previous = (start > 0 && !SENTENCE_BOUNDARY_PATTERN.test(text.slice(tokens[start - 1].end, tokens[start].start)))
          ? tokens[start - 1].lower
          : '';
        const isDeterminer = previous === 'the' || previous === 'a' || previous === 'an' || previous === 'this' || previous === 'that';
        if (isDeterminer) candidate.contextHits.precededByTheRate++;
        if (config.locationPrepositions.has(previous)) candidate.contextHits.locationPrepositionRate++;

        const before = [];
        for (let j = start - 1; j >= Math.max(0, start - 3); j--) {
          if (SENTENCE_BOUNDARY_PATTERN.test(text.slice(tokens[j].end, tokens[j + 1].start))) break;
          before.unshift(tokens[j]);
        }
        const after = [];
        for (let j = start + length; j < Math.min(tokens.length, start + length + 6); j++) {
          if (SENTENCE_BOUNDARY_PATTERN.test(text.slice(tokens[j - 1].end, tokens[j].start))) break;
          after.push(tokens[j]);
        }
        const nearby = [...before, ...after.slice(0, 3)];

        if (nearby.some(token => config.speechVerbs.has(token.lower))) candidate.contextHits.speechVerbRate++;
        if (after.slice(0, 3).some(token => config.actionVerbs.has(token.lower))) candidate.contextHits.subjectOfActionVerbRate++;
        if (after.slice(0, 3).some(token => config.pronouns.has(token.lower))) candidate.contextHits.pronounFollowRate++;

        const spanEnd = span[span.length - 1]?.end ?? span[0].end;
        if (hasNearbyQuote(quoteOffsets, span[0].start, spanEnd, 48)) {
          candidate.contextHits.dialogueAdjacency++;
        }
      }
    }
  }

  return [...candidates.values()].filter(candidate => candidate.count > 0 && isValidCandidate(candidate.parts.map(p => ({ lower: p, value: p })), config));
}

export function scoreCharacterCandidate(candidate, config = CHARACTER_RECOGNITION_CONFIG) {
  const allOccurrences = candidate.capitalizedMidSentence + candidate.capitalizedSentenceInitial + candidate.lowercaseOccurrences;
  const mentions = Math.max(1, candidate.count);

  if (candidate.parts.length === 1 && candidate.capitalizedMidSentence === 0) {
    if (candidate.lowercaseOccurrences > 0) {
      return { ...candidate, features: {}, capRatio: 0, score: 0, confidence: 'low', reasons: ['disqualified: never mid-sentence and seen lowercase'] };
    }
  }

  const nonLowerRatio = allOccurrences ? (candidate.capitalizedMidSentence + candidate.capitalizedSentenceInitial) / allOccurrences : 0;
  const midRatio = candidate.count ? candidate.capitalizedMidSentence / candidate.count : 0;
  let capRatio = 0;
  if (nonLowerRatio > 0) {
    if (midRatio >= 0.12) {
      capRatio = nonLowerRatio * Math.min(1.0, 0.5 + midRatio * 0.85);
    } else if (candidate.lowercaseOccurrences === 0) {
      capRatio = nonLowerRatio * 0.75;
    } else {
      capRatio = nonLowerRatio * (midRatio * 4.0);
    }
  }

  let recurrenceBonus = 0;
  if (candidate.count >= 2) recurrenceBonus += 0.6;
  if (candidate.count >= 5) recurrenceBonus += 0.8;
  if (candidate.count >= 15) recurrenceBonus += 1.0;
  if (candidate.count >= 40) recurrenceBonus += 0.8;
  if (candidate.sectionTitles.size >= 2) recurrenceBonus += 0.8;
  if (candidate.sectionTitles.size >= 4) recurrenceBonus += 1.0;

  let lowerPenalty = 0;
  if (candidate.lowercaseOccurrences > 0 && allOccurrences > 0) {
    const lowerRatio = candidate.lowercaseOccurrences / allOccurrences;
    if (candidate.parts.length === 1) {
      if (lowerRatio > 0.25) lowerPenalty += lowerRatio * 6.0;
      if (candidate.capitalizedMidSentence === 0) lowerPenalty += 4.0;
    } else {
      if (lowerRatio > 0.4) lowerPenalty += lowerRatio * 4.0;
    }
  }

  let determinerPenalty = 0;
  const determinerRate = candidate.contextHits.precededByTheRate / mentions;
  if (determinerRate > 0.35) {
    determinerPenalty = determinerRate * 4.5;
  }

  const hasPlace = candidate.parts.some(p => config.placeSuffixes.has(p));
  const features = {
    capRatio,
    speechVerbRate: candidate.contextHits.speechVerbRate / mentions,
    subjectOfActionVerbRate: candidate.contextHits.subjectOfActionVerbRate / mentions,
    dialogueAdjacency: candidate.contextHits.dialogueAdjacency / mentions,
    pronounFollowRate: candidate.contextHits.pronounFollowRate / mentions,
    precededByTheRate: determinerRate,
    locationPrepositionRate: candidate.contextHits.locationPrepositionRate / mentions,
    objectOrPlaceSuffix: hasPlace ? 1 : 0,
  };

  const baseScore = Object.entries(config.weights).reduce((total, [feature, weight]) => {
    return total + (features[feature] || 0) * weight;
  }, 0);

  const rawScore = baseScore + recurrenceBonus - lowerPenalty - determinerPenalty;
  const score = Math.max(0, rawScore);
  const confidence = score >= config.highConfidenceThreshold ? 'high' : score >= config.threshold ? 'medium' : 'low';
  const reasons = [];
  if (features.capRatio > 0) reasons.push(`mid-sentence capitals ${candidate.capitalizedMidSentence}/${allOccurrences}`);
  if (candidate.contextHits.speechVerbRate) reasons.push(`speech verbs x${candidate.contextHits.speechVerbRate}`);
  if (candidate.contextHits.subjectOfActionVerbRate) reasons.push(`action verbs x${candidate.contextHits.subjectOfActionVerbRate}`);
  if (candidate.contextHits.dialogueAdjacency) reasons.push(`dialogue x${candidate.contextHits.dialogueAdjacency}`);
  if (candidate.contextHits.pronounFollowRate) reasons.push(`pronouns follow x${candidate.contextHits.pronounFollowRate}`);
  if (candidate.contextHits.precededByTheRate) reasons.push(`preceded by determiner x${candidate.contextHits.precededByTheRate}`);
  if (candidate.contextHits.locationPrepositionRate) reasons.push(`location prepositions x${candidate.contextHits.locationPrepositionRate}`);
  if (features.objectOrPlaceSuffix) reasons.push('place or setting marker');
  if (recurrenceBonus > 0) reasons.push(`recurrence bonus +${recurrenceBonus.toFixed(1)}`);
  if (lowerPenalty > 0) reasons.push(`lowercase penalty -${lowerPenalty.toFixed(1)}`);
  if (determinerPenalty > 0) reasons.push(`determiner penalty -${determinerPenalty.toFixed(1)}`);
  return { ...candidate, features, capRatio, score, confidence, reasons };
}

export function consolidateCharacters(candidates) {
  if (!candidates || candidates.length <= 1) return candidates || [];
  const sorted = [...candidates].sort((a, b) => b.parts.length - a.parts.length || b.score - a.score || b.count - a.count);
  const multiToken = sorted.filter(c => c.parts.length > 1);
  const singleToken = sorted.filter(c => c.parts.length === 1);

  const absorbedKeys = new Set();
  const multiByPart = new Map();

  for (const m of multiToken) {
    for (const part of m.parts) {
      if (!multiByPart.has(part)) multiByPart.set(part, []);
      multiByPart.get(part).push(m);
    }
  }

  for (const s of singleToken) {
    const matchingMulti = multiByPart.get(s.key);
    if (matchingMulti && matchingMulti.length === 1) {
      const parent = matchingMulti[0];
      parent.count = Math.max(parent.count, parent.count + s.count, s.count);
      parent.score = Math.max(parent.score, s.score);
      for (const title of s.sectionTitles) {
        parent.sectionTitles.add(title);
      }
      parent.aliases = parent.aliases || new Set();
      parent.aliases.add(s.name);
      absorbedKeys.add(s.key);
    }
  }

  return sorted.filter(c => !absorbedKeys.has(c.key)).map(c => {
    if (c.aliases instanceof Set) {
      c.aliases = [...c.aliases];
    }
    return c;
  });
}

export function getCharacterRecognitionConfig(sensitivity = 'balanced') {
  const preset = SENSITIVITY_THRESHOLDS[sensitivity] || SENSITIVITY_THRESHOLDS.balanced;
  return Object.freeze({
    ...CHARACTER_RECOGNITION_CONFIG,
    threshold: preset.threshold,
    highConfidenceThreshold: preset.highConfidenceThreshold,
  });
}

export function recognizeCharacters(chapters, config = CHARACTER_RECOGNITION_CONFIG, options = {}) {
  const activeConfig = typeof config === 'string'
    ? getCharacterRecognitionConfig(config)
    : (config || CHARACTER_RECOGNITION_CONFIG);
  const minScore = options.minScore !== undefined ? options.minScore : activeConfig.threshold;
  const scored = extractCharacterCandidates(chapters, activeConfig)
    .map(candidate => scoreCharacterCandidate(candidate, activeConfig));

  const consolidated = consolidateCharacters(scored);
  return consolidated
    .filter(candidate => candidate.score >= minScore)
    .sort((first, second) => second.score - first.score || second.count - first.count || first.name.localeCompare(second.name));
}
