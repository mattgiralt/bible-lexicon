import { formatUBSReferences, localizeReferences } from "./references";
import { cleanUBSText } from "./lexicon";
import { Detail, ActionPanel, Action } from "@raycast/api";

import { useEffect, useState } from "react";

import { getLexicalArticles, getUBSSenses } from "./lexicon";

function htmlToMarkdown(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n\n")
    .replace(/<b>(.*?)<\/b>/gis, "**$1**")
    .replace(/<i>(.*?)<\/i>/gis, "*$1*")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/__(?=\d)/g, "\n\n");
}

export default function Dictionary({ strong, lemma }: { strong: string; lemma: string }) {
  const [markdown, setMarkdown] = useState("Chargement du dictionnaire…");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUBSSenses(strong, lemma), getLexicalArticles(strong)])
      .then(([ubs, step]) => {
        const french = ubs.map((r, i) => {
          let text = "### " + (i + 1) + ". " + (r.glosses || r.lemma) + "\n\n";

          if (r.definition) {
            text += cleanUBSText(r.definition) + "\n\n";
          }

          if (r.domain) {
            text += "**Domaine:** " + r.domain + "\n\n";
          }

          if (r.subdomain) {
            text += "**Sous-domaine:** " + r.subdomain + "\n\n";
          }

          if (r.entry_code) {
            text += "**Code sémantique:** " + r.entry_code + "\n\n";
          }

          if (r.forms) {
            text += "**Formes:** " + r.forms + "\n\n";
          }

          if (r.comments) {
            text += "**Commentaires:** " + cleanUBSText(r.comments) + "\n\n";
          }

          const refs = formatUBSReferences(r.refs);

          if (refs) {
            text += "**Références bibliques:** " + refs + "\n\n";
          }

          if (r.ai_generated || r.human_check) {
            text +=
              "> Attention: " +
              (r.ai_generated ? "Définition générée par IA. " : "") +
              (r.human_check ? "Vérification humaine recommandée." : "") +
              "\n\n";
          }

          return text;
        });

        const english = step.map(
          (r) =>
            "### " +
            r.lemma +
            "\n\n*" +
            r.transliteration +
            "*" +
            "\n\n**Strong:** " +
            r.extended +
            "\n\n**Sens:** " +
            r.gloss +
            "\n\n" +
            localizeReferences(htmlToMarkdown(r.definition || "")),
        );

        setMarkdown(
          "# " +
            lemma +
            "\n\n**Strong:** " +
            strong +
            "\n\n## Dictionnaire français — UBS\n\n" +
            (ubs.some((r) => r.provisional) ? "> Sens du Strong de base. L’homonyme précis reste incertain.\n\n" : "") +
            (french.length ? french.join("\n\n---\n\n") : "Aucune définition française disponible.") +
            "\n\n" +
            (ubs.length ? "*Source: " + ubs[0].source + " — CC BY-SA 4.0.*" : "") +
            "\n\n---\n\n" +
            "## Dictionnaire anglais — STEP\n\n" +
            (english.length ? english.join("\n\n---\n\n") : "Aucun article STEP disponible.") +
            "\n\n*Source: STEPBible.org — CC BY 4.0.*",
        );
      })
      .catch((e) => setMarkdown("# Erreur\n\n" + String(e)))
      .finally(() => setLoading(false));
  }, [strong, lemma]);

  return (
    <Detail
      isLoading={loading}
      navigationTitle={lemma + " · Dictionnaire"}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copier l'article lexical" content={markdown} />
          <Action.CopyToClipboard title="Copier le lemme" content={lemma} />
        </ActionPanel>
      }
    />
  );
}
