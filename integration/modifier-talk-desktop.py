#!/usr/bin/env python3
"""Ajoute le bouton Téléphone (et les mises à jour iTech) à la barre de titre de Talk Desktop.

Usage : modifier-talk-desktop.py <dossier des sources de Talk Desktop>
S'arrête avec une erreur explicite si le code de Talk Desktop a changé au point
que l'insertion n'est plus sûre (à revoir à la main dans ce cas).
"""
import sys
from pathlib import Path

racine = Path(sys.argv[1])
fichier = racine / "src/talk/renderer/TitleBar/TitleBar.vue"
texte = fichier.read_text(encoding="utf-8")

deja = "monterTelephone" in texte
if deja:
    print("TitleBar.vue : déjà modifié")

def remplacer(ancien, nouveau):
    global texte
    if texte.count(ancien) != 1:
        sys.exit(f"ÉCHEC : repère introuvable ou ambigu dans TitleBar.vue :\n{ancien}")
    texte = texte.replace(ancien, nouveau)

if not deja:
    # 1. Script : importer et monter le téléphone une fois la barre affichée.
    remplacer(
        "import UserMenu from './components/UserMenu.vue'\n",
        "import UserMenu from './components/UserMenu.vue'\n"
        "import { onMounted, ref } from 'vue'\n"
        "import { monterTelephone } from '../Telephone3CX/Telephone3CX.ts'\n",
    )
    remplacer(
        "const { isDevMode } = useDevMode()\n",
        "const { isDevMode } = useDevMode()\n"
        "\n"
        "// Téléphone (ajout iTech)\n"
        "const conteneurTelephone = ref<HTMLElement | null>(null)\n"
        "onMounted(() => monterTelephone(conteneurTelephone.value))\n",
    )
    # 2. Gabarit : emplacement juste avant le menu principal.
    remplacer(
        '\t\t\t<div class="title-bar__item title-bar__main-menu-container" data-theme-dark>\n',
        '\t\t\t<div ref="conteneurTelephone" class="title-bar__telephone" />\n'
        '\t\t\t<div class="title-bar__item title-bar__main-menu-container" data-theme-dark>\n',
    )
    # 3. Style : l'emplacement ne prend de place que si le bouton est présent.
    remplacer(
        ".title-bar__item {\n",
        ".title-bar__telephone {\n"
        "\tdisplay: flex;\n"
        "\talign-items: center;\n"
        "\theight: 100%;\n"
        "}\n"
        "\n"
        ".title-bar__item {\n",
    )
    fichier.write_text(texte, encoding="utf-8")
    print("TitleBar.vue : bouton Téléphone ajouté")

# 4. Mises à jour automatiques par notre serveur (src/app/itechMisesAJour.ts, copié par construire.sh)
main = racine / "src/main.js"
texte = main.read_text(encoding="utf-8")
if "demarrerMisesAJourItech" not in texte:
    for ancien, nouveau in (
        ("const { createUpgradeWindow } = require('./upgrade/upgrade.window.ts')\n",
         "const { createUpgradeWindow } = require('./upgrade/upgrade.window.ts')\n"
         "const { demarrerMisesAJourItech } = require('./app/itechMisesAJour.ts') // ajout iTech\n"),
        ("\tsetupReleaseNotificationScheduler(24 * 60)\n",
         "\tsetupReleaseNotificationScheduler(24 * 60)\n"
         "\tdemarrerMisesAJourItech() // ajout iTech : nos propres mises à jour\n"),
    ):
        if texte.count(ancien) != 1:
            sys.exit(f"ÉCHEC : repère introuvable ou ambigu dans main.js :\n{ancien}")
        texte = texte.replace(ancien, nouveau)
    main.write_text(texte, encoding="utf-8")
    print("main.js : mises à jour iTech branchées")

