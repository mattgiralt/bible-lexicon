import { alignSelection } from "./alignment";
import { bookCode, bibleBooks, localizeReferences } from "./references";
import { environment } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);
const database = path.join(environment.assetsPath, "data", "bible.sqlite");

function sql(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}

async function query<T = any>(statement: string, jsonColumn = false): Promise<T[]> {
  const { stdout } = await exec(
    "/usr/bin/sqlite3",
    ["-readonly", ...(jsonColumn ? ["-noheader", "-list"] : ["-json"]), database, statement],
    {
      maxBuffer: 32 * 1024 * 1024,
      timeout: 20000,
    },
  );
  return JSON.parse(stdout.trim() || "[]");
}

function strongBase(s: string): string {
  return s.match(/^[GHA]\d{4}/)?.[0] || s;
}

interface OriginalWord {
  book: string;
  native_chapter: number;
  native_verse: number;
  position: number;
  word: string;
  lemma: string;
  strong: string;
  morph: string;
  transliteration: string;
  gloss: string;
  edition: string;
}

export async function lookup(
  book: string,
  chapter: number,
  verse: number,
  selected: string,
  verseText: string,
  offset: number,
) {
  const code = bookCode(book);
  const where = (table: string) =>
    `${table}.book=${sql(code)} AND ${table}.chapter=${Number(chapter)} AND ${table}.verse=${Number(verse)}`;
  const [french, originals] = await Promise.all([
    query(`SELECT text FROM french f WHERE ${where("f")}`),
    query<OriginalWord>(`SELECT o.*, v.native_chapter, v.native_verse FROM verse_links v
      JOIN original o ON o.book=v.book AND o.chapter=v.step_chapter AND o.verse=v.step_verse
      WHERE ${where("v")}
      ORDER BY o.position`),
  ]);
  const aligned = alignSelection(verseText, offset, selected, french[0]?.text || "");
  const strongs = new Set(aligned?.codes.map(strongBase));
  const candidates = originals.filter((r) => strongs.has(strongBase(r.strong)));
  // LSG only supplies base identifiers. Highlight only a unique original position.
  const matched = candidates.length === 1 && strongs.size === 1;
  const results = candidates.length ? candidates : originals;

  const bases = [...new Set(results.map((row) => strongBase(row.strong)))].map(sql).join(",");
  const morphCodes = [...new Set(results.flatMap((row) => morphologyCodes(row.morph, row.strong[0] === "H")))];
  const native = results[0];
  const prefix = native && referencePrefix(code, native.native_chapter, native.native_verse);
  const [articles, codes, translations, senses, marble] = results.length
    ? await Promise.all([
        query<LexicalArticle>(`SELECT * FROM lexicon WHERE strong IN (${bases}) ORDER BY extended`),
        query<{ code: string; language: string; description: string }>(`
          SELECT code, language, description FROM morphology WHERE code IN (${morphCodes.map(sql).join(",")})`),
        query<{ strong: string; translation: string; frequency: number }>(`
          SELECT strong, translation, frequency FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY strong ORDER BY frequency DESC, translation) AS rank
            FROM french_lexicon WHERE strong IN (${bases})
          ) WHERE rank <= 8 ORDER BY strong, rank`),
        query<UBSSense>(`SELECT strong, lemma, sense_id, entry_code, domain, subdomain,
           glosses, definition, comments, forms, '[]' AS refs, ai_generated, human_check, source,
           INSTR(refs, ${sql('"' + prefix)}) > 0 AS cited
           FROM ubs_senses WHERE strong IN (${bases})`),
        native.strong.startsWith("H")
          ? query<{ position: number; lemma: string }>(`SELECT position, lemma FROM marble WHERE book=${sql(code)}
              AND chapter=${native.native_chapter} AND verse=${native.native_verse}`)
          : [],
      ])
    : [[], [], [], [], []];
  const descriptions = new Map(codes.map((item) => [item.language + ":" + item.code, item.description]));
  const entries = results.map((r) => {
    const base = strongBase(r.strong);
    const baseArticles = articles.filter((row) => row.strong === base);
    const lex = r.strong === base ? baseArticles : baseArticles.filter((row) => row.extended === r.strong);
    const morphology = morphologyCodes(r.morph, r.strong[0] === "H")
      .map((code) => descriptions.get(r.strong[0] + ":" + code) || `Code STEP=${code} (description indisponible)`)
      .join(";");
    return {
      ...r,
      translations: translations.filter((row) => row.strong === base),
      ubsSenses: classifyUBSSenses(
        r.strong,
        r.lemma,
        senses.filter((row) => row.strong === base),
        baseArticles,
        { word: r, originals, marble: marble.filter((row) => row.position === r.position) },
      ),
      lemma: r.lemma || (lex.length === 1 ? lex[0].lemma : ""),
      definition: (lex.length === 1 ? lex[0].gloss : "") || r.gloss,
      morphology,
    };
  });

  const unique = new Map<string, (typeof entries)[number] & { occurrences: number }>();

  for (const entry of entries) {
    const cleanWord = entry.word.replace(/[\/\\]/g, "").replace(/[\p{P}\u05C3]+$/gu, "");

    const item = {
      ...entry,
      word: cleanWord.normalize("NFC"),
      lemma: entry.lemma.normalize("NFC"),
      occurrences: 1,
    };

    const key = [item.word, item.lemma, item.strong, item.morph].join("|");

    const previous = unique.get(key);
    if (previous) {
      previous.occurrences++;
    } else {
      unique.set(key, item);
    }
  }

  const originalWords = new Map<string, string>();

  const highlightedPositions = new Set(matched ? candidates.map((r) => r.position) : []);

  for (const r of originals) {
    const word = String(r.word)
      .replace(/[\/\\]/g, "")
      .normalize("NFC");

    const key = r.position + "|" + word;

    if (originalWords.has(key)) continue;

    originalWords.set(key, highlightedPositions.has(r.position) ? "**" + word + "**" : word);
  }

  const originalVerse = Array.from(originalWords.values()).join(" ");

  return {
    originalVerse,
    entries: Array.from(unique.values()),
    matched,
    ambiguous: candidates.length > 0 && !matched,
    french: french[0]?.text || "",
  };
}

