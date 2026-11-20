/**
 * Lancement automatique à l'ouverture de session Windows (ajout iTech, 20/11/2026).
 *
 * Sans l'application ouverte, le poste ne reçoit pas les appels. Talk Desktop sait démarrer avec
 * Windows, en arrière-plan (réduit dans la zone de notification), mais l'option est désactivée par
 * défaut : on l'active UNE SEULE FOIS, au premier lancement de cette version. Si l'utilisateur la
 * désactive ensuite dans les paramètres de l'application, son choix est respecté.
 */
import { app } from 'electron'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setLaunchAtStartup } from './launchAtStartup.config.ts'
import { isWindows } from './system.utils.ts'

export function activerDemarrageAutomatique() {
	if (!isWindows) {
		return
	}
	const repere = join(app.getPath('userData'), 'itech-demarrage-automatique-v1')
	if (existsSync(repere)) {
		return
	}
	try {
		setLaunchAtStartup(true)
		writeFileSync(repere, new Date().toISOString())
	} catch (erreur) {
		console.error('[iTech] Activation du lancement automatique impossible', erreur)
	}
}
