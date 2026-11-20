/**
 * Photos de profil à jour sans manipulation (ajout iTech, 20/11/2026).
 *
 * Cause du problème : Nextcloud sert les avatars des AUTRES utilisateurs à une adresse sans numéro
 * de version (/avatar/<identifiant>/<taille>) avec « Cache-Control: private, max-age=86400, immutable ».
 * Une photo ajoutée sur le serveur restait donc invisible jusqu'à 24 h (l'image des initiales,
 * générée avant, était réutilisée sans aucune vérification).
 *
 * Correction :
 *  1. pour les adresses d'avatar, la durée de conservation est ramenée à 5 minutes (au-delà, l'image
 *     est revérifiée : réponse « 304 inchangé » très légère si rien n'a bougé) ;
 *  2. purge unique du cache HTTP au premier lancement de cette version, pour effacer les images
 *     d'initiales déjà mémorisées sur le poste.
 */
import { app, session } from 'electron'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DUREE_AVATAR_S = 300
const ADRESSES_AVATAR = [
	'https://*/index.php/avatar/*',
	'https://*/avatar/*',
	'https://*/ocs/v2.php/apps/spreed/api/v1/room/*/avatar*',
]

export function reglerCacheAvatars() {
	session.defaultSession.webRequest.onHeadersReceived({ urls: ADRESSES_AVATAR }, (details, callback) => {
		const entetes = { ...(details.responseHeaders ?? {}) }
		for (const cle of Object.keys(entetes)) {
			const nom = cle.toLowerCase()
			if (nom === 'cache-control' || nom === 'expires') {
				delete entetes[cle]
			}
		}
		entetes['Cache-Control'] = [`private, max-age=${DUREE_AVATAR_S}`]
		callback({ responseHeaders: entetes })
	})

	// Purge unique : les images d'initiales mises en cache avant cette version (jusqu'à 24 h).
	const repere = join(app.getPath('userData'), 'itech-cache-avatars-v1')
	if (!existsSync(repere)) {
		session.defaultSession.clearCache()
			.then(() => writeFileSync(repere, new Date().toISOString()))
			.catch((erreur) => console.error('[iTech] Purge du cache des avatars impossible', erreur))
	}
}
