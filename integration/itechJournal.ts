/**
 * Journal de dépannage sur le poste (ajout iTech, 20/11/2026).
 *
 * Talk Desktop n'écrit aucun journal : après un plantage, on ne sait pas ce qui s'est passé.
 * Ce module écrit dans %APPDATA%\Hoalen Talk Teams\journal-itech.log (1 Mo maximum, ancien journal gardé
 * en journal-itech.log.1) :
 *  - le démarrage (version, Windows) ;
 *  - la chute d'un processus : fenêtre (« render-process-gone »), audio, GPU, réseau (« child-process-gone »),
 *    fenêtre figée (« unresponsive ») ;
 *  - les erreurs JavaScript des pages (console, niveau « error ») et les messages du téléphone [tel3cx].
 * Les rapports de plantage natifs (minidumps) restent sur le poste, dans le dossier Crashpad : rien n'est envoyé.
 *
 * Si la fenêtre plante, elle est rechargée automatiquement (le poste se réenregistre sur le standard).
 */
import { app, crashReporter, type WebContents } from 'electron'
import { appendFileSync, existsSync, renameSync, statSync } from 'node:fs'
import { release } from 'node:os'
import { join } from 'node:path'

const TAILLE_MAX = 1024 * 1024
let fichier = ''

function ecrire(ligne: string) {
	try {
		if (!fichier) {
			fichier = join(app.getPath('userData'), 'journal-itech.log')
		}
		if (existsSync(fichier) && statSync(fichier).size > TAILLE_MAX) {
			renameSync(fichier, fichier + '.1')
		}
		appendFileSync(fichier, `${new Date().toISOString()} ${ligne.replace(/\s+/g, ' ').slice(0, 2000)}\n`)
	} catch {
		// journal impossible : sans conséquence pour l'application
	}
}

export function demarrerJournal() {
	try {
		crashReporter.start({ uploadToServer: false })
	} catch (erreur) {
		ecrire(`[crashReporter] indisponible : ${erreur}`)
	}

	app.whenReady().then(() => {
		ecrire(`[démarrage] version ${app.getVersion()} Windows ${release()} Electron ${process.versions.electron}`)
	})

	app.on('render-process-gone', (_event, contenu: WebContents, details) => {
		ecrire(`[PLANTAGE fenêtre] raison=${details.reason} code=${details.exitCode} adresse=${contenu.getURL().slice(0, 200)}`)
		if (details.reason !== 'clean-exit' && !contenu.isDestroyed()) {
			setTimeout(() => {
				if (!contenu.isDestroyed()) {
					ecrire('[reprise] rechargement de la fenêtre')
					contenu.reload()
				}
			}, 1000)
		}
	})

	app.on('child-process-gone', (_event, details) => {
		ecrire(`[PLANTAGE processus] type=${details.type} service=${details.serviceName || '-'} nom=${details.name || '-'} raison=${details.reason} code=${details.exitCode}`)
	})

	app.on('web-contents-created', (_event, contenu: WebContents) => {
		contenu.on('unresponsive', () => ecrire(`[fenêtre figée] ${contenu.getURL().slice(0, 200)}`))
		contenu.on('responsive', () => ecrire('[fenêtre de nouveau réactive]'))
		contenu.on('console-message', (...args: unknown[]) => {
			// Electron récent : un seul objet { level, message, sourceId, lineNumber } ; ancien : (event, level, message, line, source)
			const e = args[0] as { level?: string | number, message?: string, sourceId?: string, lineNumber?: number }
			const niveau = e && e.level !== undefined ? e.level : args[1]
			const message = String((e && e.message) ?? args[2] ?? '')
			const source = String((e && e.sourceId) ?? args[4] ?? '')
			const ligne = (e && e.lineNumber) ?? args[3] ?? ''
			if (niveau === 'error' || niveau === 3 || message.includes('[tel3cx]')) {
				ecrire(`[console ${niveau}] ${message} (${source.split('/').pop()}:${ligne})`)
			}
		})
	})
}
