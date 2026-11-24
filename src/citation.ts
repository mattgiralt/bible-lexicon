export function readCitation({ text, selected, pos }: { text: string; selected: string; pos: number }) {
  const refRegex =
    /(?:^|\n)[ \t]*>?[ \t]*([1-3]?[ \t]*[\p{L}]+(?:[ \t]+[\p{L}]+){0,3})[ \t]+(\d+)[.:,](\d+)(?:[–—-](\d+))?[ \t]*(?:\(([^)\n]+)\))?[ \t]*:/gu;

  const before = text.slice(0, pos);
  const matches = Array.from(before.matchAll(refRegex));
  const ref = matches[matches.length - 1];

  if (!ref || ref.index === undefined) {
    throw new Error("Aucune référence biblique reconnue.");
  }

  const book = ref[1].trim();
  const chapter = Number(ref[2]);
  const firstVerse = Number(ref[3]);
  const lastVerse = Number(ref[4] || ref[3]);
  const version = ref[5] || "Non précisée";

  const start = ref.index + ref[0].length;

  const remaining = text.slice(start);

  const paragraphEnd = remaining.search(/\n[ \t]*\n/);

  const passage = paragraphEnd === -1 ? remaining : remaining.slice(0, paragraphEnd);

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
