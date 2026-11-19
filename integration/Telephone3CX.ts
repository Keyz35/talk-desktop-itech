/**
 * Téléphone dans Talk Desktop : amorce du clavier et du téléphone intégré communs
 * (telephone-noyau.js et jssip.min.js, copiés depuis l'appli Nextcloud telephone3cx à la compilation).
 * Les requêtes passent par @nextcloud/axios : Talk Desktop y ajoute lui-même
 * le mot de passe d'application de l'utilisateur et l'en-tête OCS.
 */
import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'
// JsSIP d'abord : le noyau l'utilise (window.JsSIP) pour le téléphone intégré.
import './jssip.min.js'
import './telephone-noyau.js'
import './telephone.css'

type Reponse = { ok: boolean, statut?: number, message?: string, [cle: string]: unknown }

declare global {
	interface Window {
		Telephone3CX: { monter(options: { conteneur: HTMLElement | null, api: typeof api }): unknown }
	}
}

async function api(methode: 'GET' | 'POST', action: string, donnees?: Record<string, string>): Promise<Reponse> {
	try {
		const reponse = await axios.request({
			method: methode,
			url: generateOcsUrl('apps/telephone3cx/api/v1/' + action),
			params: { format: 'json', ...(methode === 'GET' ? donnees : {}) },
			data: methode === 'POST' ? donnees : undefined,
			validateStatus: () => true,
		})
		if (reponse.status === 429) {
			return { ok: false, statut: 429, message: 'Trop d\'appels en peu de temps : patientez une minute.' }
		}
		const resultat = reponse.data?.ocs?.data
		if (resultat && typeof resultat === 'object' && 'ok' in resultat) {
			return { ...resultat, statut: reponse.status }
		}
		return { ok: false, statut: reponse.status, message: `Réponse inattendue du serveur (${reponse.status}).` }
	} catch {
		return { ok: false, statut: 0, message: 'Serveur injoignable : vérifiez votre connexion.' }
	}
}

/**
 * Place le bouton Téléphone dans l'élément donné (barre de titre).
 * Le bouton disparaît de lui-même si le compte n'a pas droit au téléphone.
 */
export function monterTelephone(conteneur: HTMLElement | null) {
	window.Telephone3CX.monter({ conteneur, api })
}
