#!/usr/bin/env bash
# Publica o jogo (arquivo único) na branch gh-pages, servida pelo GitHub Pages em
# https://andre2700.github.io/Survivor/ (o repositório precisa ser público e o Pages ligado na
# branch gh-pages). Uso: npm run deploy:pages
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:single >/dev/null
SRC_REV=$(git rev-parse --short HEAD)
TMP=$(mktemp -d)
git worktree add --detach "$TMP" >/dev/null 2>&1
cd "$TMP"
if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git fetch -q origin gh-pages && git checkout -q -B gh-pages origin/gh-pages
else
  git checkout -q --orphan gh-pages
fi
git rm -rq --cached . >/dev/null 2>&1 || true
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp "$OLDPWD/dist-single/index.html" index.html
# as músicas ficam ao lado (o jogo baixa cada uma só quando vai tocar)
mkdir -p music && cp "$OLDPWD"/src/assets/music/*.mp3 music/
touch .nojekyll
git add index.html .nojekyll music
git commit -qm "Jogo publicado a partir de $SRC_REV" || echo "nada mudou"
git push -q -u origin gh-pages
cd "$OLDPWD"
git worktree remove --force "$TMP"
echo "publicado: https://andre2700.github.io/Survivor/"