# 5. Icône affichée par Windows dans « Applications installées » : la nôtre (publiée par publier.sh)
forge = racine / "forge.config.js"
texte = forge.read_text(encoding="utf-8")
ancien = "iconUrl: 'https://raw.githubusercontent.com/nextcloud/talk-desktop/refs/heads/main/img/icons/icon.ico',"
nouveau = "iconUrl: 'https://maj-talk.itech.ovh/icone.ico', // ajout iTech : icône Hoalen"
if nouveau not in texte:
    if texte.count(ancien) != 1:
        sys.exit("ÉCHEC : iconUrl introuvable ou ambigu dans forge.config.js")
    forge.write_text(texte.replace(ancien, nouveau), encoding="utf-8")
    print("forge.config.js : icône Windows remplacée")

# 6. Boutons système de la fenêtre (réduire, agrandir, fermer) : couleur calculée d'après le fond de
#    l'en-tête déclaré à la compilation ; notre en-tête est sable (#F0EDE4) -> symboles foncés.
utils = racine / "src/app/utils.ts"
texte = utils.read_text(encoding="utf-8")
ancien = "export function getTitleBarSymbolColor(backgroundColor: string = BUILD_CONFIG.backgroundColor): string {"
nouveau = "export function getTitleBarSymbolColor(backgroundColor: string = '#F0EDE4' /* ajout iTech : en-tête sable Hoalen */): string {"
if nouveau not in texte:
    if texte.count(ancien) != 1:
        sys.exit("ÉCHEC : getTitleBarSymbolColor introuvable ou ambigu dans src/app/utils.ts")
    utils.write_text(texte.replace(ancien, nouveau), encoding="utf-8")
    print("utils.ts : boutons système foncés pour l'en-tête sable")

# 7. Menu de l'icône de la zone de notification : libellés en français (écrits en dur en anglais)
tray = racine / "src/app/app.tray.js"
texte = tray.read_text(encoding="utf-8")
for ancien, nouveau in (
    ("\t\t\tlabel: 'Open',\n", "\t\t\tlabel: 'Ouvrir', // ajout iTech : français\n"),
    ("\t\t\trole: 'quit',\n", "\t\t\trole: 'quit',\n\t\t\tlabel: 'Quitter', // ajout iTech : français\n"),
):
    if "ajout iTech : français" in nouveau and nouveau.strip().split("\n")[-1].strip() in texte:
        continue
    if texte.count(ancien) != 1:
        sys.exit(f"ÉCHEC : repère introuvable ou ambigu dans app.tray.js :\n{ancien}")
    texte = texte.replace(ancien, nouveau)
tray.write_text(texte, encoding="utf-8")
print("app.tray.js : menu de la zone de notification en français")

# 8. Clic sur une notification (appel ou message) : la fenêtre doit vraiment passer au premier plan.
#    focusMainWindow() ne faisait que show() ; sous Windows, la protection du premier plan empêche alors
#    une fenêtre ouverte mais recouverte de remonter. On force : afficher, « toujours devant » un instant,
#    focus, puis retour à la normale.
main = racine / "src/main.js"
texte = main.read_text(encoding="utf-8")
if "ajout iTech : premier plan" not in texte:
    ancien = "\t\t// Show the window in case it is hidden in the system tray and focus it\n\t\tmainWindow.show()\n"
    nouveau = (ancien +
        "\t\t// ajout iTech : premier plan (Windows bloque sinon la remontée d'une fenêtre recouverte)\n"
        "\t\tmainWindow.setAlwaysOnTop(true)\n"
        "\t\tmainWindow.focus()\n"
        "\t\tmainWindow.moveTop()\n"
        "\t\tsetTimeout(() => { if (!mainWindow.isDestroyed()) mainWindow.setAlwaysOnTop(false) }, 300)\n")
    if texte.count(ancien) != 1:
        sys.exit("ÉCHEC : focusMainWindow introuvable ou ambigu dans main.js")
    main.write_text(texte.replace(ancien, nouveau), encoding="utf-8")
    print("main.js : retour au premier plan forcé au clic sur une notification")