export function morphologyCodes(raw: string, hebrew: boolean): string[] {
  const language = hebrew && /^[HA]/.test(raw) ? raw[0] : "";
  return raw.split("/").map((code) => (language && !/^[HA][A-Z]/.test(code) ? language + code : code));
}

export function frenchMorphology(s: string, hebrew = false): string {
  const terms: Record<string, string> = {
    Function: "Nature",
    pronoun: "pronom",
    article: "article",
    indefinite: "indéfini",
    voice: "voix",
    active: "active",
    passive: "passif",
    or: "ou",
    Name: "Nom propre",
    type: "type",
    Extra: "Précision",
    Gentilic: "Gentilé",
    Possessive: "Possessif",
    Reflexive: "Réfléchi",
    Interrogative: "Interrogatif",
    Reciprocal: "Réciproque",
    Correlative: "Corrélatif",
    Comparative: "Comparatif",
    Superlative: "Superlatif",
    Numerical: "Numéral",
    Numeral: "Numéral",
    Proper: "Propre",
    Location: "Lieu",
    Individual: "Personne",
    Title: "Titre",
    Consecutive: "Consécutif",
    Indeclinable: "Indéclinable",
    Negative: "Négatif",
    Suffix: "Suffixe",
    Directional: "Directionnel",
    Paragogic: "Paragogique",
    Greek: "grec",
    Attic: "attique",
    Contracted: "Contracté",
    Disjunctive: "Disjonctif",
    Conditional: "Conditionnel",
    Object: "objet",
    indicator: "marqueur",
    position: "position",
    Either: "L’un ou l’autre",
    gender: "genre",
    Aramaic: "araméen",
    Hebrew: "hébreu",
    Pual: "Pou’al",
    Pluperfect: "Plus-que-parfait",
    Deponent: "Déponent",
    Noun: "Nom",
    Verb: "Verbe",
    Adjective: "Adjectif",
    Pronoun: "Pronom",
    Participle: "Participe",
    Case: "Cas",
    Nominative: "Nominatif",
    Accusative: "Accusatif",
    Genitive: "Génitif",
    Dative: "Datif",
    Vocative: "Vocatif",
    Number: "Nombre",
    Singular: "Singulier",
    Plural: "Pluriel",
    Gender: "Genre",
    Masculine: "Masculin",
    Feminine: "Féminin",
    Neuter: "Neutre",
    Tense: "Temps",
    Present: "Présent",
    Future: "Futur",
    Aorist: "Aoriste",
    Imperfect: "Imparfait",
    Perfect: "Parfait",
    Voice: "Voix",
    Active: "Active",
    Passive: "Passive",
    Middle: "Moyenne",
    Mood: "Mode",
    Indicative: "Indicatif",
    Imperative: "Impératif",
    Subjunctive: "Subjonctif",
    Infinitive: "Infinitif",
    Person: "Personne",
    First: "Première",
    Second: "Deuxième",
    Third: "Troisième",
    Stem: "Thème verbal",
    Form: "Forme",
    Preposition: "Préposition",
    Conjunction: "Conjonction",
    Article: "Article",
    Adverb: "Adverbe",
    Particle: "Particule",
    Interjection: "Interjection",
    Construct: "Construit",
    Absolute: "Absolu",
    Common: "Commun",
    Dual: "Duel",
    State: "État",
    Cohortative: "Cohortatif",
    Jussive: "Jussif",
    Optative: "Optatif",
    Demonstrative: "Démonstratif",
    Relative: "Relatif",
    Personal: "Personnel",
    Definite: "Défini",
    Indefinite: "Indéfini",
    Piel: "Pi'el",
    Hiphil: "Hif'il",
    Hophal: "Hof'al",
    Niphal: "Nif'al",
    Hithpael: "Hitpa'el",
  };

  const clean = s.replace(/\([^()]*\bhence\b[^()]*\)/g, "");

  return clean
    .split(";")
    .filter((part) => part.trim())
    .map(
      (part) =>
        "- " +
        part
          .trim()
          .replace(/\b1st\b/g, "1ʳᵉ")
          .replace(/\b[23](?:nd|rd)\b/g, (value) => value[0] + "ᵉ")
          .replace(/[A-Za-z]+/g, (word) =>
            hebrew && word === "Perfect"
              ? "Accompli"
              : hebrew && word === "Imperfect"
                ? "Inaccompli"
                : terms[word] || word,
          )
          .replace(/=/g, ": "),
    )
    .join("\n");
}

