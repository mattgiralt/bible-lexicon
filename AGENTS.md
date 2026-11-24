# Bible Lexicon

Extension Raycast macOS conçue pour le travail pastoral et théologique. Le résultat lexical doit rester hors ligne, vérifiable dans les sources et utilisable depuis une sélection dans l’application active. La quantité de résultats passe après la précision de l’identification.

## Architecture

- `src/lexique-biblique.tsx` lit la citation et la sélection via Raycast et `src/selection.ts`. La capture AX cible le processus de l’application active fourni par Raycast. L’offset AX désambiguïse les mots répétés. System Events renvoie pour Byword des bornes inclusives à partir de 1. Le code convertit ces bornes en offset JavaScript et vérifie que le texte à cet offset correspond à la sélection. Les citations multiversets exigent des numéros de versets explicites et ordonnés.
- `src/alignment.ts` donne une correspondance uniquement aux mots identiques après normalisation française et associés de la même manière dans tous les alignements optimaux. Une citation non identique exige un voisin immédiat commun et au moins 60 % des mots de la citation alignés sans ambiguïté. Une inscription Strong sur une locution concerne l’ensemble de la balise LSG.
- `src/lexicon.ts` interroge `assets/data/bible.sqlite` en lecture seule via SQLite macOS. Les vues dictionnaire, concordance et recherche utilisent les identifiants étendus lorsqu’ils sont disponibles. Les statistiques LSG restent calculées par Strong de base.
- `src/references.ts` centralise les codes des livres et les références françaises. La numérotation affichée correspond au document cité, au verset LSG lié, ou à la source explicitement indiquée.
- `scripts/build-db.py` importe LSG (`french`), STEP (`original`, `step_references`, `lexicon`, `morphology`). `scripts/build-links.py` crée `verse_links` et `marble`. Les autres scripts enrichissent la base avec les fréquences françaises, les sens UBS et l’index de recherche.
- `assets/ATTRIBUTIONS.md` et les fichiers de licence dans les répertoires source décrivent les sources et les droits. Le paquet embarque la base et les mentions nécessaires. La distribution doit conserver l’attribution de Concordances et Traductions de la Bible, dont le CSV officiel correspond à la copie locale, ainsi que les licences STEP et UBS.

## Fiabilité éditoriale

- Travailler sur une copie de la base lors des imports. Préserver les sources de `assets/data` et les attributions. Aucun service réseau ni IA générative au moment de la recherche.
- Le CSV LSG suit souvent la numérotation hébraïque dans l’Ancien Testament. Le TAHOT donne d’abord la référence anglaise, puis la référence hébraïque entre parenthèses en cas de décalage. Le TAGNT peut porter une référence alternative entre crochets. `verse_links` compare ces références et les annotations présentes dans le CSV. Les cas non tranchés restent sans lien.
- Un Strong de base, un lemme vocalisé et une référence de verset apportent des preuves distinctes. Ne jamais attribuer une notice STEP d’un autre homonyme à un identifiant étendu. Un sens UBS de verset exige une occurrence unique du lemme. Quand la relation entre subdivisions UBS et STEP reste incertaine, l’indiquer.
- MARBLE est indexé seulement si le lemme et la position concordent dans le verset hébreu. Une mention MARBLE confirme la présence d’une entrée indexée pour l’occurrence. Elle ne fait pas équivaloir automatiquement le code SDBH et l’identifiant du sens UBS français.
- Conserver les indicateurs UBS `AIGenerated` et `HumanCheckRecommended`. Conserver le code de morphologie STEP et signaler toute description inconnue. Le commentaire français résume l’analyse de la source, avec les composantes de la forme hébraïque ou araméenne.
- Documenter chaque correction de versification ou de correspondance qui introduit une nouvelle hypothèse et ajouter un cas de régression représentatif.

## Vérification

`npm test`, `npm run typecheck`, `npm run build` et `npm run bundle`. Les tests Node utilisent la base réelle et substituent seulement le chemin des ressources fourni par Raycast. Pour une vérification manuelle, essayer une citation S21 dans Ulysses, un mot répété, un verset au découpage différent et la recherche d’un Strong étendu. Voir [README.md](README.md) pour l’import local.

## Résultats de l’audit initial

La branche locale était sans commit. L’archive datée dans `sauvegardes/` contient l’état antérieur du code, des scripts, du dépôt et des données, hors dépendances npm régénérables. Sa base a été extraite et vérifiée avec `PRAGMA quick_check`.

La base reconstruite conserve les 31 171 lignes LSG. La lecture des références STEP entre parenthèses ou crochets fait passer les lignes originales de 638 980 à 678 297. L’import des lemmes à suffixe fait passer les articles STEP de 19 808 à 21 232. Sur 31 171 lignes LSG, 31 106 ont un lien exploitable, dont 2 012 avec changement de coordonnées STEP. Les 65 autres lignes incluent des versets vides, absents de l’édition NA28 sélectionnée ou dont le découpage reste ambigu. Exemples contrôlés dans les tests et les données sources : Ps 3.1, Jl 3.1, Ac 19.41 et Gn 1.1.

La sélection S21 vient du document Ulysses. Une correspondance entre la S21 et la LSG reste donc une proposition fondée sur le texte disponible et la référence saisie. La vérification des variantes de versification propres à toutes les autres éditions et l’interprétation de toutes les analyses morphologiques rares restent des sujets d’audit.
