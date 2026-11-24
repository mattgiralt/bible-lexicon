import sqlite3
import csv
import re
from pathlib import Path

root = Path("assets/data")
step = root / "step"
db = sqlite3.connect(root / "bible.sqlite")

db.executescript("""
DROP TABLE IF EXISTS french;
DROP TABLE IF EXISTS original;
DROP TABLE IF EXISTS lexicon;
DROP TABLE IF EXISTS morphology;
DROP TABLE IF EXISTS step_references;

CREATE TABLE french (
    book TEXT,
    chapter INTEGER,
    verse INTEGER,
    text TEXT,
    PRIMARY KEY (book, chapter, verse)
);

CREATE TABLE original (
    book TEXT,
    chapter INTEGER,
    verse INTEGER,
    position INTEGER,
    word TEXT,
    transliteration TEXT,
    gloss TEXT,
    strong TEXT,
    morph TEXT,
    lemma TEXT,
    edition TEXT
);

CREATE TABLE step_references (
    book TEXT, chapter INTEGER, verse INTEGER, other_chapter INTEGER, other_verse INTEGER,
    PRIMARY KEY (book, chapter, verse, other_chapter, other_verse)
);

CREATE TABLE lexicon (
    strong TEXT,
    extended TEXT,
    lemma TEXT,
    transliteration TEXT,
    grammar TEXT,
    gloss TEXT,
    definition TEXT
);

CREATE TABLE morphology (
    language TEXT,
    code TEXT,
    description TEXT,
    PRIMARY KEY (language, code)
);
""")

books = {
    "Exod": "Exo", "Deut": "Deu",
    "Josh": "Jos", "Judg": "Jdg",
    "Ruth": "Rut", "1Sam": "1Sa",
    "2Sam": "2Sa", "1Kgs": "1Ki",
    "2Kgs": "2Ki", "1Chr": "1Ch",
    "2Chr": "2Ch", "Esth": "Est",
    "Ps": "Psa", "Prov": "Pro",
    "Eccl": "Ecc", "Song": "Sng",
    "Ezek": "Ezk", "Obad": "Oba",
    "Jonah": "Jon", "Nah": "Nam",
    "Zeph": "Zep", "Zech": "Zec",
    "Matt": "Mat", "Mark": "Mrk",
    "Luke": "Luk", "John": "Jhn",
    "Acts": "Act", "1Cor": "1Co",
    "2Cor": "2Co", "Phil": "Php",
    "1Thess": "1Th", "2Thess": "2Th",
    "1Tim": "1Ti", "2Tim": "2Ti",
    "Titus": "Tit", "Phlm": "Phm",
    "Jas": "Jas", "1Pet": "1Pe",
    "2Pet": "2Pe", "1John": "1Jn",
    "2John": "2Jn", "3John": "3Jn",
    "Jude": "Jud", "Ezra": "Ezr", "Joel": "Jol", "Amos": "Amo", "Jam": "Jas"
}

print("Importation Segond 1910...")

with open(root / "segond1910.csv",
          encoding="utf-8-sig") as f:
    reader = csv.DictReader(f, delimiter="\t")
    db.executemany(
        "INSERT INTO french VALUES (?, ?, ?, ?)",
        (
            (books.get(r["book_id"], r["book_id"]),
             int(r["num_chapter"]),
             int(r["num_verse"]),
             r["text"])
            for r in reader
        )
    )

print("Importation des textes originaux...")

folder = step / "Translators Amalgamated OT+NT"

for path in sorted(folder.glob("TA*.txt")):
    greek = path.name.startswith("TAGNT")
    hebrew = path.name.startswith("TAHOT")
    if not greek and not hebrew:
        continue

    print(path.name[:30])
    rows = []
    references = set()

    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            c = line.rstrip("\r\n").split("\t")

            m = re.match(
                r"^(\w+)\.(\d+)\.(\d+)(?:[([](\d+)\.(\d+)[)\]])?#(\d+)",
                c[0]
            )

            if not m or len(c) < 6:
                continue

            book, ch, vs, other_ch, other_vs, pos = m.groups()
            book = books.get(book, book)

            if other_ch and (not greek or "NA28" in c[5]):
                references.add((book, int(ch), int(vs), int(other_ch), int(other_vs)))

            if greek:
                form = re.match(
                    r"^(.*?)\s*\((.*?)\)", c[1]
                )
                word = form.group(1) if form else c[1]
                translit = form.group(2) if form else ""
                strong, _, morph = c[3].partition("=")
                lemma, _, gloss = c[4].partition("=")
                edition = c[5]

                if "NA28" not in edition:
                    continue

                rows.append((
                    book, int(ch), int(vs), int(pos),
                    word, translit, gloss or c[2],
                    strong, morph, lemma, edition
                ))

            else:
                word, translit, gloss = c[1:4]
                strong_field, morph = c[4:6]
                codes = re.findall(
                    r"H\d{4}[A-Za-z]*",
                    strong_field
                )

                for strong in dict.fromkeys(codes):
                    lemma_match = re.search(
                        re.escape(strong) + r"=([^=\t{}]+)=",
                        "\t".join(c[6:])
                    )
                    lemma = (
                        lemma_match.group(1)
                        if lemma_match else ""
                    )

                    rows.append((
                        book, int(ch), int(vs), int(pos),
                        word, translit, gloss,
                        strong, morph, lemma, "STEP Hebrew"
                    ))

    db.executemany("INSERT OR IGNORE INTO step_references VALUES (?,?,?,?,?)", references)
    db.executemany(
        "INSERT INTO original VALUES "
        "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rows
    )

print("Importation des lexiques...")

for pattern in ["TBESG*", "TBESH*"]:
    for path in (step / "Lexicons").glob(pattern):
        rows = []

        with open(path, encoding="utf-8-sig") as f:
            for line in f:
                c = line.rstrip("\r\n").split("\t")

                if len(c) < 8:
                    continue

                if not re.fullmatch(r"[GH]\d{4}[A-Za-z]*", c[0]):
                    continue

                extended = c[1].split()[0]
                if not re.fullmatch(r"[GH]\d{4}[A-Za-z]*", extended):
                    continue

                rows.append((
                    c[0][:5], extended, c[3], c[4],
                    c[5], c[6], c[7]
                ))

        db.executemany(
            "INSERT INTO lexicon VALUES (?, ?, ?, ?, ?, ?, ?)",
            rows
        )

print("Importation des analyses morphologiques...")

for pattern, lang in [("TEGMC*", "G"), ("TEHMC*", "H")]:
    for path in (step / "Morphology codes").glob(pattern):
        with open(path, encoding="utf-8-sig") as f:
            for line in f:
                c = line.rstrip("\r\n").split("\t")

                if len(c) >= 2 and "Function=" in c[1]:
                    db.execute(
                        "INSERT OR IGNORE INTO morphology VALUES (?, ?, ?)",
                        (lang, c[0], c[1])
                    )

print("Création des index...")

db.executescript("""
CREATE INDEX idx_original_ref
ON original(book, chapter, verse);

CREATE INDEX idx_original_strong
ON original(strong);

CREATE INDEX idx_lexicon_strong
ON lexicon(strong);

CREATE INDEX idx_lexicon_extended
ON lexicon(extended);
""")

db.commit()

for table in ["french", "original", "lexicon", "morphology"]:
    count = db.execute(
        f"SELECT COUNT(*) FROM {table}"
    ).fetchone()[0]
    print(f"{table}: {count:,} entrées")

db.close()
print("Base SQLite créée.")
