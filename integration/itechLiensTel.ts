/**
 * Liens « tel: » et « callto: » ouverts par Hoalen Talk Teams (ajout iTech, 20/11/2026).
 *
 * Un clic sur un numéro dans Outlook, une signature, une page web… ouvre le téléphone de l'application
 * avec le numéro prérempli (l'utilisateur confirme par « Appeler » ou Entrée : pas d'appel accidentel).
 *  - l'application est enregistrée pour ces liens via le lanceur fixe de l'installation (valable
 *    d'une mise à jour à l'autre) ; Windows demande à l'utilisateur, au premier clic, de la choisir
 *    (ou stratégie de groupe « associations par défaut ») ;
 *  - application déjà ouverte : le lien arrive par « second-instance » (traité AVANT la vérification
 *    d'installation de Talk Desktop, qui sinon prendrait le lanceur pour une autre installation) ;
 *  - application fermée : le numéro est gardé jusqu'à ce que la fenêtre le demande.
 */
import type { BrowserWindow } from 'electron'
import { app, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { isWindows } from './system.utils.ts'

const PROTOCOLES = ['tel', 'callto']
let numeroEnAttente: string | null = null

export function extraireNumero(argv: string[]): string | null {
	const lien = argv.find((a) => /^(tel|callto):/i.test(a))
	if (!lien) {
		return null
	}
	let numero = lien.replace(/^(tel|callto):(\/\/)?/i, '')
	try {
		numero = decodeURIComponent(numero)
	} catch {
		// laissé tel quel
	}
	numero = numero.split(/[;?]/)[0].trim()
	return /^[+\d\s.\-()/*#]{2,40}$/.test(numero) ? numero : null
}

export function preparerLiensTel() {
	if (isWindows) {
		const lanceur = path.resolve(path.dirname(process.execPath), '..', path.basename(process.execPath))
		const executable = fs.existsSync(lanceur) ? lanceur : process.execPath
		for (const protocole of PROTOCOLES) {
			app.setAsDefaultProtocolClient(protocole, executable, [])
		}
	}
	numeroEnAttente = extraireNumero(process.argv)
	ipcMain.handle('itech:tel:enAttente', () => {
		const numero = numeroEnAttente
		numeroEnAttente = null
		return numero
	})
}

/** Lien reçu alors que l'application tourne déjà. Renvoie true s'il s'agissait d'un lien tel:. */
export function transmettreNumero(argv: string[], fenetre: BrowserWindow | undefined): boolean {
	const numero = extraireNumero(argv)
	if (!numero) {
		return false
	}
	if (fenetre && !fenetre.isDestroyed()) {
		fenetre.webContents.send('itech:tel', numero)
	} else {
		numeroEnAttente = numero
	}
	return true
}