# 9. Photos de profil à jour sans manipulation (src/app/itechCacheAvatars.ts, copié par construire.sh)
main = racine / "src/main.js"
texte = main.read_text(encoding="utf-8")
if "reglerCacheAvatars" not in texte:
    for ancien, nouveau in (
        ("const { demarrerMisesAJourItech } = require('./app/itechMisesAJour.ts') // ajout iTech\n",
         "const { demarrerMisesAJourItech } = require('./app/itechMisesAJour.ts') // ajout iTech\n"
         "const { reglerCacheAvatars } = require('./app/itechCacheAvatars.ts') // ajout iTech\n"),
        ("\tdemarrerMisesAJourItech() // ajout iTech : nos propres mises à jour\n",
         "\tdemarrerMisesAJourItech() // ajout iTech : nos propres mises à jour\n"
         "\treglerCacheAvatars() // ajout iTech : photos de profil à jour (cache des avatars)\n"),
    ):
        if texte.count(ancien) != 1:
            sys.exit(f"ÉCHEC : repère introuvable ou ambigu dans main.js :\n{ancien}")
        texte = texte.replace(ancien, nouveau)
    main.write_text(texte, encoding="utf-8")
    print("main.js : cache des avatars réglé (photos à jour)")

# 10. Lancement automatique à l'ouverture de session (src/app/itechDemarrage.ts, copié par construire.sh)
main = racine / "src/main.js"
texte = main.read_text(encoding="utf-8")
if "activerDemarrageAutomatique" not in texte:
    for ancien, nouveau in (
        ("const { reglerCacheAvatars } = require('./app/itechCacheAvatars.ts') // ajout iTech\n",
         "const { reglerCacheAvatars } = require('./app/itechCacheAvatars.ts') // ajout iTech\n"
         "const { activerDemarrageAutomatique } = require('./app/itechDemarrage.ts') // ajout iTech\n"),
        ("\treglerCacheAvatars() // ajout iTech : photos de profil à jour (cache des avatars)\n",
         "\treglerCacheAvatars() // ajout iTech : photos de profil à jour (cache des avatars)\n"
         "\tactiverDemarrageAutomatique() // ajout iTech : démarrage avec Windows (une seule fois)\n"),
    ):
        if texte.count(ancien) != 1:
            sys.exit(f"ÉCHEC : repère introuvable ou ambigu dans main.js :\n{ancien}")
        texte = texte.replace(ancien, nouveau)
    main.write_text(texte, encoding="utf-8")
    print("main.js : lancement automatique à l'ouverture de session (une fois)")

# 11. Liens « tel: » (src/app/itechLiensTel.ts, copié par construire.sh) : processus principal + preload
main = racine / "src/main.js"
texte = main.read_text(encoding="utf-8")
if "transmettreNumero" not in texte:
    for ancien, nouveau in (
        ("const { activerDemarrageAutomatique } = require('./app/itechDemarrage.ts') // ajout iTech\n",
         "const { activerDemarrageAutomatique } = require('./app/itechDemarrage.ts') // ajout iTech\n"
         "const { preparerLiensTel, transmettreNumero } = require('./app/itechLiensTel.ts') // ajout iTech\n"),
        ("\tactiverDemarrageAutomatique() // ajout iTech : démarrage avec Windows (une seule fois)\n",
         "\tactiverDemarrageAutomatique() // ajout iTech : démarrage avec Windows (une seule fois)\n"
         "\tpreparerLiensTel() // ajout iTech : liens tel: et callto:\n"),
        ("\tapp.on('second-instance', (event, argv, cwd) => {\n\t\tif (isSameExecution(argv[0], cwd)) {\n",
         "\tapp.on('second-instance', (event, argv, cwd) => {\n"
         "\t\t// ajout iTech : lien tel: reçu (traité avant la vérification d'installation)\n"
         "\t\tif (transmettreNumero(argv, mainWindow)) {\n\t\t\tfocusMainWindow()\n\t\t\treturn\n\t\t}\n"
         "\t\tif (isSameExecution(argv[0], cwd)) {\n"),
    ):
        if texte.count(ancien) != 1:
            sys.exit(f"ÉCHEC : repère introuvable ou ambigu dans main.js :\n{ancien}")
        texte = texte.replace(ancien, nouveau)
    main.write_text(texte, encoding="utf-8")
    print("main.js : liens tel: branchés")
