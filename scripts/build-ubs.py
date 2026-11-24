import json
import sqlite3
import re
from pathlib import Path

root = Path("assets/data/ubs/dictionaries")
db = sqlite3.connect("assets/data/bible.sqlite")

db.executescript("""
DROP TABLE IF EXISTS ubs_senses;

CREATE TABLE ubs_senses (
    strong TEXT,
    lemma TEXT,
    sense_id TEXT,
    entry_code TEXT,
    domain TEXT,
    subdomain TEXT,
    glosses TEXT,
    definition TEXT,
    comments TEXT,
    forms TEXT,
    refs TEXT,
    ai_generated INTEGER,
    human_check INTEGER,
    source TEXT
);
""")

sources = [
    (
        root / "greek/JSON/UBSGreekNTDic-v1.01-fr.JSON",
        "UBS Greek NT Dictionary v1.01"
    ),
    (
        root / "hebrew/JSON/UBSHebrewDic-v0.9.4-fr.JSON",
        "UBS Hebrew Dictionary v0.9.4"
    )
]

def join_strings(items):
    return ", ".join(
        str(x) for x in (items or []) if x
    )

def domains(items):
    return ", ".join(
        x.get("Domain", "")
        for x in (items or [])
        if isinstance(x, dict) and x.get("Domain")
    )

rows = []

for path, source in sources:
    print("Importation :", source)

    data = json.loads(
        path.read_text(encoding="utf-8-sig")
    )

    for entry in data:
        lemma = entry.get("Lemma", "")

        codes = set()

        for code in entry.get("StrongCodes") or []:
            m = re.fullmatch(r"([GHA])(\d+)", str(code))

            if m:
                codes.add(
                    m.group(1) +
                    m.group(2).zfill(4)
                )

        for form in entry.get("BaseForms") or []:
            for meaning in form.get("LEXMeanings") or []:
                for sense in meaning.get("LEXSenses") or []:

                    if sense.get("LanguageCode") != "fr":
                        continue

                    definition = (
                        sense.get("DefinitionShort") or
                        sense.get("DefinitionLong") or ""
                    )

                    glosses = join_strings(
                        sense.get("Glosses")
                    )

                    if not definition and not glosses:
                        continue

                    for code in codes:
                        rows.append((
                            code,
                            lemma,
                            meaning.get("LEXID", ""),
                            meaning.get("LEXEntryCode") or "",
                            domains(meaning.get("LEXDomains")),
                            domains(meaning.get("LEXSubDomains")),
                            glosses,
                            definition,
                            sense.get("Comments") or "",
                            join_strings(meaning.get("LEXForms")),
                            json.dumps(
                                meaning.get("LEXReferences") or [],
                                ensure_ascii=False
                            ),
                            int(bool(sense.get("AIGenerated"))),
                            int(bool(sense.get("HumanCheckRecommended"))),
                            source
                        ))

db.executemany("""
INSERT INTO ubs_senses VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
""", rows)

db.execute("""
CREATE INDEX idx_ubs_strong
ON ubs_senses(strong)
""")

db.commit()

print("\nImportation terminée.")
print("Associations Strong/sens :", len(rows))

for code in ["G3466", "G2889", "H1254"]:
    print("\n===", code, "===")

    for row in db.execute("""
        SELECT lemma, entry_code, glosses,
               definition, ai_generated, human_check
        FROM ubs_senses
        WHERE strong = ?
    """, (code,)):
        print(row)

db.close()
