import sqlite3
import unicodedata
import re
from collections import defaultdict

db = sqlite3.connect("assets/data/bible.sqlite")

def normalize(text):
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(
        c for c in text
        if not unicodedata.category(c).startswith("M")
    )
    return text.lower().replace("ς", "σ")

entries = defaultdict(lambda: {
    "lemmas": [],
    "transliterations": [],
    "glosses": [],
    "definitions": [],
    "codes": []
})

def add(target, value):
    if value and value not in target:
        target.append(value)

for strong, lemma, translit, gloss in db.execute("""
    SELECT extended, lemma, transliteration, gloss
    FROM lexicon
"""):
    e = entries[strong]
    add(e["lemmas"], lemma)
    add(e["transliterations"], translit)

for strong, lemma, gloss, definition, code in db.execute("""
    SELECT strong, lemma, glosses, definition, entry_code
    FROM ubs_senses
"""):
    e = entries[strong]
    add(e["lemmas"], lemma)
    add(e["glosses"], gloss)
    add(e["definitions"], definition)
    add(e["codes"], code)

for strong, lemma, translit in db.execute("""
    SELECT strong, lemma, transliteration
    FROM original
    WHERE lemma IS NOT NULL AND lemma != ''
    GROUP BY strong, lemma
"""):
    m = re.match(r"[GH]\d{4}", strong)

    if not m:
        continue

    e = entries[strong]
    add(e["lemmas"], lemma)
    add(entries[m.group()]["lemmas"], lemma)

for strong, translation, frequency in db.execute("""
    SELECT strong, translation, frequency
    FROM french_lexicon
    WHERE frequency >= 2
    ORDER BY frequency DESC
"""):
    e = entries[strong]

    if len(e["glosses"]) < 20:
        add(e["glosses"], translation)

db.executescript("""
DROP TABLE IF EXISTS lexical_search;

CREATE TABLE lexical_search (
    strong TEXT PRIMARY KEY,
    lemma TEXT,
    transliteration TEXT,
    glosses TEXT,
    lemma_search TEXT,
    translit_search TEXT,
    gloss_search TEXT,
    definition_search TEXT,
    semantic_codes TEXT
);
""")

rows = []

for strong, e in entries.items():
    lemmas = e["lemmas"]
    translits = e["transliterations"]
    glosses = e["glosses"]

    rows.append((
        strong,
        lemmas[0] if lemmas else strong,
        translits[0] if translits else "",
        ", ".join(glosses[:5]),
        normalize(" ".join(lemmas)),
        normalize(" ".join(translits)),
        "|" + "|".join(normalize(part.strip()) for gloss in glosses for part in re.split(r"[,;]", gloss)) + "|",
        normalize(" ".join(e["definitions"])),
        " ".join(e["codes"])
    ))

db.executemany("""
INSERT INTO lexical_search VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?
)
""", rows)

db.commit()

print("Index lexical créé.")
print("Entrées indexées :", len(rows))

db.close()
