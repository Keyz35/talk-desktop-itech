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
