import sqlite3
import re
import html
from collections import Counter

db = sqlite3.connect("assets/data/bible.sqlite")

db.executescript("""
DROP TABLE IF EXISTS french_lexicon;

CREATE TABLE french_lexicon (
    strong TEXT,
    translation TEXT,
    frequency INTEGER,
    PRIMARY KEY (strong, translation)
);
""")

counts = Counter()

for (text,) in db.execute("SELECT text FROM french"):
    matches = re.findall(
        r'<w\b[^>]*strong="([^"]+)"[^>]*>(.*?)</w>',
        text,
        re.S
    )

    for codes, phrase in matches:
        phrase = html.unescape(
            re.sub(r"<[^>]+>", "", phrase)
        ).strip()

        phrase = re.sub(
            r"^[^\w]+|[^\w]+$", "", phrase
        ).lower()

        if not phrase:
            continue

        # Ignore les expressions associées
        # à plusieurs Strong distincts.
        strongs = set(
            re.findall(r"[GH]\d{4}", codes)
        )

        if len(strongs) != 1:
            continue

        strong = next(iter(strongs))
        counts[(strong, phrase)] += 1

db.executemany(
    "INSERT INTO french_lexicon VALUES (?, ?, ?)",
    [
        (strong, phrase, count)
        for (strong, phrase), count in counts.items()
    ]
)

db.execute("""
CREATE INDEX idx_french_lexicon
ON french_lexicon(strong, frequency DESC)
""")

db.commit()

print("Concordance française créée.")
print("Associations lexicales :", len(counts))

for code in ["G0236", "G3466", "H1254", "H7225"]:
    print("\n" + code)
    for row in db.execute("""
        SELECT translation, frequency
        FROM french_lexicon
        WHERE strong = ?
        ORDER BY frequency DESC
        LIMIT 10
    """, (code,)):
        print(row)

db.close()
