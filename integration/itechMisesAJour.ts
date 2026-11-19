/**
 * Mises à jour automatiques de la version personnalisée de Talk Desktop (iTech).
 *
 * La version personnalisée coupe la vérification officielle (GitHub de Nextcloud) : ce module
 * la remplace par notre propre serveur de mises à jour, au format Squirrel.Windows.
 *   - Canal « stable » par défaut ; canal « test » si le fichier
 *     %APPDATA%\Nextcloud Talk 3CX\canal-mises-a-jour.txt contient « test ».
 *   - Ne fonctionne que pour une installation par l'installateur (.exe), pas pour le zip portable.
 *   - Vérifie 2 min après le démarrage puis toutes les 6 h ; la nouvelle version est téléchargée
 *     en arrière-plan et s'installe au prochain démarrage de l'application (jamais pendant un appel).
 */
import { app, autoUpdater } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSquirrel } from './system.utils.ts'

const SERVEUR_MISES_A_JOUR = 'https://maj-talk.itech.ovh'

function canal(): 'stable' | 'test' {
	try {
		const fichier = join(app.getPath('userData'), 'canal-mises-a-jour.txt')
		if (existsSync(fichier) && readFileSync(fichier, 'utf-8').trim().toLowerCase() === 'test') {
			return 'test'
		}
	} catch {
		// fichier illisible : canal stable
	}
	return 'stable'
}

export function demarrerMisesAJourItech() {
	if (!isSquirrel) {
		return
	}
	const url = `${SERVEUR_MISES_A_JOUR}/${canal()}/windows-x64`
	try {
		autoUpdater.setFeedURL({ url })
	} catch (erreur) {
		console.error('[iTech] Mises à jour : adresse refusée', erreur)
		return
	}
	autoUpdater.on('error', (erreur) => console.error('[iTech] Mises à jour : erreur', erreur?.message ?? erreur))
	autoUpdater.on('update-available', () => console.log('[iTech] Mises à jour : nouvelle version, téléchargement…'))
	autoUpdater.on('update-downloaded', () => console.log('[iTech] Mises à jour : prête, installée au prochain démarrage'))

	const verifier = () => {
		try {
			autoUpdater.checkForUpdates()
		} catch (erreur) {
			console.error('[iTech] Mises à jour : vérification impossible', erreur)
		}
	}
	setTimeout(verifier, 2 * 60 * 1000)
	setInterval(verifier, 6 * 60 * 60 * 1000)
}
