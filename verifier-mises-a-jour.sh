#!/bin/bash
# Vérification nocturne des nouvelles versions officielles de Talk Desktop (Nextcloud).
#   - nouvelle version de même version majeure (ex. 2.3.5 -> 2.3.6 ou 2.4.0) : nos ajouts sont
#     reposés par-dessus (construire.sh, contrôle compris) puis publiés sur le canal « stable » ;
#   - nouvelle version majeure (ex. 2.x -> 3.0) : compilée et publiée sur le canal « test »
#     seulement ; e-mail à Jordan ; bascule à la main après essais : ./publier.sh stable X.Y.Z
#   - échec (nos ajouts ne s'appliquent plus, compilation ratée) : rien n'est publié, alerte.
# Lancé chaque nuit par cron via deploy/run-with-alert.sh (qui alerte en cas d'échec).
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
ETAT="$ICI/etat-publication.json"
DEPOT_AMONT=https://github.com/nextcloud/talk-desktop.git

# E-mail d'information (mêmes réglages que deploy/run-with-alert.sh, lus sur place).
ALERTE=/root/docker-stack/deploy/run-with-alert.sh
informer() {
  local sujet="$1" corps="$2" de a mdp
  de="$(sed -n 's/^MAIL_FROM="\(.*\)"/\1/p' "$ALERTE")"; a="$(sed -n 's/^MAIL_TO="\(.*\)"/\1/p' "$ALERTE")"
  [ -f /root/.disk-alert-smtp-password ] && [ -n "$de" ] && [ -n "$a" ] || { echo "(e-mail non envoyé : réglages absents)"; return 0; }
  mdp="$(cat /root/.disk-alert-smtp-password)"
  printf 'Subject: %s\nFrom: %s\nTo: %s\nContent-Type: text/plain; charset=utf-8\n\n%s\n' "$sujet" "$de" "$a" "$corps" \
    | curl -s --max-time 30 --url "smtps://mail.itech.ovh:465" --mail-from "$de" --mail-rcpt "$a" \
        --user "$de:$mdp" --upload-file - || echo "(e-mail non envoyé)"
}

lire_etat() { python3 -I -c 'import json,sys; e=json.load(open(sys.argv[1])); print(e.get(sys.argv[2],{}).get("version",""))' "$ETAT" "$1" 2>/dev/null || true; }
amont_de() { local v="$1"; IFS=. read -r a b c <<< "$v"; echo "v$a.$b.$(( c / 100 ))"; }   # 2.3.501 -> v2.3.5

echo "== $(date '+%F %T') vérification des versions de Talk Desktop"
STABLE="$(lire_etat stable)"
TEST="$(lire_etat test)"
[ -n "$STABLE" ] || { echo "ÉCHEC : aucune version stable publiée (etat-publication.json) ; publier d'abord à la main." >&2; exit 1; }
AMONT_STABLE="$(amont_de "$STABLE")"

DERNIERE="$(git ls-remote --tags "$DEPOT_AMONT" | grep -oE 'refs/tags/v[0-9]+\.[0-9]+\.[0-9]+$' | sed 's#refs/tags/##' | sort -V | tail -1)"
[ -n "$DERNIERE" ] || { echo "ÉCHEC : impossible de lire les versions officielles" >&2; exit 1; }
echo "Officielle la plus récente : $DERNIERE ; en service (stable) : $STABLE (= $AMONT_STABLE)${TEST:+ ; en test : $TEST}"

if [ "$(printf '%s\n%s\n' "$AMONT_STABLE" "$DERNIERE" | sort -V | tail -1)" == "$AMONT_STABLE" ]; then
  echo "Rien à faire : la version en service est à jour."
  exit 0
fi
if [ -n "$TEST" ] && [ "$(amont_de "$TEST")" == "$DERNIERE" ]; then
  echo "La version $DERNIERE attend déjà sa validation sur le canal « test » ($TEST) : rien de plus."
  exit 0
fi

MAJ_STABLE="${AMONT_STABLE#v}"; MAJ_STABLE="${MAJ_STABLE%%.*}"
MAJ_NOUVELLE="${DERNIERE#v}"; MAJ_NOUVELLE="${MAJ_NOUVELLE%%.*}"
IFS=. read -r a b c <<< "${DERNIERE#v}"; VERSION_ITECH="$a.$b.$(( c * 100 + 1 ))"

echo "Compilation de $DERNIERE avec nos ajouts (version iTech $VERSION_ITECH)…"
"$ICI/construire.sh" "$DERNIERE" 1

if [ "$MAJ_NOUVELLE" == "$MAJ_STABLE" ]; then
  "$ICI/publier.sh" stable "$VERSION_ITECH"
  informer "[Talk Desktop] Mise à jour automatique : $VERSION_ITECH (officielle $DERNIERE)" \
"Nextcloud a publié Talk Desktop $DERNIERE (même version majeure que celle en service).
Nos ajouts (téléphone, personnalisation, mises à jour iTech) ont été reposés et contrôlés,
puis la version $VERSION_ITECH a été publiée sur le canal « stable ».
Les PC l'installeront d'eux-mêmes au prochain redémarrage de l'application.

Retour arrière si besoin : ./publier.sh stable $STABLE (sur le serveur, dossier talk-desktop)."
else
  "$ICI/publier.sh" test "$VERSION_ITECH"
  informer "[Talk Desktop] Version MAJEURE $DERNIERE à tester avant bascule" \
"Nextcloud a publié Talk Desktop $DERNIERE : changement de version majeure ($MAJ_STABLE -> $MAJ_NOUVELLE).
Nos ajouts ont été reposés et contrôlés, et la version $VERSION_ITECH est publiée sur le canal
« test » uniquement. Les PC des utilisateurs restent en $STABLE.

Pour tester sur un PC : créer %APPDATA%\\Nextcloud Talk Teams\\canal-mises-a-jour.txt contenant « test »,
puis redémarrer l'application (ou installer directement :
https://maj-talk.itech.ovh/test/Nextcloud-Talk-Teams-installateur.exe).

Après essais (appels entrants et sortants, notifications, mise à jour) — bascule de tous les PC :
  cd <dossier talk-desktop sur le serveur> && ./publier.sh stable $VERSION_ITECH"
fi

# Ménage : on ne garde que les dossiers de travail et fichiers des deux dernières versions.
ls -1dt "$ICI"/.travail/talk-desktop-v* 2>/dev/null | tail -n +3 | xargs -r rm -rf
ls -1dt "$ICI"/sortie/squirrel-* 2>/dev/null | tail -n +3 | xargs -r rm -rf
ls -1t "$ICI"/sortie/*.exe "$ICI"/sortie/*.zip 2>/dev/null | tail -n +5 | xargs -r rm -f

# Trace dans le dépôt git (si configuré) : version publiée.
if git -C "$ICI" rev-parse --is-inside-work-tree > /dev/null 2>&1 && git -C "$ICI" remote | grep -q .; then
  git -C "$ICI" add etat-publication.json
  git -C "$ICI" -c user.name="Serveur mailcow-nextcloud" -c user.email="serveur@itech.ovh" \
    commit -q -m "Publication automatique : $VERSION_ITECH (officielle $DERNIERE)" || true
  git -C "$ICI" push -q || echo "(envoi vers GitHub impossible, à refaire à la main)"
fi
echo "== $(date '+%F %T') terminé"
