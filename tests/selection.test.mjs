import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { selectionScript, validateSelection } from "../src/selection.ts";

test("le script cible le processus de l’application source et lit le champ actif", () => {
  const attributes = { AXValue: "Jn 1.14 : la parole", AXSelectedText: "parole", AXSelectedTextRange: [13, 6] };
  const element = { attributes: { byName: (key) => ({ value: () => attributes[key] }) } };
  const Application = () => ({
    applicationProcesses: {
      whose(filter) {
        assert.equal(filter.bundleIdentifier, "com.apple.TextEdit");
        return () => [{ attributes: { byName: () => ({ value: () => element }) } }];
      },
    },
  });
  const selection = JSON.parse(
    runInNewContext(selectionScript({ name: "TextEdit", bundleId: "com.apple.TextEdit" }), { Application }),
  );
  assert.deepEqual(validateSelection(selection), { text: attributes.AXValue, selected: "parole", pos: 13 });
});

test("une occurrence répétée conserve sa position et un champ incomplet est refusé", () => {
  assert.equal(validateSelection({ text: "terre terre", selected: "terre", range: [6, 5] })?.pos, 6);
  assert.equal(validateSelection({ text: "terre terre", selected: "terre", range: [5, 5] }), undefined);
  assert.equal(validateSelection({ selected: "terre" }), undefined);
});

test("System Events expose la sélection Byword avec des bornes inclusives numérotées à partir de 1", () => {
  const text = "terre ".repeat(44) + "et par le péché la mort";
  const pos = text.indexOf("péché");
  assert.deepEqual(validateSelection({ text, selected: "péché", range: [pos + 1, pos + 5] }), {
    text,
    selected: "péché",
    pos,
  });
  assert.equal(validateSelection({ text, selected: "péché", range: [pos + 1, pos + 6] }), undefined);
});

test("une citation Byword avec un numéro collé au deux-points conserve le second mot répété", async () => {
  const { readCitation } = await import("../src/citation.ts");
  const text =
    "Jn 3.16 (LSG):16 Car Dieu a tant aimé le monde.\n\nRm 5.12 (LSG):12 C’est pourquoi, comme par un seul homme le péché est entré dans le monde, et par le péché la mort.";
  const selection = validateSelection({ text, selected: "péché", range: [text.lastIndexOf("péché"), 5] });
  assert.ok(selection);
  const citation = readCitation(selection);
  assert.deepEqual([citation.book, citation.chapter, citation.verse, citation.version], ["Rm", 5, 12, "LSG"]);
  assert.equal(citation.verseText.trimStart().startsWith("C’est pourquoi"), true);
  assert.equal(citation.offset, citation.verseText.lastIndexOf("péché"));
});
