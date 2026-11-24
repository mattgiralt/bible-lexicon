#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
project=$PWD
output="$project/dist"
stage=$(mktemp -d "${TMPDIR:-/tmp}/bible-lexicon-raycast.XXXXXXXX")
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/assets/data" "$output"

cp package.json package-lock.json tsconfig.json eslint.config.js README.md AGENTS.md LICENSE "$stage/"
mkdir -p "$stage/src" "$stage/scripts"
cp scripts/package-local.sh "$stage/scripts/"
cp -R tests "$stage/"
cp src/*.ts src/*.tsx "$stage/src/"
cp assets/extension-icon.png "$stage/assets/"
cp assets/data/bible.sqlite "$stage/assets/data/"
cp assets/ATTRIBUTIONS.md "$stage/assets/"
license=assets/data/ubs/LICENSE.md
if [ ! -f "$license" ]; then license=assets/UBS-LICENSE.md; fi
cp "$license" "$stage/assets/UBS-LICENSE.md"
ln -s "$project/node_modules" "$stage/node_modules"

cd "$stage"
case "${1:-bundle}" in
  bundle)
    ./node_modules/.bin/ray bundle -I -o "$output/bible-lexicon.rayext"
    /usr/bin/tar --format zip -cf "$stage/bible-lexicon-source.zip" \
      package.json package-lock.json tsconfig.json eslint.config.js README.md AGENTS.md LICENSE src scripts tests assets
    mv "$stage/bible-lexicon-source.zip" "$output/"
    ;;
  build) ./node_modules/.bin/ray build -I -e dist -o "$output/compilation" ;;
  *) echo "Usage : $0 [bundle|build]" >&2; exit 2 ;;
esac
