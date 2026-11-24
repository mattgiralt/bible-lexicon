import { Action, ActionPanel, List, Icon } from "@raycast/api";

import { useEffect, useState } from "react";

import { searchLexicon, LexicalSearchResult } from "./lexicon";

import Dictionary from "./dictionary";
import Concordance from "./concordance";

export default function Command() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("all");

  const [results, setResults] = useState<LexicalSearchResult[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!search.trim()) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const timer = setTimeout(() => {
      searchLexicon(search, language)
        .then((rows) => {
          if (!cancelled) {
            setResults(rows);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(String(e));
            setResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, language]);

  const groups = [
    { prefix: "G", title: "Grec biblique" },
    { prefix: "H", title: "Hébreu biblique" },
    { prefix: "A", title: "Araméen biblique" },
  ];

  return (
    <List
      isLoading={loading}
      searchText={search}
      onSearchTextChange={setSearch}
      searchBarPlaceholder="Mot, lemme, Strong, code sémantique…"
      filtering={false}
      navigationTitle="Recherche lexicale"
      searchBarAccessory={
        <List.Dropdown tooltip="Langue originale" value={language} onChange={setLanguage}>
          <List.Dropdown.Item title="Toutes les langues" value="all" />
          <List.Dropdown.Item title="Grec" value="G" />
          <List.Dropdown.Item title="Hébreu" value="H" />
          <List.Dropdown.Item title="Araméen (UBS)" value="A" />
        </List.Dropdown>
      }
    >
      <List.EmptyView
        icon={Icon.Book}
        title={error ? "Erreur de recherche" : search ? "Aucun résultat" : "Recherche lexicale biblique"}
        description={error || (search ? "Essaie une autre orthographe." : "Exemples : amour, logos, G26, ברית, 28.77")}
      />

      {groups.map((group) => {
        const items = results.filter((r) => r.strong.startsWith(group.prefix));

        if (!items.length) return null;

        return (
          <List.Section key={group.prefix} title={group.title} subtitle={items.length + " résultats affichés"}>
            {items.map((r) => (
              <List.Item
                key={r.strong}
                title={r.lemma.normalize("NFC")}
                subtitle={r.glosses}
                accessories={[{ text: r.transliteration }, { text: r.strong }]}
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="Afficher le dictionnaire"
                      icon={Icon.Book}
                      target={<Dictionary strong={r.strong} lemma={r.lemma} />}
                    />

                    {!r.strong.startsWith("A") && (
                      <Action.Push
                        title="Afficher la concordance"
                        icon={Icon.List}
                        shortcut={{
                          modifiers: ["cmd"],
                          key: "o",
                        }}
                        target={<Concordance strong={r.strong} lemma={r.lemma} />}
                      />
                    )}

                    <Action.CopyToClipboard title="Copier le lemme" content={r.lemma.normalize("NFC")} />

                    <Action.CopyToClipboard title="Copier le numéro Strong" content={r.strong} />

                    <Action.CopyToClipboard title="Copier la translittération" content={r.transliteration} />

                    <Action.CopyToClipboard
                      title="Copier la notice lexicale"
                      content={
                        r.lemma.normalize("NFC") +
                        " (" +
                        [r.transliteration, r.strong].filter(Boolean).join(", ") +
                        ") : " +
                        r.glosses
                      }
                    />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        );
      })}
    </List>
  );
}
