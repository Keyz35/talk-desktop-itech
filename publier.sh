#!/bin/bash
# Publie une version compilée du Talk Desktop personnalisé sur le serveur de mises à jour.
#   ./publier.sh test   2.3.601    -> canal « test » (PC dont canal-mises-a-jour.txt contient « test »)
#   ./publier.sh stable 2.3.601    -> canal « stable » (tous les PC)
# Les PC installés par l'installateur vérifient toutes les 6 h et installent au redémarrage suivant.
# Fichiers servis par le conteneur maj-talk : /srv/maj-talk/<canal>/hoalen-windows-x64/{RELEASES,*.nupkg}
# et le dernier installateur : /srv/maj-talk/<canal>/Hoalen-Talk-Teams-installateur.exe
set -euo pipefail

CANAL="${1:-}"
VERSION="${2:-}"
[[ "$CANAL" == stable || "$CANAL" == test ]] || { echo "Usage : $0 stable|test <version iTech, ex. 2.3.501>" >&2; exit 1; }
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "ÉCHEC : version attendue sous la forme X.Y.Z (ex. 2.3.501)" >&2; exit 1; }

ICI="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$ICI/sortie/squirrel-$VERSION"
RACINE=/srv/maj-talk
DEST="$RACINE/$CANAL/hoalen-windows-x64"   # canal de « Hoalen Talk Teams » (l'ancien windows-x64 reste figé en 2.3.507)
ETAT="$ICI/etat-publication.json"

echo "1/4 Vérification de la version $VERSION…"
[ -d "$SOURCE" ] || { echo "ÉCHEC : $SOURCE introuvable (compiler d'abord : ./construire.sh)" >&2; exit 1; }
INDEX="$(find "$SOURCE" -maxdepth 1 -type f ! -name '*.exe' ! -name '*.nupkg' | head -1)"   # RELEASES, renommé par Talk Desktop
PAQUET_SRC="$(find "$SOURCE" -maxdepth 1 -name '*.nupkg' | head -1)"
INSTALLATEUR="$(find "$SOURCE" -maxdepth 1 -name '*.exe' | head -1)"
[ -n "$INDEX" ] && [ -n "$PAQUET_SRC" ] && [ -n "$INSTALLATEUR" ] || { echo "ÉCHEC : fichiers Squirrel incomplets dans $SOURCE" >&2; exit 1; }
EMPREINTE=""; NOM_PAQUET=""; TAILLE=""
read -r EMPREINTE NOM_PAQUET TAILLE < <(sed 's/^\xEF\xBB\xBF//' "$INDEX") || true   # index sans fin de ligne
[ -n "$EMPREINTE" ] && [ -n "$NOM_PAQUET" ] && [ -n "$TAILLE" ] || { echo "ÉCHEC : index Squirrel illisible ($INDEX)" >&2; exit 1; }
[[ "$NOM_PAQUET" == *"-$VERSION-full.nupkg" ]] || { echo "ÉCHEC : l'index annonce $NOM_PAQUET, pas la version $VERSION" >&2; exit 1; }
[ "$(sha1sum "$PAQUET_SRC" | cut -d' ' -f1 | tr a-f A-F)" == "$EMPREINTE" ] || { echo "ÉCHEC : empreinte du paquet différente de l'index" >&2; exit 1; }
[ "$(stat -c %s "$PAQUET_SRC")" == "$TAILLE" ] || { echo "ÉCHEC : taille du paquet différente de l'index" >&2; exit 1; }

echo "2/4 Copie du paquet sur le canal « $CANAL »…"
mkdir -p "$DEST"
cp "$PAQUET_SRC" "$DEST/.$NOM_PAQUET.tmp" && mv "$DEST/.$NOM_PAQUET.tmp" "$DEST/$NOM_PAQUET"
cp "$INSTALLATEUR" "$RACINE/$CANAL/.installateur.tmp" && mv "$RACINE/$CANAL/.installateur.tmp" "$RACINE/$CANAL/Hoalen-Talk-Teams-installateur.exe"

# Icône affichée par Windows dans « Applications installées » (iconUrl de l'installateur).
ICO="$ICI/.travail/talk-desktop-v$(python3 -I -c 'import sys; a,b,c=sys.argv[1].split("."); print(f"{a}.{b}.{int(c)//100}")' "$VERSION")/img/icons/icon.ico"
[ -f "$ICO" ] && cp "$ICO" "$RACINE/icone.ico"
echo "3/4 Mise à jour de l'index (rend la version visible aux PC)…"
printf '%s %s %s' "$EMPREINTE" "$NOM_PAQUET" "$TAILLE" > "$DEST/.RELEASES.tmp"
mv "$DEST/.RELEASES.tmp" "$DEST/RELEASES"

echo "4/4 Ménage (on garde la version précédente pour un éventuel retour arrière)…"
ls -1t "$DEST"/*-full.nupkg | tail -n +3 | xargs -r rm -f
chmod -R a+rX "$RACINE"
python3 -I - "$ETAT" "$CANAL" "$VERSION" <<'PY'
import json, sys, time
chemin, canal, version = sys.argv[1:]
try:
    etat = json.load(open(chemin, encoding="utf-8"))
except FileNotFoundError:
    etat = {}
etat[canal] = {"version": version, "publie_le": time.strftime("%Y-%m-%d %H:%M")}
json.dump(etat, open(chemin, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
PY
echo "Publié : version $VERSION sur le canal « $CANAL »."
ls -l "$DEST"
