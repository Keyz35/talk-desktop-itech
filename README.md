# Talk Desktop iTech — « Hoalen Talk Teams »

Version personnalisée de [Nextcloud Talk Desktop](https://github.com/nextcloud/talk-desktop)
(Windows x64) pour les cabinets suivis par iTech : Talk y devient **le téléphone** du collaborateur.

Ce dépôt ne contient **que nos ajouts**. Ils sont posés par-dessus chaque version officielle au moment
de la compilation : une mise à jour de Nextcloud ne peut donc pas les écraser, et un changement trop
important du code officiel arrête la compilation au lieu de produire une version cassée.

## Nos ajouts

| Ajout | Fichiers |
|---|---|
| Personnalisation officielle : nom « Hoalen Talk Teams », serveur cloud.itech.ovh prérempli, vérification de mise à jour Nextcloud coupée | `build.config.json` (copié en `.overrides/`) |
| Bouton **Téléphone** dans la barre de titre | `integration/modifier-talk-desktop.py` (TitleBar.vue), `integration/Telephone3CX.ts` |
| Téléphone intégré SIP WebRTC (JsSIP) : appels sortants et entrants, sonnerie, notification, micro, attente, touches | `client/` — copie de l'appli Nextcloud `telephone3cx` (serveur mailcow-nextcloud, `docker-stack/talk-3cx/appli/`) |
| Mises à jour automatiques depuis **maj-talk.itech.ovh** (canaux stable/test) | `integration/itechMisesAJour.ts` + 2 lignes dans `src/main.js` |

Le code officiel n'est modifié qu'en ces deux endroits (15 lignes) ; tout le reste est ajouté à côté.

## Numéros de version

Version iTech = `X.Y.(Z × 100 + révision)` : officielle 2.3.5 → **2.3.501**, puis 2.3.502 si l'on
recompile avec nos propres changements ; officielle 2.3.6 → 2.3.601. Toujours croissant, ce qui permet
aux PC de se mettre à jour.

## Scripts

```
./construire.sh v2.3.5 1        # compile (conteneur limité à 1 processeur / 3 Go), contrôle nos ajouts
./publier.sh test 2.3.501       # rend la version disponible aux PC du canal « test »
./publier.sh stable 2.3.501     # … à tous les PC
./verifier-mises-a-jour.sh      # ce que fait la tâche de chaque nuit
```

- **Contrôle** : `construire.sh` refuse de livrer si le bouton, le téléphone, les mises à jour iTech,
  la personnalisation ou le bon numéro de version manquent dans l'application compilée.
- **Publication** : `publier.sh` vérifie l'empreinte du paquet, copie, puis met à jour l'index en
  dernier (aucun PC ne voit une version à moitié copiée) ; garde la version précédente.
- **État** : `etat-publication.json` (version en service sur chaque canal).

## Politique de mise à jour (décision de Jordan, 19/11/2026)

Chaque nuit, `verifier-mises-a-jour.sh` regarde les versions officielles :
- **même version majeure** (2.3.5 → 2.3.6 ou 2.4.0) : compilée, contrôlée, publiée en **stable**
  automatiquement ; e-mail d'information ; les PC l'installent au redémarrage suivant de l'appli ;
- **version majeure** (2.x → 3.0) : publiée en **test** seulement, e-mail ; **bascule à la main**
  après essais : `./publier.sh stable X.Y.Z` ;
- **échec** : rien n'est publié, alerte par e-mail (via `deploy/run-with-alert.sh`).

Retour arrière : `./publier.sh stable <version précédente>` (la précédente est conservée).

## Côté PC

- **Installateur** (`…-installateur.exe`) : installation par utilisateur, mises à jour automatiques.
  Dernier installateur : https://maj-talk.itech.ovh/stable/Hoalen-Talk-Teams-installateur.exe
- **Zip portable** : pour un essai ; **pas** de mise à jour automatique.
- **Canal test** sur un PC : créer `%APPDATA%\Hoalen Talk Teams\canal-mises-a-jour.txt`
  contenant `test`, puis redémarrer l'appli.
- Exécutable non signé : avertissement SmartScreen au premier lancement.
- Pour recevoir les appels, l'appli doit tourner (fermer la fenêtre la garde dans la zone de
  notification).