preload = racine / "src/preload.js"
texte = preload.read_text(encoding="utf-8")
if "onItechTel" not in texte:
    ancien = "\tfocusTalk: () => ipcRenderer.invoke('talk:focus'),\n"
    nouveau = (ancien +
        "\t// ajout iTech : liens tel: (numéro reçu de Windows)\n"
        "\tonItechTel: (rappel) => ipcRenderer.on('itech:tel', (event, numero) => rappel(numero)),\n"
        "\titechTelEnAttente: () => ipcRenderer.invoke('itech:tel:enAttente'),\n")
    if texte.count(ancien) != 1:
        sys.exit("ÉCHEC : focusTalk introuvable ou ambigu dans preload.js")
    preload.write_text(texte.replace(ancien, nouveau), encoding="utf-8")
    print("preload.js : liens tel: transmis à la fenêtre")

# 12. Menu du clic droit : retirer « Toggle Developer Tools » (laissé par Nextcloud avec un « TODO : retirer
#     avant la version finale ») et mettre les entrées en français. Les outils de développement restent
#     accessibles au clavier (Ctrl+Maj+I) pour le dépannage.
menu = racine / "src/app/applyContextMenu.js"
texte = menu.read_text(encoding="utf-8")
if "ajout iTech : menu en français" not in texte:
    for ancien, nouveau in (
        ("\t\t// TODO Remove or hide from production DevTools toggle before final release\n"
         "\t\tmenuItems.push({ role: 'toggleDevTools' })\n",
         "\t\t// ajout iTech : menu en français, sans « Toggle Developer Tools » ; pas de séparateur final\n"
         "\t\twhile (menuItems.length && menuItems[menuItems.length - 1].type === 'separator') {\n"
         "\t\t\tmenuItems.pop()\n\t\t}\n\t\tif (!menuItems.length) {\n\t\t\treturn\n\t\t}\n"),
        ("label: 'Add to dictionary'", "label: 'Ajouter au dictionnaire'"),
        ("label: 'Copy image'", "label: 'Copier l\\'image'"),
        ("label: 'Save image'", "label: 'Enregistrer l\\'image'"),
        ("label: 'Copy link address'", "label: 'Copier l\\'adresse du lien'"),
        ("label: 'Copy link text'", "label: 'Copier le texte du lien'"),
        ("label: 'Copy email address'", "label: 'Copier l\\'adresse e-mail'"),
        ("\t\t\t\trole: 'copy',\n", "\t\t\t\trole: 'copy',\n\t\t\t\tlabel: 'Copier',\n"),
        ("\t\t\t\trole: 'cut',\n", "\t\t\t\trole: 'cut',\n\t\t\t\tlabel: 'Couper',\n"),
        ("\t\t\t\trole: 'selectAll',\n", "\t\t\t\trole: 'selectAll',\n\t\t\t\tlabel: 'Tout sélectionner',\n"),
        ("\t\t\t\trole: 'paste',\n", "\t\t\t\trole: 'paste',\n\t\t\t\tlabel: 'Coller',\n"),
    ):
        if texte.count(ancien) != 1:
            sys.exit(f"ÉCHEC : repère introuvable ou ambigu dans applyContextMenu.js :\n{ancien}")
        texte = texte.replace(ancien, nouveau)
    menu.write_text(texte, encoding="utf-8")
    print("applyContextMenu.js : menu du clic droit en français, sans outils de développement")

