import { bibleBooks, bookCode } from "./references";

export function readCitation({ text, selected, pos }: { text: string; selected: string; pos: number }) {
  const selectionEnd = pos + selected.length;
  let citation: { ref: string[]; passage: string; start: number } | undefined;

  // A trailing reference belongs only to the quotation it immediately follows.
  const quoteRegex =
    /«([^«»]+)»[ \t\u00a0\u202f]*[.!?]?[ \t\u00a0\u202f]*\(([1-3]?[ \t]*[\p{L}]+(?:[ \t]+[\p{L}]+){0,3})[ \t]+(\d+)[.:,](\d+)(?:[–—-](\d+))?(?:[ \t]*,[ \t]*([^)\n]+))?[ \t]*\)/gu;
  for (const match of text.matchAll(quoteRegex)) {
    const start = match.index + 1;
    const passage = match[1];
    if (
      start <= pos &&
      selectionEnd <= start + passage.length &&
      !/\n[ \t]*\n/.test(passage) &&
      bibleBooks.includes(bookCode(match[2]))
    ) {
      citation = { ref: match.slice(1), passage, start };
      break;
    }
  }

  const refRegex =
    /(?:^|\n)[ \t]*>?[ \t]*([1-3]?[ \t]*[\p{L}]+(?:[ \t]+[\p{L}]+){0,3})[ \t]+(\d+)[.:,](\d+)(?:[–—-](\d+))?[ \t]*(?:\(([^)\n]+)\))?[ \t]*:/gu;

  const before = text.slice(0, pos);
  const matches = Array.from(before.matchAll(refRegex));
  const ref = matches[matches.length - 1];

  if (!citation) {
    if (!ref) throw new Error("Aucune référence biblique reconnue.");
    const start = ref.index + ref[0].length;
    const remaining = text.slice(start);
    const paragraphEnd = remaining.search(/\n[ \t]*\n/);
    citation = { ref, start, passage: paragraphEnd === -1 ? remaining : remaining.slice(0, paragraphEnd) };
  }

  const { ref: reference, start, passage } = citation;

  const book = reference[1].trim();
  const chapter = Number(reference[2]);
  const firstVerse = Number(reference[3]);
  const lastVerse = Number(reference[4] || reference[3]);
  const version = reference[5] || "Non précisée";

  const relative = pos - start;

  if (relative < 0 || relative + selected.length > passage.length) {
    throw new Error("Le mot sélectionné semble être en dehors de la citation biblique.");
  }

  const markers = Array.from(passage.matchAll(/(?:^|\s)(\d{1,3})(?=\s)/g)).filter(
    (m) => Number(m[1]) >= firstVerse && Number(m[1]) <= lastVerse,
  );

  if (
    firstVerse !== lastVerse &&
    ((markers.length !== lastVerse - firstVerse && markers.length !== lastVerse - firstVerse + 1) ||
      markers.some((marker, index) => Number(marker[1]) !== lastVerse - markers.length + 1 + index))
  ) {
    throw new Error("Les numéros de versets de cette citation ne permettent pas de situer la sélection.");
  }

  let verse = firstVerse;
  let verseStart = 0;
  let verseEnd = passage.length;

  for (const marker of markers) {
    const markerIndex = marker.index ?? 0;

    if (markerIndex + marker[0].length <= relative) {
      verse = Number(marker[1]);
      verseStart = markerIndex + marker[0].length;
    } else {
      verseEnd = markerIndex;
      break;
    }
  }

  const verseText = passage.slice(verseStart, verseEnd);
  if (relative < verseStart || relative + selected.length > verseEnd) {
    throw new Error("La sélection doit se trouver dans un seul verset.");
  }
  const offset = relative - verseStart;
  return { book, chapter, verse, version, verseText, offset };
}
