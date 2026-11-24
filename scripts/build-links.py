"""Relate the actual LSG corpus to STEP without equating verse numbers across traditions."""

from collections import Counter, defaultdict
import json
from pathlib import Path
import re
import sqlite3
import unicodedata

root = Path("assets/data")
db = sqlite3.connect(root / "bible.sqlite")
hebrew_books = set("Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal".split())
strong = re.compile(r"[GH]\d{4}")
alternates = defaultdict(set)
for book, ch, v, other_ch, other_v in db.execute("SELECT * FROM step_references"):
    alternates[book, ch, v].add((book, other_ch, other_v))

original_codes = defaultdict(set)
for book, ch, v, code in db.execute("SELECT DISTINCT book, chapter, verse, strong FROM original"):
    if match := strong.match(code):
        original_codes[book, ch, v].add(match[0])

options = defaultdict(set)
for reference in original_codes:
    options[reference].add(reference)
    for alternate in alternates[reference]:
        options[alternate].add(reference)

links = []
for book, ch, v, text in db.execute("SELECT * FROM french"):
    ref = (book, ch, v)
    tags = {code for attr in re.findall(r'strong="([^"]+)"', text) for code in strong.findall(attr)}
    if not tags:
        continue
    scores = sorted(
        ((len(tags & original_codes[candidate]), candidate) for candidate in options[ref]),
        reverse=True,
    )
    if not scores or not scores[0][0]:
        continue
    score, chosen = scores[0]
    if len(scores) > 1 and (score < 2 or score - scores[1][0] < 2):
        continue
    # Require substantial annotation overlap when STEP records a numbering difference.
    if (len(scores) > 1 or chosen != ref or alternates[chosen]) and score * 2 < len(tags):
        continue
    native = alternates[chosen] if book in hebrew_books and alternates[chosen] else {chosen}
    if len(native) != 1:
        continue
    _, native_ch, native_v = next(iter(native))
    links.append((*ref, chosen[1], chosen[2], native_ch, native_v))

# A split or merged verse must not appear twice in a concordance.
step_count = Counter((row[0], row[3], row[4]) for row in links)
links = [row for row in links if step_count[row[0], row[3], row[4]] == 1]

def lemma_key(lemma):
    return re.sub(r"[\u0591-\u05af\u05bd]", "", unicodedata.normalize("NFD", lemma))

# Compare WLC and STEP in native Hebrew coordinates. Require a unique lemma
# on each side and agreement on the word position as independent evidence.
step_words = defaultdict(set)
for book, ch, v, pos, lemma in db.execute(
    "SELECT book, chapter, verse, position, lemma FROM original WHERE lemma != '' AND strong LIKE 'H%'"
):
    ref = (book, ch, v)
    native_refs = alternates[ref] or {ref}
    if len(native_refs) == 1:
        step_words[(*next(iter(native_refs)), lemma_key(lemma))].add(pos)

marble_words = defaultdict(set)
for path in sorted((root / "ubs/index/WLC/JSON").glob("MARBLELinks-*.json")):
    book = next((code for code in hebrew_books if code.upper() == path.stem.split("-")[-1]), None)
    if not book:
        continue
    for item in json.loads(path.read_text(encoding="utf-8-sig")):
        match = re.fullmatch(r"o\d{2}(\d{3})(\d{3})(\d{3})\d", item["ID"])
        if not match:
            continue
        ch, v, pos = map(int, match.groups())
        for link in item["LexicalLinks"]:
            fields = link.split(":", 3)
            if len(fields) == 4 and fields[0] == "SDBH":
                _, lemma, sense, _ = fields
                marble_words[book, ch, v, lemma_key(lemma)].add((pos, lemma, sense))

marble = []
for key, hits in marble_words.items():
    if len(hits) == 1:
        pos, lemma, sense = next(iter(hits))
        if step_words[key] == {pos}:
            marble.append((*key[:3], pos, lemma, sense))

with db:
    db.execute("DROP TABLE IF EXISTS verse_links")
    db.execute("DROP TABLE IF EXISTS marble")
    db.execute("""CREATE TABLE verse_links (
        book TEXT, chapter INTEGER, verse INTEGER, step_chapter INTEGER, step_verse INTEGER,
        native_chapter INTEGER, native_verse INTEGER,
        PRIMARY KEY (book, chapter, verse), UNIQUE (book, step_chapter, step_verse)
    )""")
    db.execute("""CREATE TABLE marble (
        book TEXT, chapter INTEGER, verse INTEGER, position INTEGER, lemma TEXT, sense TEXT,
        PRIMARY KEY (book, chapter, verse, position, lemma, sense)
    )""")
    db.executemany("INSERT INTO verse_links VALUES (?,?,?,?,?,?,?)", links)
    db.executemany("INSERT OR IGNORE INTO marble VALUES (?,?,?,?,?,?)", marble)
print(f"{len(links):,} liens LSG–STEP ; {len(marble):,} liens lexicaux MARBLE contrôlés")