export interface ConcordanceVerse {
  book: string;
  chapter: number;
  verse: number;
  linked: number;
  stepChapter: number;
  stepVerse: number;
  forms: string;
  frequency: number;
  french: string;
  originalText: string;
}

export async function getConcordance(strong: string): Promise<ConcordanceVerse[]> {
  const base = strongBase(strong);
  const condition =
    base === strong ? `strong >= ${sql(base)} AND strong <= ${sql(base + "z")}` : `strong = ${sql(strong)}`;
  return query(`
    WITH hits AS (
      SELECT book, chapter, verse,
        GROUP_CONCAT(DISTINCT word) AS forms,
        COUNT(DISTINCT position) AS frequency
      FROM original
      WHERE (${condition})
      GROUP BY book, chapter, verse
    )
    SELECT
      h.book, COALESCE(v.chapter, h.chapter) AS chapter, COALESCE(v.verse, h.verse) AS verse,
      v.chapter IS NOT NULL AS linked, h.chapter AS stepChapter, h.verse AS stepVerse,
      h.forms, h.frequency,
      COALESCE(
        (
          SELECT f.text FROM french f
          JOIN verse_links v USING(book, chapter, verse)
          WHERE v.book = h.book AND v.step_chapter = h.chapter AND v.step_verse = h.verse
          LIMIT 1
        ), ''
      ) AS french,
      COALESCE(
        (
          SELECT GROUP_CONCAT(token, ' ')
          FROM (
            SELECT position,
              CASE WHEN MAX(
                (${condition})
              ) = 1
              THEN '**' || word || '**'
              ELSE word END AS token
            FROM original o
            WHERE o.book = h.book
            AND o.chapter = h.chapter
            AND o.verse = h.verse
            GROUP BY position, word
            ORDER BY position
          )
        ), ''
      ) AS originalText
    FROM hits h
    LEFT JOIN verse_links v ON v.book=h.book AND v.step_chapter=h.chapter AND v.step_verse=h.verse
    ORDER BY h.book, h.chapter, h.verse
  `);
}

