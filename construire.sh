#!/bin/bash
# Compile la version personnalisée de Talk Desktop (« Nextcloud Talk Teams » : bouton et téléphone intégré) pour Windows x64.
#   ./construire.sh                -> Talk Desktop v2.3.5, révision iTech 1 (version 2.3.501)
#   ./construire.sh v2.3.6 2       -> Talk Desktop v2.3.6, révision iTech 2 (version 2.3.602)
# Numéro de version iTech = X.Y.(Z×100 + révision) : toujours croissant, ce qui permet aux PC
# de se mettre à jour, que la nouveauté vienne de Nextcloud ou de nos propres ajouts.
# Résultat dans sortie/ : installateur .exe (Squirrel) et zip portable.
# La compilation tourne dans un conteneur limité (1 processeur, 3 Go) en priorité basse.
set -euo pipefail

VERSION="${1:-v2.3.5}"
REVISION="${2:-1}"
[[ "$VERSION" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || { echo "ÉCHEC : version attendue sous la forme vX.Y.Z" >&2; exit 1; }
MAJ="${BASH_REMATCH[1]}"; MIN="${BASH_REMATCH[2]}"; CORR="${BASH_REMATCH[3]}"
[[ "$REVISION" =~ ^[1-9][0-9]?$ ]] || { echo "ÉCHEC : révision attendue entre 1 et 99" >&2; exit 1; }
VERSION_ITECH="$MAJ.$MIN.$(( CORR * 100 + REVISION ))"
ICI="$(cd "$(dirname "$0")" && pwd)"
APPLI="$ICI/../appli/telephone3cx"
TRAVAIL="$ICI/.travail/talk-desktop-$VERSION"
SORTIE="$ICI/sortie"
IMAGE="talk-desktop-compilation:local"

echo "1/6 Récupération de Talk Desktop $VERSION (version iTech $VERSION_ITECH)…"
rm -rf "$TRAVAIL"; mkdir -p "$(dirname "$TRAVAIL")" "$SORTIE"
git clone -q --depth 1 --branch "$VERSION" https://github.com/nextcloud/talk-desktop.git "$TRAVAIL"

echo "2/6 Personnalisation (nom, serveur, pas de vérification de mise à jour)…"
mkdir -p "$TRAVAIL/.overrides"
cp "$ICI/build.config.json" "$TRAVAIL/.overrides/build.config.json"

echo "3/6 Ajout du bouton Téléphone…"
# Copie de référence des fichiers du téléphone dans le dépôt (client/), depuis l'appli Nextcloud
# si elle est présente sur ce serveur : le dépôt garde ainsi la trace exacte de chaque version.
mkdir -p "$ICI/client"
if [ -d "$APPLI" ]; then
  cp "$APPLI/js/telephone-noyau.js" "$APPLI/js/jssip.min.js" "$APPLI/js/jssip.LICENCE.md" "$APPLI/css/telephone.css" "$ICI/client/"
fi
for f in telephone-noyau.js jssip.min.js telephone.css; do
  [ -f "$ICI/client/$f" ] || { echo "ÉCHEC : client/$f manquant" >&2; exit 1; }
done
DEST="$TRAVAIL/src/talk/renderer/Telephone3CX"
mkdir -p "$DEST"
cp "$ICI/integration/Telephone3CX.ts" "$DEST/"
cp "$ICI/integration/itechMisesAJour.ts" "$TRAVAIL/src/app/"
cp "$ICI/client/telephone-noyau.js" "$ICI/client/jssip.min.js" "$ICI/client/telephone.css" "$DEST/"
python3 -I "$ICI/integration/modifier-talk-desktop.py" "$TRAVAIL"
python3 -I - "$TRAVAIL/package.json" "$VERSION_ITECH" <<'PY2'
import json, sys
chemin, version = sys.argv[1], sys.argv[2]
with open(chemin, encoding="utf-8") as f:
    texte = f.read()
ancienne = json.loads(texte)["version"]
texte = texte.replace(f'"version": "{ancienne}"', f'"version": "{version}"', 1)
assert json.loads(texte)["version"] == version
with open(chemin, "w", encoding="utf-8") as f:
    f.write(texte)
print(f"package.json : version {ancienne} -> {version}")
PY2
# Talk Desktop exige que l'étiquette git du code corresponde à sa version : dans la copie de
# travail (locale, jetable), l'étiquette officielle est remplacée par celle de la version iTech.
git -C "$TRAVAIL" tag -d "$VERSION" > /dev/null
git -C "$TRAVAIL" tag "v$VERSION_ITECH"

echo "4/6 Image de compilation (Node 24, Wine, Mono)…"
docker build -q -t "$IMAGE" "$ICI" > /dev/null

echo "5/6 Compilation (long : 15 à 40 min)…"
docker run --rm --cpus=1 --memory=3g --memory-swap=3g \
  -e NODE_OPTIONS=--max-old-space-size=2560 -e CHANNEL=stable \
  -v "$TRAVAIL:/src" -v talk-desktop-npm:/root/.npm \
  "$IMAGE" nice -n 10 bash -c '
    set -e
    npm ci --no-audit --no-fund
    npm run build:windows:x64
    npm run package:windows:x64:exe
  '

echo "6/6 Récupération des fichiers…"
NOM="$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["applicationName"])' "$ICI/build.config.json")"
DOSSIER_APPLI="$(find "$TRAVAIL/out" -maxdepth 1 -type d -name "$NOM-win32-x64" | head -1)"
[ -n "$DOSSIER_APPLI" ] || { echo "ÉCHEC : dossier compilé introuvable dans out/" >&2; exit 1; }
# Contrôle : nos ajouts doivent être dans l'application compilée, sinon on n'en livre rien.
ASAR="$DOSSIER_APPLI/resources/app.asar"
for repere in tel3cx-panneau Telephone3CX apps/telephone3cx/api/v1 JsSIP demarrerMisesAJourItech maj-talk.itech.ovh 'isBranded:!0' "\"$VERSION_ITECH\""; do
  grep -a -q -F -- "$repere" "$ASAR" || { echo "ÉCHEC du contrôle : « $repere » absent de l'application compilée" >&2; exit 1; }
done
echo "Contrôle : bouton, téléphone intégré, mises à jour iTech, personnalisation et version $VERSION_ITECH présents."
PORTABLE="$SORTIE/${NOM// /-}-$VERSION_ITECH-windows-x64-portable.zip"
rm -f "$PORTABLE"
python3 -I -c 'import shutil,sys,os; shutil.make_archive(sys.argv[1][:-4], "zip", os.path.dirname(sys.argv[2]), os.path.basename(sys.argv[2]))' "$PORTABLE" "$DOSSIER_APPLI"
# Fichiers Squirrel (installateur + paquet + RELEASES) gardés ensemble, pour la publication.
SQUIRREL="$SORTIE/squirrel-$VERSION_ITECH"
rm -rf "$SQUIRREL"; mkdir -p "$SQUIRREL"
cp "$TRAVAIL"/out/make/squirrel.windows/x64/* "$SQUIRREL/"
cp "$SQUIRREL"/*.exe "$SORTIE/${NOM// /-}-$VERSION_ITECH-windows-x64-installateur.exe"
ls -lh "$SORTIE"
echo "Terminé."
