const aliases: Record<string, string> = Object.create(null);

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[.\s]/g, "");
}

function register(code: string, names: string) {
  for (const name of [code, ...names.split("|")]) {
    aliases[normalize(name)] = code;
  }
}

register("Gen", "Gn|Ge|Genèse");
register("Exo", "Ex|Exode|Exod");
register("Lev", "Lv|Lévitique");
register("Num", "Nb|Nombres");
register("Deu", "Dt|Deut|Deutéronome");
register("Jos", "Josué|Josh");
register("Jdg", "Jg|Juges|Judg");
register("Rut", "Rt|Ruth");
register("1Sa", "1S|1Sam|1Samuel");
register("2Sa", "2S|2Sam|2Samuel");
register("1Ki", "1R|1Rois|1Kgs");
register("2Ki", "2R|2Rois|2Kgs");
register("1Ch", "1Chr|1Chroniques");
register("2Ch", "2Chr|2Chroniques");
register("Ezr", "Esd|Esdras|Ezra");
register("Neh", "Né|Néhémie");
register("Est", "Esther|Esth");
register("Job", "Jb");
register("Psa", "Ps|Psaume|Psaumes");
register("Pro", "Pr|Prov|Proverbes");
register("Ecc", "Ec|Eccl|Ecclésiaste");
register("Sng", "Ct|Cant|Cantique|Song");
register("Isa", "Es|Ésaïe|Isaïe");
register("Jer", "Jr|Jérémie");
register("Lam", "Lm|Lamentations");
register("Ezk", "Ez|Ézéchiel|Ezek");
register("Dan", "Dn|Daniel");
register("Hos", "Os|Osée");
register("Jol", "Jl|Joël|Joel");
register("Amo", "Am|Amos");
register("Oba", "Ab|Abdias|Obad");
register("Jon", "Jonas|Jonah");
register("Mic", "Mi|Michée");
register("Nam", "Na|Nahum|Nah");
register("Hab", "Ha|Habacuc");
register("Zep", "So|Sophonie|Zeph");
register("Hag", "Ag|Aggée");
register("Zec", "Za|Zacharie|Zech");
register("Mal", "Ml|Malachie");
register("Mat", "Mt|Matthieu|Matt");
register("Mrk", "Mc|Marc|Mark");
register("Luk", "Lc|Luc|Luke");
register("Jhn", "Jn|Jean|John");
register("Act", "Ac|Actes|Acts");
register("Rom", "Rm|Romains");
register("1Co", "1Cor|1Corinthiens");
register("2Co", "2Cor|2Corinthiens");
register("Gal", "Ga|Galates");
register("Eph", "Ep|Éphésiens");
register("Php", "Ph|Phil|Philippiens");
register("Col", "Colossiens");
register("1Th", "1Thess|1Thessaloniciens");
register("2Th", "2Thess|2Thessaloniciens");
register("1Ti", "1Tm|1Tim|1Timothée");
register("2Ti", "2Tm|2Tim|2Timothée");
register("Tit", "Tt|Tite|Titus");
register("Phm", "Phlm|Philémon");
register("Heb", "He|Hébreux");
register("Jas", "Jc|Jacques");
register("1Pe", "1P|1Pi|1Pet|1Pierre");
register("2Pe", "2P|2Pi|2Pet|2Pierre");
register("1Jn", "1Jean|1John");
register("2Jn", "2Jean|2John");
register("3Jn", "3Jean|3John");
register("Jud", "Jude");
register("Rev", "Ap|Apoc|Apocalypse");

export const bibleBooks = [
  "Gen",
  "Exo",
  "Lev",
  "Num",
  "Deu",
  "Jos",
  "Jdg",
  "Rut",
  "1Sa",
  "2Sa",
  "1Ki",
  "2Ki",
  "1Ch",
  "2Ch",
  "Ezr",
  "Neh",
  "Est",
  "Job",
  "Psa",
  "Pro",
  "Ecc",
  "Sng",
  "Isa",
  "Jer",
  "Lam",
  "Ezk",
  "Dan",
  "Hos",
  "Jol",
  "Amo",
  "Oba",
  "Jon",
  "Mic",
  "Nam",
  "Hab",
  "Zep",
  "Hag",
  "Zec",
  "Mal",
  "Mat",
  "Mrk",
  "Luk",
  "Jhn",
  "Act",
  "Rom",
  "1Co",
  "2Co",
  "Gal",
  "Eph",
  "Php",
  "Col",
  "1Th",
  "2Th",
  "1Ti",
  "2Ti",
  "Tit",
  "Phm",
  "Heb",
  "Jas",
  "1Pe",
  "2Pe",
  "1Jn",
  "2Jn",
  "3Jn",
  "Jud",
  "Rev",
];

const frenchBooks = [
  "Gn",
  "Ex",
  "Lv",
  "Nb",
  "Dt",
  "Jos",
  "Jg",
  "Rt",
  "1S",
  "2S",
  "1R",
  "2R",
  "1Ch",
  "2Ch",
  "Esd",
  "Né",
  "Est",
  "Jb",
  "Ps",
  "Pr",
  "Ec",
  "Ct",
  "Es",
  "Jr",
  "Lm",
  "Ez",
  "Dn",
  "Os",
  "Jl",
  "Am",
  "Ab",
  "Jon",
  "Mi",
  "Na",
  "Ha",
  "So",
  "Ag",
  "Za",
  "Ml",
  "Mt",
  "Mc",
  "Lc",
  "Jn",
  "Ac",
  "Rm",
  "1Co",
  "2Co",
  "Ga",
  "Ep",
  "Ph",
  "Col",
  "1Th",
  "2Th",
  "1Tm",
  "2Tm",
  "Tt",
  "Phm",
  "Hé",
  "Jc",
  "1Pi",
  "2Pi",
  "1Jn",
  "2Jn",
  "3Jn",
  "Jude",
  "Ap",
];

for (const [index, book] of bibleBooks.entries()) register(book, frenchBooks[index]);
for (const [alias, book] of Object.entries({ Jam: "Jas" })) register(book, alias);

export function bookCode(book: string): string {
  return aliases[normalize(book)] || book;
}

export function formatReference(book: string, chapter: number, verse: number): string {
  return (frenchBooks[bibleBooks.indexOf(bookCode(book))] || book) + " " + chapter + "." + verse;
}

export function localizeReferences(text: string): string {
  return text.replace(
    /(?<![\p{L}\d])([1-3]?[ .]?[A-Za-z]{2,12})[ .]+(\d+)[.:](\d+)/gu,
    (whole, book: string, chapter: string, verse: string) =>
      bibleBooks.includes(bookCode(book)) ? formatReference(book, Number(chapter), Number(verse)) : whole,
  );
}

export function formatUBSReferences(raw: string): string {
  const references: string[] = JSON.parse(raw || "[]");
  return [
    ...new Set(
      references.flatMap((ref) => {
        const match = /^(\d{3})(\d{3})(\d{3})\d{5}/.exec(String(ref));
        if (!match) return [];
        const book = bibleBooks[Number(match[1]) - 1];
        return book ? [formatReference(book, Number(match[2]), Number(match[3]))] : [];
      }),
    ),
  ].join("; ");
}
