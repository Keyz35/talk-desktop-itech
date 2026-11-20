/**
 * Icône toujours visible près de l'horloge, sans passer par la petite flèche (ajout iTech, 20/11/2026).
 *
 * Windows 11 range les icônes de la zone de notification dans le menu de dépassement (la flèche) par défaut.
 * Le choix « toujours afficher » est enregistré par exécutable dans le profil de l'utilisateur :
 *   HKCU\Control Panel\NotifyIconSettings\<n°>  ExecutablePath = chemin de l'exe,  IsPromoted = 1 (visible)
 * Squirrel installe chaque version dans un nouveau dossier (app-2.3.xxx) : Windows y voit une nouvelle icône,
 * masquée. On met donc IsPromoted = 1 sur l'entrée de l'exécutable en cours, UNE fois par entrée (repère
 * dans le dossier de l'application) : si l'utilisateur masque ensuite l'icône, son choix est respecté.
 * Windows ne crée l'entrée qu'après le premier affichage de l'icône : on essaie après 15 s, puis 2 min.
 * Sans effet sous Windows 10 (réglage d'une autre forme) et hors Windows.
 */
import { app } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CLE = 'HKCU\\Control Panel\\NotifyIconSettings'

function reg(args: string[]): Promise<string> {
	return new Promise((resolve) => {
		execFile('reg.exe', args, { windowsHide: true, timeout: 15000 }, (erreur, sortie) => resolve(erreur ? '' : String(sortie)))
	})
}

async function promouvoir() {
	const repere = join(app.getPath('userData'), 'itech-icone-visible.json')
	let dejaFaites: string[] = []
	try {
		dejaFaites = existsSync(repere) ? JSON.parse(readFileSync(repere, 'utf-8')) : []
	} catch {
		dejaFaites = []
	}

	const sortie = await reg(['query', CLE, '/s', '/v', 'ExecutablePath'])
	const exe = process.execPath.toLowerCase()
	// Windows peut abréger le début du chemin par l'identifiant du dossier « AppData\Local » ({F1B32785-…}) :
	// (ou l'écrire avec des accents mal rendus par reg.exe) : on compare alors la fin du chemin (…\hoalentalkteams\app-2.3.xxx\hoalen talk teams.exe).
	const local = (process.env.LOCALAPPDATA || '').toLowerCase()
	const fin = local && exe.startsWith(local) ? exe.slice(local.length) : ''
	let cleCourante = ''
	const aPromouvoir: string[] = []
	for (const ligne of sortie.split(/\r?\n/)) {
		if (/^HKEY_/i.test(ligne.trim())) {
			cleCourante = ligne.trim()
		} else if (/ExecutablePath\s+REG_SZ\s+/i.test(ligne)) {
			const chemin = ligne.replace(/^.*?REG_SZ\s+/i, '').trim().toLowerCase()
			if ((chemin === exe || (fin && chemin.endsWith(fin))) && cleCourante && !dejaFaites.includes(cleCourante)) {
				aPromouvoir.push(cleCourante)
			}
		}
	}
	for (const cle of aPromouvoir) {
		await reg(['add', cle, '/v', 'IsPromoted', '/t', 'REG_DWORD', '/d', '1', '/f'])
		dejaFaites.push(cle)
		console.log('[iTech] Icône de la zone de notification rendue visible :', cle)
	}
	if (aPromouvoir.length) {
		try {
			writeFileSync(repere, JSON.stringify(dejaFaites.slice(-50)))
		} catch {
			// repère impossible : on réessaiera au prochain démarrage, sans inconvénient
		}
	}
}

export function rendreIconeVisible() {
	if (process.platform !== 'win32') {
		return
	}
	setTimeout(() => promouvoir().catch(() => {}), 15 * 1000)
	setTimeout(() => promouvoir().catch(() => {}), 2 * 60 * 1000)
}