interface LexicalArticle {
  strong: string;
  extended: string;
  lemma: string;
  gloss: string;
  transliteration: string;
  definition: string;
}

export async function getLexicalArticles(strong: string) {
  const column = strong === strongBase(strong) ? "strong" : "extended";
  return query<LexicalArticle>(`SELECT * FROM lexicon WHERE ${column}=${sql(strong)} ORDER BY extended`);
}

export interface UBSSense {
  strong: string;
  lemma: string;
  sense_id: string;
  entry_code: string;
  domain: string;
  subdomain: string;
  glosses: string;
  definition: string;
  comments: string;
  forms: string;
  refs: string;
  ai_generated: number;
  human_check: number;
  source: string;
  contextual: boolean;
  cited?: number;
  provisional?: boolean;
  marble?: boolean;
}

export async function getUBSSenses(strong: string, lemma = ""): Promise<UBSSense[]> {
  const [rows, articles] = await Promise.all([
    query<UBSSense>(
      `SELECT json_group_array(json_object(
      'strong', strong, 'lemma', lemma, 'sense_id', sense_id, 'entry_code', entry_code,
      'domain', domain, 'subdomain', subdomain, 'glosses', glosses, 'definition', definition,
      'comments', comments, 'forms', forms, 'refs', refs, 'ai_generated', ai_generated,
      'human_check', human_check, 'source', source
    )) FROM ubs_senses WHERE strong=${sql(strongBase(strong))}`,
      true,
    ),
    getLexicalArticles(strongBase(strong)),
  ]);
  return classifyUBSSenses(strong, lemma, rows, articles);
}

function referencePrefix(book: string, chapter: number, verse: number): string {
  return [bibleBooks.indexOf(book) + 1, chapter, verse].map((n) => String(n).padStart(3, "0")).join("");
}

function classifyUBSSenses(
  strong: string,
  lemma: string,
  rows: UBSSense[],
  articles: LexicalArticle[],
  context?: { word: OriginalWord; originals: OriginalWord[]; marble: { lemma: string }[] },
): UBSSense[] {
  if (!rows.length) return [];
  const exact = strong === strongBase(strong) ? articles : articles.filter((row) => row.extended === strong);
  const identity = lemma || (exact.length === 1 ? exact[0].lemma : "");
  // Keep Hebrew vowel points and shin/sin dots. Remove only cantillation and meteg.
  const normalizeLemma = (value: string) => value.normalize("NFD").replace(/[\u0591-\u05AF\u05BD]/gu, "");
  const same = (a: string, b: string) => normalizeLemma(a) === normalizeLemma(b);
  const { book: originalBook = "", native_chapter: chapter, native_verse: verse, position } = context?.word || {};
  const bookIndex = bibleBooks.indexOf(originalBook);
  const consonants = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "");
  const unpointed = (value: string) => /[\u05D0-\u05EA]/u.test(value) && !/\p{M}/u.test(value.normalize("NFD"));
  const relevant = identity
    ? rows.filter((r: UBSSense) => same(identity, r.lemma) || (unpointed(r.lemma) && consonants(identity) === r.lemma))
    : rows;
  const indistinguishable =
    identity &&
    articles.filter(
      (article: { lemma: string }) =>
        same(identity, article.lemma) ||
        (relevant.some((sense: UBSSense) => unpointed(sense.lemma)) &&
          consonants(identity) === consonants(article.lemma)),
    ).length > 1;
  const positions = new Set(
    context?.originals
      .filter((row) => strongBase(row.strong) === strongBase(strong) && same(identity, row.lemma))
      .map((row) => row.position),
  );
  const marble = context?.marble || [];
  const senses: UBSSense[] = relevant.map((r: UBSSense) => ({
    ...r,
    provisional: !!indistinguishable,
    contextual:
      (!indistinguishable || same(identity, r.lemma)) &&
      positions.size === 1 &&
      position !== undefined &&
      positions.has(position) &&
      !!identity &&
      bookIndex >= 0 &&
      chapter !== undefined &&
      verse !== undefined &&
      r.cited === 1,
  }));
  const contextual = senses.filter((r) => r.contextual);
  // MARBLE corroborates an existing UBS verse reference only where its lemma
  // identifies one original position and UBS supplies one contextual sense.
  if (contextual.length === 1 && marble.length === 1 && same(marble[0].lemma, contextual[0].lemma)) {
    contextual[0].marble = true;
  }
  return senses.sort((a, b) => Number(b.contextual) - Number(a.contextual));
}

