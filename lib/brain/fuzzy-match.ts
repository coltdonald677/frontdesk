/**
 * Deterministic fuzzy entity matching for Ask Pluto.
 * Never auto-selects fuzzy matches — only exact, alias, and unique partial resolve automatically.
 */

export const FUZZY_MIN_SUGGESTION_SCORE = 0.58;
export const FUZZY_STRONG_SINGLE_SCORE = 0.82;
export const FUZZY_MIN_SCORE_GAP = 0.1;
export const UNIQUE_PARTIAL_MIN_SCORE = 0.72;
export const MAX_ENTITY_SUGGESTIONS = 5;

export type FuzzyMatchTier =
  | "exact"
  | "alias"
  | "unique_partial"
  | "fuzzy"
  | "none";

export type ScoredCandidate<T> = {
  entity: T;
  score: number;
  matchedText: string;
  tier: FuzzyMatchTier;
};

export function normalizeForFuzzyMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeNormalized(value: string): string[] {
  const normalized = normalizeForFuzzyMatch(value);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

export function preserveNumericTokens(tokens: string[]): Set<string> {
  return new Set(tokens.filter((token) => /\d/.test(token)));
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, col) => {
      if (row === 0) return col;
      if (col === 0) return row;
      return 0;
    }),
  );

  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row]![col] = Math.min(
        matrix[row - 1]![col]! + 1,
        matrix[row]![col - 1]! + 1,
        matrix[row - 1]![col - 1]! + cost,
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

function normalizedSimilarity(a: string, b: string): number {
  const left = normalizeForFuzzyMatch(a);
  const right = normalizeForFuzzyMatch(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const maxLen = Math.max(left.length, right.length);
  const distance = levenshteinDistance(left, right);
  return Math.max(0, 1 - distance / maxLen);
}

function tokenOverlapScore(needleTokens: string[], candidateTokens: string[]): number {
  if (!needleTokens.length || !candidateTokens.length) return 0;

  const needleSet = new Set(needleTokens);
  const candidateSet = new Set(candidateTokens);
  let overlap = 0;

  for (const token of needleSet) {
    if (candidateSet.has(token)) overlap += 1;
  }

  const union = new Set([...needleSet, ...candidateSet]).size;
  return union === 0 ? 0 : overlap / union;
}

function prefixScore(needle: string, candidate: string): number {
  const normalizedNeedle = normalizeForFuzzyMatch(needle);
  const normalizedCandidate = normalizeForFuzzyMatch(candidate);
  if (!normalizedNeedle || !normalizedCandidate) return 0;

  if (
    normalizedCandidate.startsWith(normalizedNeedle) ||
    normalizedNeedle.startsWith(normalizedCandidate)
  ) {
    const ratio =
      Math.min(normalizedNeedle.length, normalizedCandidate.length) /
      Math.max(normalizedNeedle.length, normalizedCandidate.length);
    return 0.7 + ratio * 0.25;
  }

  return 0;
}

function numericTokenBonus(
  needleTokens: string[],
  candidateTokens: string[],
): number {
  const needleNumbers = preserveNumericTokens(needleTokens);
  if (needleNumbers.size === 0) return 0;

  const candidateNumbers = preserveNumericTokens(candidateTokens);
  let matched = 0;
  for (const token of needleNumbers) {
    if (candidateNumbers.has(token)) matched += 1;
  }

  if (matched === 0) return -0.15;
  return matched === needleNumbers.size ? 0.12 : 0.05;
}

function reversedNameBonus(needleTokens: string[], candidateTokens: string[]): number {
  if (needleTokens.length < 2 || candidateTokens.length < 2) return 0;
  const reversed = [...needleTokens].reverse().join(" ");
  const candidate = candidateTokens.join(" ");
  return normalizeForFuzzyMatch(reversed) === normalizeForFuzzyMatch(candidate) ? 0.08 : 0;
}

export function scoreEntityTextMatch(needle: string, candidateText: string): number {
  const normalizedNeedle = normalizeForFuzzyMatch(needle);
  const normalizedCandidate = normalizeForFuzzyMatch(candidateText);
  if (!normalizedNeedle || !normalizedCandidate) return 0;
  if (normalizedNeedle === normalizedCandidate) return 1;

  const needleTokens = tokenizeNormalized(needle);
  const candidateTokens = tokenizeNormalized(candidateText);

  const scores = [
    normalizedSimilarity(normalizedNeedle, normalizedCandidate) * 0.45,
    tokenOverlapScore(needleTokens, candidateTokens) * 0.3,
    prefixScore(normalizedNeedle, normalizedCandidate) * 0.2,
    numericTokenBonus(needleTokens, candidateTokens),
    reversedNameBonus(needleTokens, candidateTokens),
  ];

  const partialIncludes =
    normalizedCandidate.includes(normalizedNeedle) ||
    normalizedNeedle.includes(normalizedCandidate);
  if (partialIncludes) {
    const ratio =
      Math.min(normalizedNeedle.length, normalizedCandidate.length) /
      Math.max(normalizedNeedle.length, normalizedCandidate.length);
    scores.push(ratio * 0.25);
  }

  return Math.min(0.99, Math.max(0, scores.reduce((sum, value) => sum + value, 0)));
}

export function rankFuzzyMatches<T>(
  needle: string,
  candidates: T[],
  getSearchableTexts: (candidate: T) => string[],
): ScoredCandidate<T>[] {
  const normalizedNeedle = normalizeForFuzzyMatch(needle);
  if (!normalizedNeedle) return [];

  const scored: ScoredCandidate<T>[] = [];

  for (const entity of candidates) {
    const texts = getSearchableTexts(entity).filter(Boolean);
    let bestScore = 0;
    let bestText = texts[0] ?? "";
    let tier: FuzzyMatchTier = "fuzzy";

    for (const text of texts) {
      const normalizedText = normalizeForFuzzyMatch(text);
      if (normalizedNeedle === normalizedText) {
        bestScore = 1;
        bestText = text;
        tier = "exact";
        break;
      }

      const score = scoreEntityTextMatch(needle, text);
      if (score > bestScore) {
        bestScore = score;
        bestText = text;
      }
    }

    if (tier !== "exact") {
      const partialMatches = texts.filter((text) => {
        const normalizedText = normalizeForFuzzyMatch(text);
        return (
          normalizedText.includes(normalizedNeedle) ||
          normalizedNeedle.includes(normalizedText)
        );
      });

      if (partialMatches.length === 1 && bestScore >= UNIQUE_PARTIAL_MIN_SCORE) {
        tier = "unique_partial";
      } else if (bestScore >= FUZZY_MIN_SUGGESTION_SCORE) {
        tier = "fuzzy";
      } else {
        continue;
      }
    }

    scored.push({ entity, score: bestScore, matchedText: bestText, tier });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTITY_SUGGESTIONS);
}

export function dedupeScoredCandidates<T extends { id: string }>(
  candidates: ScoredCandidate<T>[],
): ScoredCandidate<T>[] {
  const seen = new Set<string>();
  const result: ScoredCandidate<T>[] = [];

  for (const candidate of candidates) {
    const id = candidate.entity.id;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(candidate);
  }

  return result.slice(0, MAX_ENTITY_SUGGESTIONS);
}

export function isStrongSingleFuzzyMatch<T>(
  candidates: ScoredCandidate<T>[],
): boolean {
  if (candidates.length !== 1) return false;
  const top = candidates[0];
  if (!top) return false;
  return top.score >= FUZZY_STRONG_SINGLE_SCORE && top.tier === "fuzzy";
}

export function hasCloseAmbiguousMatches<T>(candidates: ScoredCandidate<T>[]): boolean {
  if (candidates.length < 2) return false;
  const top = candidates[0]?.score ?? 0;
  const second = candidates[1]?.score ?? 0;
  return top >= FUZZY_MIN_SUGGESTION_SCORE && top - second < FUZZY_MIN_SCORE_GAP;
}