# 13. Journal de dépannage sur le poste (src/app/itechJournal.ts, copié par construire.sh) :
#     plantages (fenêtre, audio, GPU…), fenêtre figée, erreurs JavaScript ; rechargement si la fenêtre plante.
main = racine / "src/main.js"
texte = main.read_text(encoding="utf-8")
if "demarrerJournal" not in texte:
    for ancien, nouveau in (
        ("const { reglerCacheAvatars } = require('./app/itechCacheAvatars.ts') // ajout iTech\n",
         "const { reglerCacheAvatars } = require('./app/itechCacheAvatars.ts') // ajout iTech\n"
         "const { demarrerJournal } = require('./app/itechJournal.ts') // ajout iTech\n"),
        # après le choix du dossier de l'application (le journal et les rapports de plantage y sont rangés)
        ("app.setPath('userData', path.join(app.getPath('appData'), app.getName()))\n",
         "app.setPath('userData', path.join(app.getPath('appData'), app.getName()))\n"
         "demarrerJournal() // ajout iTech : journal-itech.log dans le dossier de l'application\n"),
    ):
        if texte.count(ancien) != 1:
            sys.exit(f"ÉCHEC : repère introuvable ou ambigu dans main.js :\n{ancien}")
        texte = texte.replace(ancien, nouveau)
    main.write_text(texte, encoding="utf-8")
    print("main.js : journal de dépannage (journal-itech.log)")

# 14. Fermeture brutale pendant une mise à jour (constatée le 20/11 à 17 h 02 sur le poste 199).
#     Squirrel, en appliquant une mise à jour, lance brièvement le NOUVEL exécutable avec --squirrel-updated
#     (mise à jour des raccourcis). L'instance ouverte reçoit alors « second-instance » depuis un autre chemin
#     (app-<nouvelle version>), croit à une autre installation, lance celle-ci et se ferme ; le lancement
#     technique se ferme aussitôt : plus rien d'ouvert, appel en cours coupé. On ignore ces lancements.
main = racine / "src/main.js"
texte = main.read_text(encoding="utf-8")
if "lancement technique de Squirrel" not in texte:
    ancien = "\tapp.on('second-instance', (event, argv, cwd) => {\n"
    nouveau = (ancien +
        "\t\t// ajout iTech : lancement technique de Squirrel (--squirrel-updated…) pendant une mise à jour :\n"
        "\t\t// ce n'est pas une autre installation, l'application ouverte doit rester ouverte.\n"
        "\t\tif (argv.some((arg) => arg.startsWith('--squirrel-'))) {\n\t\t\treturn\n\t\t}\n")
    if texte.count(ancien) != 1:
        sys.exit("ÉCHEC : gestionnaire second-instance introuvable ou ambigu dans main.js")
    main.write_text(texte.replace(ancien, nouveau), encoding="utf-8")
    print("main.js : mises à jour sans fermeture de l'application (lancements Squirrel ignorés)")

# 15. Icône toujours visible près de l'horloge sous Windows 11 (src/app/itechIconeVisible.ts, copié par construire.sh)
main = racine / "src/main.js"
texte = main.read_text(encoding="utf-8")
if "rendreIconeVisible" not in texte:
    for ancien, nouveau in (
        ("const { reglerCacheAvatars } = require('./app/itechCacheAvatars.ts') // ajout iTech\n",
         "const { reglerCacheAvatars } = require('./app/itechCacheAvatars.ts') // ajout iTech\n"
         "const { rendreIconeVisible } = require('./app/itechIconeVisible.ts') // ajout iTech\n"),
        ("\treglerCacheAvatars() // ajout iTech : photos de profil à jour (cache des avatars)\n",
         "\treglerCacheAvatars() // ajout iTech : photos de profil à jour (cache des avatars)\n"
         "\trendreIconeVisible() // ajout iTech : icône toujours visible près de l'horloge (Windows 11)\n"),
    ):
        if texte.count(ancien) != 1:
            sys.exit(f"ÉCHEC : repère introuvable ou ambigu dans main.js :\n{ancien}")
        texte = texte.replace(ancien, nouveau)
    main.write_text(texte, encoding="utf-8")
    print("main.js : icône toujours visible près de l'horloge")
