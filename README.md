# Bible Lexicon

**Bible Lexicon est une extension Raycast pour macOS qui permet d’étudier le grec et l’hébreu bibliques hors ligne.** Sélectionnez un mot dans une citation depuis Byword, Ulysses ou un éditeur compatible, puis lancez **Lexique biblique**. L’extension affiche les formes originales associées au mot, leur lemme, leur numéro Strong et leur analyse morphologique. Elle signale les correspondances incertaines.

Avec **Recherche lexicale**, partez directement d’un lemme grec ou hébreu, d’un mot français ou d’un numéro Strong. Consultez les notices STEP, les sens UBS disponibles en français et la concordance pour retrouver d’autres occurrences.

Essayez « Parole » en Jean 1.14 ou cherchez `G3056` pour retrouver le lemme grec λόγος.

## Installer sur chacun des Mac

Pour une première installation, suivez le [tutoriel illustré pas à pas](docs/installation/README.md).

1. Télécharger `bible-lexicon-source.zip` depuis la [dernière version GitHub](https://github.com/mattgiralt/bible-lexicon/releases/latest), décompresser l’archive dans un dossier permanent et ouvrir ce dossier dans le Terminal.
2. Installer les dépendances avec `npm ci` sur un Mac disposant de Node.js 24 et de Raycast. Cette étape peut nécessiter Internet.
3. Dans Raycast, lancer **Import Extension** et indiquer ce dossier. Raycast documente cette commande pour l’import de code source. Les commandes locales sont conservées après arrêt du mode de développement. [Import de code source](https://developers.raycast.com/basics/getting-started) · [Persistance de l’extension](https://developers.raycast.com/basics/create-your-first-extension)
4. Ouvrir **Recherche lexicale** et essayer `H1254B`. Dans Ulysses ou un autre éditeur, sélectionner un mot entier dans une citation introduite par exemple par `Jn 1.14 (S21) :`, puis lancer **Lexique biblique**. Les autorisations macOS de Raycast pour l’accessibilité et, selon la configuration, pour System Events sont à régler sur chaque Mac si macOS le demande.

Le fichier `bible-lexicon.rayext` est aussi produit par le CLI officiel. L’import depuis le dossier source est le parcours documenté pour les versions de Raycast qui ne proposent pas d’import de paquet. Aucun processus npm permanent n’est nécessaire pour consulter les données.

## Mettre à jour une installation existante

Utilisez la dernière archive source pour mettre à jour le dossier que vous avez importé sur chaque Mac. Si vous décompressez l’archive dans un nouveau dossier permanent, indiquez ce dossier dans **Import Extension**. Une fois la mise à jour chargée, essayez **Lexique biblique** sur la deuxième occurrence de « péché » dans `Rm 5.12 (LSG):12` depuis Byword. Ce parcours a été confirmé dans Byword le 24 novembre 2026.

## Analyser une citation depuis une autre application

Dans l’application qui affiche la citation, sélectionnez un mot entier et lancez **Lexique biblique** via Raycast. Placez la référence en tête de la citation, par exemple `Jn 1.14 (S21) :`, ou juste après les guillemets, comme dans `« … que je le ressuscite au dernier jour. » (Jn 6.39)`. Pour plusieurs versets, indiquez les numéros dans la citation.

Le champ actif doit exposer le texte et les coordonnées de la sélection via l’accessibilité macOS. La compatibilité dépend du champ et de l’application. Lorsque le contexte manque, **Recherche lexicale** permet de rechercher directement un mot ou un Strong.

## Développement et données

Le dépôt contient le code de l’extension et les scripts d’import. Les archives de version contiennent la base SQLite utilisée hors ligne. Pour lancer les tests depuis un clone, extrayez `assets/data/bible.sqlite` de l’archive source de la version correspondante dans le clone, puis lancez `npm ci`.

- `npm test` exerce l’alignement, la versification, la recherche, la morphologie et UBS à partir de la base réelle. `npm run typecheck` vérifie TypeScript.
- `npm run build` compile en mode distribution. `npm run bundle` prépare les deux fichiers de transfert dans `dist/`.
- Pour reconstruire la base dans une copie du projet, exécuter dans l’ordre `build-db.py`, `build-french-lexicon.py`, `build-links.py`, `build-ubs.py` et `build-search.py` avec Python 3. Vérifier ensuite la base et lancer les tests avant de remplacer la version utilisée.
- La LSG annotée et les textes STEP ont des éditions et découpages distincts. Le diagnostic de l’extension précise lorsque la référence ou la correspondance du mot reste incertaine. Les corpus locaux et leur provenance sont décrits dans [les attributions](assets/ATTRIBUTIONS.md).
