import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const assets = fileURLToPath(new URL("../assets", import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@raycast/api") {
      return {
        url:
          "data:text/javascript," +
          encodeURIComponent("export const environment = " + JSON.stringify({ assetsPath: assets })),
        shortCircuit: true,
      };
    }
    if (/^\.\/[\w-]+$/.test(specifier)) return next(specifier + ".ts", context);
    return next(specifier, context);
  },
});
const { alignSelection, alignWords } = await import("../src/alignment.ts");
const { bookCode, formatReference, formatUBSReferences } = await import("../src/references.ts");
const { getConcordance, getLexicalArticles, getUBSSenses, lookup, searchLexicon, morphologyCodes } =
  await import("../src/lexicon.ts");

test("les substitutions et les répétitions ambiguës ne sont pas alignées", () => {
  assert.equal(alignWords(["Dieu", "fit", "la", "terre"], ["Dieu", "créa", "la", "terre"]).has(1), false);
  assert.equal(alignWords(["terre"], ["terre", "terre"]).size, 0);
  assert.equal(alignSelection("l’autre", 0, "l’autre", '<w strong="H0001">l’autre</w>'), undefined);
});

test("le décalage AX sélectionne la bonne occurrence et conserve les mots non annotés", () => {
  const text = "la terre sur la terre";
  const tagged = 'la <w strong="H0776">terre</w> sur la <w strong="H0127">terre</w>';
  assert.deepEqual(alignSelection(text, 16, "terre", tagged)?.codes, ["H0127"]);
  assert.deepEqual(alignSelection(text, 0, "la", tagged)?.codes, []);
});

test("les références utilisent les noms français et le canon UBS", () => {
  assert.equal(bookCode("Joël"), "Jol");
  assert.equal(formatReference("Ezra", 1, 1), "Esd 1.1");
  assert.equal(formatUBSReferences('["04300100100010"]'), "Jn 1.1");
});

test("la versification restaure le titre du Ps 3 et Jl 3.1", async () => {
  const title = await lookup("Ps", 3, 1, "", "", 0);
  assert.ok(title.entries.some((row) => row.strong.startsWith("H4210")));
  const joel = await lookup("Jl", 3, 1, "", "", 0);
  assert.ok(joel.entries.some((row) => row.strong.startsWith("H8210")));
  const absent = await lookup("Ac", 19, 41, "", "", 0);
  assert.deepEqual(absent.entries, []);
});

test("STEP et la concordance isolent les Strong étendus", async () => {
  const rows = await getLexicalArticles("H1254B");
  assert.ok((await getUBSSenses("H1254B")).some((row) => row.provisional && row.ai_generated));
  assert.deepEqual(
    rows.map((row) => row.extended),
    ["H1254B"],
  );
  assert.match(rows[0].gloss, /fatten/);
  const occurrences = await getConcordance("H1254B");
  assert.ok(occurrences.length > 0);
  assert.ok(!occurrences.some((row) => row.book === "Gen" && row.chapter === 1 && row.verse === 1));
  assert.deepEqual(
    (await searchLexicon("h 1254b")).map((row) => row.strong),
    ["H1254B"],
  );
  assert.equal((await searchLexicon("λόγος"))[0].lemma.normalize("NFC"), "λόγος");
});

test("la morphologie segmentée et le sens contextualisé viennent des sources", async () => {
  assert.deepEqual(morphologyCodes("HR/Ncfsa", true), ["HR", "HNcfsa"]);
  assert.deepEqual(morphologyCodes("AR/Ncmsa", true), ["AR", "ANcmsa"]);
  assert.deepEqual(morphologyCodes("A-NSM", false), ["A-NSM"]);
  const text = "Au commencement, Dieu créa les cieux et la terre.";
  const result = await lookup("Gn", 1, 1, "commencement", text, 3);
  assert.equal(result.matched, true);
  assert.match(result.entries[0].morphology, /Preposition.*Noun/);
  assert.ok(result.entries[0].ubsSenses.some((row) => row.contextual && row.marble));
  const creation = await lookup("Gn", 1, 1, "créa", text, text.indexOf("créa"));
  assert.ok(creation.entries[0].ubsSenses.some((row) => row.ai_generated && row.human_check && row.provisional));
  assert.ok(!creation.entries[0].ubsSenses.some((row) => row.contextual));
});

test("un nom grec garde son analyse STEP et les répétitions restent indéterminées", async () => {
  const verse = "La Parole a été faite chair, et elle a habité parmi nous.";
  const result = await lookup("Jn", 1, 14, "", verse, 0);
  const logos = result.entries.find((row) => row.strong === "G3056");
  assert.ok(logos);
  assert.equal(logos.morph, "N-NSM");
  assert.match(logos.morphology, /Noun.*Nominative/);
  assert.ok(logos.ubsSenses.some((row) => row.contextual && row.entry_code === "33.100"));

  const repeated = await lookup("Jn", 1, 1, "", "", 0);
  const forms = repeated.entries.filter((row) => row.strong === "G3056");
  assert.ok(forms.length > 0);
  assert.ok(forms.every((row) => row.ubsSenses.every((sense) => !sense.contextual)));
});

test("Jean 6.39 en fin de citation permet de rechercher « ressuscite »", async () => {
  const { readCitation } = await import("../src/citation.ts");
  const text =
    "Jésus affirme : « Or, la volonté de celui qui m’a envoyé, c’est que je ne perde rien de tout ce qu’il m’a donné, mais que je le ressuscite au dernier jour. » (Jn 6.39)";
  const selected = "ressuscite";
  const c = readCitation({ text, selected, pos: text.indexOf(selected) });
  const result = await lookup(c.book, c.chapter, c.verse, selected, c.verseText, c.offset);
  assert.ok(result.matched);
  assert.equal(result.entries[0].strong.slice(0, 5), "G0450");
});