export function cleanUBSText(text: string): string {
  return localizeReferences(
    (text || "")
      .replace(/\{L:([^<}]+)(?:<[^}]*>)?\}/g, "$1")
      .replace(/\{D:([^}]+)\}/g, "$1")
      .replace(/\{N:[^}]+\}/g, "")
      .replace(/\{R:([^}]+)\}/g, "$1")
      .replace(/\s+([,.;:])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

export interface LexicalSearchResult {
  strong: string;
  lemma: string;
  transliteration: string;
  glosses: string;
  score: number;
}

function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ").trim();
}

export async function searchLexicon(input: string, language: string = "all"): Promise<LexicalSearchResult[]> {
  const raw = input.trim();

  if (!raw) return [];

  let normalized = normalizeSearch(raw);

  const strongMatch = normalized.match(/^([gha])\s*0*(\d{1,4})([a-z]?)$/i);

  if (strongMatch) {
    normalized = strongMatch[1].toUpperCase() + strongMatch[2].padStart(4, "0") + strongMatch[3].toUpperCase();
  }

  const q = sql(normalized);
  const lowerQ = sql(normalized.toLowerCase());
  const wholeGloss = sql("|" + normalized + "|");

  const languageFilter =
    language === "G"
      ? "AND strong LIKE 'G%'"
      : language === "H"
        ? "AND strong LIKE 'H%'"
        : language === "A"
          ? "AND strong LIKE 'A%'"
          : "";

  return query(`
    SELECT
      strong,
      lemma,
      transliteration,
      glosses,

      CASE
        WHEN LOWER(strong) = ${lowerQ}
          THEN 100

        WHEN lemma_search = ${q}
          THEN 95

        WHEN translit_search = ${q}
          THEN 90

        WHEN INSTR(gloss_search, ${wholeGloss}) > 0
          THEN 85

        WHEN INSTR(
          ' ' || semantic_codes || ' ',
          ' ' || ${q} || ' '
        ) > 0
          THEN 80

        WHEN INSTR(lemma_search, ${q}) = 1
          THEN 75

        WHEN INSTR(translit_search, ${q}) = 1
          THEN 73

        WHEN INSTR(gloss_search, ${q}) = 2
          THEN 70

        WHEN INSTR(lemma_search, ${q}) > 0
          THEN 65

        WHEN INSTR(translit_search, ${q}) > 0
          THEN 60

        WHEN INSTR(gloss_search, ${q}) > 0
          THEN 50

        WHEN INSTR(definition_search, ${q}) > 0
          THEN 20

        ELSE 0
      END AS score

    FROM lexical_search

    WHERE (${
      strongMatch
        ? "LOWER(strong) = " + lowerQ
        : `
      LOWER(strong) = ${lowerQ}
      OR INSTR(lemma_search, ${q}) > 0
      OR INSTR(translit_search, ${q}) > 0
      OR INSTR(gloss_search, ${q}) > 0
      OR INSTR(definition_search, ${q}) > 0
      OR INSTR(
        ' ' || semantic_codes || ' ',
        ' ' || ${q} || ' '
      ) > 0`
    }
    )

    ${languageFilter}

    ORDER BY score DESC, strong

    LIMIT 150
  `);
}
