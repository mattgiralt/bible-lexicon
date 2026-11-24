import { bibleBooks, formatReference } from "./references";
import { Action, ActionPanel, List } from "@raycast/api";

import { useEffect, useState } from "react";

import { getConcordance, ConcordanceVerse } from "./lexicon";

function formatFrench(text: string, strong: string): string {
  const base = strong.slice(0, 5);

  return text
    .replace(/<w\b[^>]*strong="([^"]+)"[^>]*>(.*?)<\/w>/gs, (_, codes: string, word: string) =>
      codes.split(/\s+/).some((c) => c === strong || (strong === base && c.slice(0, 5) === base)) && word.trim()
        ? "**" + word + "**"
        : word,
    )
    .replace(/<[^>]*>/g, "");
}

export default function Concordance({ strong, lemma }: { strong: string; lemma: string }) {
  const [verses, setVerses] = useState<ConcordanceVerse[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getConcordance(strong)
      .then((rows) => {
        rows.sort((a, b) => {
          const ai = bibleBooks.indexOf(a.book);
          const bi = bibleBooks.indexOf(b.book);

          return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.chapter - b.chapter || a.verse - b.verse;
        });

        setVerses(rows);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [strong]);

  const total = verses.reduce((sum, v) => sum + v.frequency, 0);

  return (
    <List
      isLoading={loading}
      isShowingDetail={true}
      navigationTitle={lemma + " · " + strong}
      searchBarPlaceholder="Rechercher un verset ou un mot…"
    >
      <List.EmptyView title={error || "Aucun résultat"} />

      <List.Section title={lemma + " · " + strong} subtitle={total + " occurrences · " + verses.length + " versets"}>
        {verses.map((v) => {
          const ref = formatReference(v.book, v.chapter, v.verse) + (v.linked ? "" : " (STEP)");

          const french = formatFrench(v.french, strong);

          const original = v.originalText.replace(/[\/\\]/g, "").normalize("NFC");

          return (
            <List.Item
              key={ref}
              title={ref}
              keywords={[french.replace(/\*\*/g, ""), v.forms]}
              accessories={[{ text: String(v.frequency) }]}
              detail={
                <List.Item.Detail
                  markdown={
                    "# " +
                    ref +
                    "\n\n### Segond 1910\n\n" +
                    (french || "Texte indisponible.") +
                    "\n\n### Texte original\n\n" +
                    original +
                    "\n\n**Forme(s) :** " +
                    v.forms +
                    "\n\n**Strong :** " +
                    strong +
                    "\n\nSources : Segond 1910 annotée ; " +
                    "Tyndale House et STEPBible.org (CC BY 4.0). [Données STEP](https://github.com/STEPBible/STEPBible-Data)."
                  }
                />
              }
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard
                    title="Copier le verset français"
                    content={ref + " : " + french.replace(/\*\*/g, "")}
                  />
                  <Action.CopyToClipboard title="Copier le texte original" content={original.replace(/\*\*/g, "")} />
                  <Action.CopyToClipboard title="Copier la référence" content={ref} />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
