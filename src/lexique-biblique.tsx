import { readCitation } from "./citation";
import { formatReference } from "./references";
import { cleanUBSText } from "./lexicon";
import Dictionary from "./dictionary";
import Concordance from "./concordance";
import { lookup, frenchMorphology } from "./lexicon";
import { Action, ActionPanel, Detail, getFrontmostApplication } from "@raycast/api";
import { useEffect, useState } from "react";
import { readSelection } from "./selection";

export default function Command() {
  const [markdown, setMarkdown] = useState("Analyse...");
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    async function run() {
      try {
        const { selected, text, pos } = await readSelection(await getFrontmostApplication());

        const { book, chapter, verse, version, verseText, offset } = readCitation({ selected, text, pos });
        const reference = formatReference(book, chapter, verse);
        const result = await lookup(book, chapter, verse, selected, verseText, offset);
        setEntries(result.entries);

        const status = result.matched
          ? "Correspondance probable via la Segond 1910. Sa numérotation doit correspondre à celle de la citation."
          : result.ambiguous
            ? "Plusieurs formes ou analyses peuvent correspondre à la sélection."
            : result.entries.length
              ? "Correspondance incertaine. Voici les formes originales du verset lié à la Segond 1910."
              : "Aucun lien de versification fiable trouvé pour cette référence.";

        const highlight = (text: string, word: string) => {
          const index = offset;
          if (index === -1) return text;

          return text.slice(0, index) + "**" + word + "**" + text.slice(index + word.length);
        };

        const renderUBS = (r: any): string => {
          const senses = r.ubsSenses || [];

          if (!senses.length) {
            return "";
          }

          const contextual = senses.filter((x: any) => x.contextual);

          const selectedSenses = contextual.length ? contextual : senses.slice(0, 3);

          const heading = contextual.length
            ? "### Sens signalés pour le verset (UBS)\n\n"
            : senses.some((x: any) => x.provisional)
              ? "### Sens UBS du Strong de base · homonymie incertaine\n\n"
              : "### Sens généraux (UBS)\n\n";

          return (
            heading +
            selectedSenses
              .map((x: any) => {
                let content =
                  (x.glosses ? "**" + x.glosses + "**\n\n" : "") +
                  cleanUBSText(x.definition) +
                  (x.contextual && x.provisional
                    ? "\n\n*UBS cite ce verset sous le Strong de base. La correspondance entre les subdivisions UBS et STEP reste incertaine.*"
                    : "") +
                  (x.marble ? "\n\n*Occurrence également indexée par UBS MARBLE (WLC).*" : "") +
                  "\n\n";

                if (x.domain) {
                  content += "*Domaine :* " + x.domain + (x.subdomain ? " — " + x.subdomain : "") + "\n\n";
                }

                if (x.entry_code) {
                  content += "*Code sémantique :* " + x.entry_code + "\n\n";
                }

                if (x.ai_generated || x.human_check) {
                  content +=
                    "> Attention : " +
                    (x.ai_generated ? "définition signalée comme générée par IA. " : "") +
                    (x.human_check ? "Vérification humaine recommandée par UBS." : "") +
                    "\n\n";
                }

                return content;
              })
              .join("\n\n") +
            "*Source : " +
            selectedSenses[0].source +
            "*\n\n"
          );
        };

        const details = result.entries.map(
          (r: any) =>
            "# " +
            r.word +
            "\n\n" +
            "*" +
            r.transliteration +
            "*\n\n" +
            renderUBS(r) +
            "### Traductions bibliques (LSG, Strong de base)\n\n" +
            (r.translations?.length
              ? r.translations.map((t: any) => t.translation + " (" + t.frequency + ")").join(", ")
              : "Aucune traduction indexée.") +
            "\n\n" +
            "**Sens lexical (STEP) :** " +
            r.definition +
            "\n\n" +
            (result.entries.length > 1
              ? "**Lemme :** " +
                r.lemma +
                "\n\n" +
                "**Strong :** " +
                r.strong +
                "\n\n" +
                frenchMorphology(r.morphology, r.strong.startsWith("H"))
              : "") +
            (r.occurrences > 1 ? "\n\n**Occurrences :** " + r.occurrences : ""),
        );

        setMarkdown(
          "**" +
            selected +
            " · " +
            reference +
            " — " +
            version +
            "**\n\n> " +
            status +
            "\n\n" +
            (details.length ? details.join("\n\n---\n\n") : "Aucune donnée originale trouvée.") +
            "\n\n### Contexte biblique\n\n" +
            "> " +
            highlight(verseText, selected) +
            "\n\n### Texte original\n\n" +
            (result.originalVerse || "Texte original indisponible.") +
            "\n\nSources : Segond 1910 annotée ; " +
            "Tyndale House et STEPBible.org (CC BY 4.0). [Données STEP](https://github.com/STEPBible/STEPBible-Data).",
        );
      } catch (error) {
        setMarkdown("# Erreur\n\n" + String(error));
      } finally {
        setLoading(false);
      }
    }

    run();
  }, []);

  return (
    <Detail
      isLoading={loading}
      markdown={markdown}
      metadata={
        entries.length === 1 ? (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Lemme" text={entries[0].lemma || "Non disponible"} />
            <Detail.Metadata.Label title="Strong" text={entries[0].strong} />

            <Detail.Metadata.Separator />
            {frenchMorphology(entries[0].morphology, entries[0].strong.startsWith("H"))
              .split("\n")
              .map((line, i) => {
                const clean = line.replace(/^- /, "");
                const index = clean.indexOf(": ");
                return (
                  <Detail.Metadata.Label
                    key={i}
                    title={index >= 0 ? clean.slice(0, index) : "Analyse"}
                    text={index >= 0 ? clean.slice(index + 2) : clean}
                  />
                );
              })}
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label title="Code morphologique" text={entries[0].morph} />
            <Detail.Metadata.Label title="Occurrences" text={String(entries[0].occurrences || 1)} />
            <Detail.Metadata.Label title="Édition" text={entries[0].strong.startsWith("G") ? "NA28" : "STEP Hebrew"} />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
          {entries.map((r, i) => (
            <ActionPanel.Section key={i} title={r.word}>
              <Action.Push
                title="Afficher la concordance"
                shortcut={{
                  modifiers: ["cmd"],
                  key: "o",
                }}
                target={<Concordance strong={r.strong} lemma={r.lemma || r.word} />}
              />
              <Action.Push
                title="Afficher le dictionnaire"
                shortcut={{
                  modifiers: ["cmd"],
                  key: "d",
                }}
                target={<Dictionary strong={r.strong} lemma={r.lemma || r.word} />}
              />
              <Action.CopyToClipboard title={"Copier " + r.word} content={r.word} />
              <Action.CopyToClipboard title={"Copier le lemme " + r.lemma} content={r.lemma} />
              <Action.CopyToClipboard title={"Copier Strong " + r.strong} content={r.strong} />
              <Action.CopyToClipboard
                title="Copier la notice lexicale"
                content={
                  (r.lemma || r.word) +
                  " (" +
                  r.strong +
                  ") : " +
                  (r.translations?.length
                    ? r.translations
                        .map((t: any) => t.translation)
                        .slice(0, 5)
                        .join(", ")
                    : r.definition)
                }
              />
              <Action.CopyToClipboard title="Copier la translittération" content={r.transliteration} />
            </ActionPanel.Section>
          ))}
        </ActionPanel>
      }
    />
  );
}
