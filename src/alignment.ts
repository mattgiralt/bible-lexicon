export function tokenize(text: string): string[] {
  return text.match(/[\p{L}\p{M}]+/gu) || [];
}

export function normalizeWord(word: string): string {
  return word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Keep only pairs that occur in every optimal exact-token alignment.
export function alignWords(source: string[], target: string[]): Map<number, number> {
  const a = source.map(normalizeWord);
  const b = target.map(normalizeWord);
  const scores = a.map(() => new Array<number>(b.length + 1).fill(0));
  scores.push(new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      scores[i][j] = Math.max(scores[i + 1][j], scores[i][j + 1], a[i] === b[j] ? 1 + scores[i + 1][j + 1] : 0);
    }
  }

  const reachable = scores.map((row) => row.map(() => false));
  const options = a.map(() => new Set<number>());
  reachable[0][0] = true;
  for (let i = 0; i <= a.length; i++) {
    for (let j = 0; j <= b.length; j++) {
      if (!reachable[i][j]) continue;
      const score = scores[i][j];
      if (i < a.length && scores[i + 1][j] === score) {
        reachable[i + 1][j] = true;
        options[i].add(-1);
      }
      if (j < b.length && scores[i][j + 1] === score) reachable[i][j + 1] = true;
      if (i < a.length && j < b.length && a[i] === b[j] && scores[i + 1][j + 1] + 1 === score) {
        reachable[i + 1][j + 1] = true;
        options[i].add(j);
      }
    }
  }

  const alignment = new Map<number, number>();
  options.forEach((matches, index) => {
    if (matches.size === 1 && !matches.has(-1)) alignment.set(index, [...matches][0]);
  });
  return alignment;
}

export function taggedTokens(text: string) {
  const result: { word: string; codes: string[] }[] = [];
  const strip = (value: string) => value.replace(/<[^>]*>|&(?:#\w+|\w+);/g, " ");
  const append = (value: string, codes: string[] = []) => {
    result.push(...tokenize(strip(value)).map((word) => ({ word, codes })));
  };
  let end = 0;
  for (const match of text.matchAll(/<w\b[^>]*strong="([^"]+)"[^>]*>(.*?)<\/w>/gs)) {
    append(text.slice(end, match.index));
    append(match[2], match[1].split(/\s+/));
    end = match.index + match[0].length;
  }
  append(text.slice(end));
  return result;
}

export function alignSelection(source: string, offset: number, selected: string, tagged: string) {
  const words = Array.from(source.matchAll(/[\p{L}\p{M}]+/gu));
  const index = words.findIndex((word) => word.index === offset && word[0].length === selected.length);
  if (index < 0 || source.slice(offset, offset + selected.length) !== selected) return;
  const target = taggedTokens(tagged);
  const alignment = alignWords(
    words.map((word) => word[0]),
    target.map((token) => token.word),
  );
  const position = alignment.get(index);
  if (position === undefined) return;
  const identical = words.length === target.length && alignment.size === words.length;
  const anchored = alignment.get(index - 1) === position - 1 || alignment.get(index + 1) === position + 1;
  if (identical || (anchored && alignment.size >= Math.ceil(words.length * 0.6))) return target[position];
}
