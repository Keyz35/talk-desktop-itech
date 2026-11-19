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
