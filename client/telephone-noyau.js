/**
 * Téléphone — noyau commun du clavier et du téléphone intégré.
 * Utilisé tel quel par l'appli Nextcloud (navigateur, voir telephone.js)
 * et par la version personnalisée de Talk Desktop (voir talk-3cx/talk-desktop/).
 * JavaScript simple, sans compilation ; le mode téléphone utilise JsSIP (window.JsSIP).
 *
 * window.Telephone3CX.monter({ conteneur, api })
 *   conteneur : élément où placer le bouton (sinon bouton flottant en bas à droite)
 *   api(methode, action, donnees) -> Promise<{ ok, message?, statut?, ... }>
 *     actions : 'sip' | 'etat' | 'appel' | 'recents' | 'recherche'
 *
 * Deux modes, choisis au démarrage selon la réponse de l'action 'sip' :
 *   - téléphone : identifiants SIP fournis → le navigateur s'enregistre en WebRTC sur le
 *     standard ; appels sortants et entrants, son par le micro et le casque du PC ;
 *   - rappel : pas d'identifiants → le standard fait sonner le poste de l'utilisateur
 *     puis compose le numéro (action 'appel').
 */
(function () {
	'use strict'

	if (window.Telephone3CX) return

	const SVG = {
		tel: '<path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.32.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>',
		raccrocher: '<path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>',
		effacer: '<path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/>',
		micro: '<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>',
		microCoupe: '<path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>',
		attente: '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>',
		clavier: '<path d="M12 19c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM6 1c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12-8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-6 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>',
	}
	const icone = (nom, taille) => `<svg viewBox="0 0 24 24" width="${taille}" height="${taille}" fill="currentColor" aria-hidden="true">${SVG[nom]}</svg>`

	const TOUCHES = [
		['1', ''], ['2', 'ABC'], ['3', 'DEF'],
		['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
		['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
		['*', ''], ['0', '+'], ['#', ''],
	]

	const STUN_PAR_DEFAUT = ['stun:stun.l.google.com:19302', 'stun:stun.nextcloud.com:443']

	// ------------------------------------------------------------------ outils

	function estNumero(texte) {
		return /^[+]?[\d\s.\-()/*#]+$/.test((texte || '').trim())
	}

	/** Numéro à composer : +33 6… → 06… ; +XX… → 00XX… ; garde * et #. */
	function numeroAComposer(texte) {
		let n = (texte || '').replace(/[^\d+*#]/g, '')
		if (n.startsWith('+33')) n = '0' + n.slice(3)
		else if (n.startsWith('0033')) n = '0' + n.slice(4)
		else if (n.startsWith('+')) n = '00' + n.slice(1)
		return n
	}

	function lisible(numero) {
		return /^0\d{9}$/.test(numero) ? numero.replace(/(\d{2})(?=\d)/g, '$1 ') : numero
	}

	function formatDuree(secondes) {
		const m = Math.floor(secondes / 60)
		const s = secondes % 60
		return `${m}:${String(s).padStart(2, '0')}`
	}

	function formatDate(iso) {
		const d = new Date(iso)
		const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
		if (d.toDateString() === new Date().toDateString()) return heure
		return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + heure
	}

	/** Sonnerie et tonalité de retour d'appel générées localement (pas de fichier son). */
	function creerSonnerie() {
		let contexte = null
		let minuterie = null
		let oscillateurs = []

		function bip(frequences, duree) {
			try {
				contexte = contexte || new (window.AudioContext || window.webkitAudioContext)()
				if (contexte.state === 'suspended') contexte.resume()
				const gain = contexte.createGain()
				gain.gain.value = 0.12
				gain.connect(contexte.destination)
				for (const f of frequences) {
					const o = contexte.createOscillator()
					o.frequency.value = f
					o.connect(gain)
					o.start()
					o.stop(contexte.currentTime + duree)
					oscillateurs.push(o)
				}
			} catch (e) { /* son indisponible : on se contente de l'affichage */ }
		}

		return {
			// Appel entrant : deux notes, 1 s toutes les 3 s.
			sonner() {
				this.arreter()
				const cycle = () => { bip([440, 480], 1) }
				cycle()
				minuterie = setInterval(cycle, 3000)
			},
			// Appel sortant sans annonce du correspondant : tonalité française 440 Hz, 1,5 s / 3,5 s.
			retour() {
				this.arreter()
				const cycle = () => { bip([440], 1.5) }
				cycle()
				minuterie = setInterval(cycle, 5000)
			},
			arreter() {
				clearInterval(minuterie)
				minuterie = null
				for (const o of oscillateurs) { try { o.stop() } catch (e) { /* déjà arrêté */ } }
				oscillateurs = []
			},
		}
	}

	// ------------------------------------------------------------------ montage

	function monter({ conteneur, api }) {
		const etat = {
			ouvert: false, libelle: '', minuteRecherche: null, enCours: false,
			mode: 'rappel', identifiants: null, ua: null, enregistre: false,
			session: null, sens: null, debutAppel: null, minuteDuree: null,
			micCoupe: false, enAttente: false, clavierAppel: false, correspondant: '',
		}
		const sonnerie = creerSonnerie()
		const audioDistant = document.createElement('audio')
		audioDistant.autoplay = true
		audioDistant.hidden = true

		const panneau = document.createElement('div')
		panneau.className = 'tel3cx-panneau'
		panneau.setAttribute('role', 'dialog')
		panneau.setAttribute('aria-label', 'Téléphone')
		panneau.hidden = true
		panneau.innerHTML = `
			<div class="tel3cx-tete">
				<span class="tel3cx-titre">Téléphone</span>
				<span class="tel3cx-poste" aria-live="polite"></span>
			</div>
			<div class="tel3cx-appel" hidden aria-live="assertive">
				<div class="tel3cx-appel-etat"></div>
				<div class="tel3cx-appel-qui"></div>
				<div class="tel3cx-appel-duree"></div>
				<div class="tel3cx-appel-entrant">
					<button type="button" class="tel3cx-rond tel3cx-refuser" title="Refuser">${icone('raccrocher', 24)}</button>
					<button type="button" class="tel3cx-rond tel3cx-repondre" title="Répondre">${icone('tel', 24)}</button>
				</div>
				<div class="tel3cx-appel-actions">
					<button type="button" class="tel3cx-action tel3cx-micro" title="Couper le micro">${icone('micro', 20)}<span>Micro</span></button>
					<button type="button" class="tel3cx-action tel3cx-attente" title="Mettre en attente">${icone('attente', 20)}<span>Attente</span></button>
					<button type="button" class="tel3cx-action tel3cx-montrer-clavier" title="Clavier (menus vocaux)">${icone('clavier', 20)}<span>Clavier</span></button>
				</div>
			</div>
			<div class="tel3cx-saisie">
				<input type="text" inputmode="tel" autocomplete="off" spellcheck="false"
					placeholder="Numéro ou nom d'un collègue" aria-label="Numéro ou nom">
				<button type="button" class="tel3cx-effacer" title="Effacer" aria-label="Effacer">${icone('effacer', 20)}</button>
			</div>
			<ul class="tel3cx-suggestions" hidden></ul>
			<div class="tel3cx-clavier">
				${TOUCHES.map(([c, l]) => `<button type="button" data-touche="${c}"><span class="tel3cx-chiffre">${c}</span><span class="tel3cx-lettres">${l || '&nbsp;'}</span></button>`).join('')}
			</div>
			<button type="button" class="tel3cx-appeler">${icone('tel', 20)}<span>Appeler</span></button>
			<button type="button" class="tel3cx-raccrocher" hidden>${icone('raccrocher', 20)}<span>Raccrocher</span></button>
			<div class="tel3cx-message" aria-live="polite" hidden></div>
			<div class="tel3cx-recents-bloc" hidden>
				<div class="tel3cx-sous-titre">Récents</div>
				<ul class="tel3cx-recents"></ul>
			</div>`

		const $ = (s) => panneau.querySelector(s)
		const champ = $('input')
		const message = $('.tel3cx-message')
		const suggestions = $('.tel3cx-suggestions')
		const boutonAppeler = $('.tel3cx-appeler')
		const boutonRaccrocher = $('.tel3cx-raccrocher')
		const zoneAppel = $('.tel3cx-appel')

		// ---------------------------------------------------------- affichage

		function afficherMessage(texte, genre) {
			message.textContent = texte || ''
			message.className = 'tel3cx-message tel3cx-' + (genre || 'info')
			message.hidden = !texte
		}

		function majBouton() {
			const enAppel = !!etat.session
			boutonAppeler.hidden = enAppel
			boutonRaccrocher.hidden = !enAppel
			boutonAppeler.disabled = etat.enCours || !estNumero(champ.value)
				|| (etat.mode === 'telephone' && !etat.enregistre)
			// Pendant un appel, le clavier envoie des touches (menus vocaux) si on l'a demandé.
			const masquerClavier = enAppel && !etat.clavierAppel
			$('.tel3cx-clavier').hidden = masquerClavier
			$('.tel3cx-saisie').hidden = enAppel
			boutonEntete.classList.toggle('tel3cx-sonne', etat.sens === 'entrant' && !!etat.session && !etat.debutAppel)
			boutonEntete.classList.toggle('tel3cx-en-ligne', !!etat.debutAppel)
			pastille.className = 'tel3cx-pastille ' + (etat.mode !== 'telephone' ? '' : etat.enregistre ? 'tel3cx-pret' : 'tel3cx-hors')
		}

		function majStatut(texte, genre, infobulle) {
			const zone = $('.tel3cx-poste')
			zone.className = 'tel3cx-poste ' + (genre || '')
			zone.textContent = texte
			zone.title = infobulle || ''
		}

		function majZoneAppel(texteEtat) {
			const actif = !!etat.session
			zoneAppel.hidden = !actif
			if (!actif) return
			$('.tel3cx-appel-etat').textContent = texteEtat || ''
			$('.tel3cx-appel-qui').textContent = etat.correspondant
			$('.tel3cx-appel-entrant').hidden = !(etat.sens === 'entrant' && !etat.debutAppel)
			$('.tel3cx-appel-actions').hidden = !etat.debutAppel
			$('.tel3cx-micro').classList.toggle('tel3cx-actif', etat.micCoupe)
			$('.tel3cx-micro').innerHTML = icone(etat.micCoupe ? 'microCoupe' : 'micro', 20) + '<span>' + (etat.micCoupe ? 'Micro coupé' : 'Micro') + '</span>'
			$('.tel3cx-attente').classList.toggle('tel3cx-actif', etat.enAttente)
			$('.tel3cx-montrer-clavier').classList.toggle('tel3cx-actif', etat.clavierAppel)
		}

		function remplir(numero, libelle) {
			champ.value = numero
			etat.libelle = libelle || ''
			suggestions.hidden = true
			majBouton()
			champ.focus()
		}

		function ajouter(caractere) {
			if (etat.session && etat.debutAppel) {
				// En communication : touche envoyée au correspondant (menus vocaux).
				try { etat.session.sendDTMF(caractere) } catch (e) { /* touche ignorée */ }
				$('.tel3cx-appel-duree').dataset.touches = (($('.tel3cx-appel-duree').dataset.touches || '') + caractere).slice(-16)
				return
			}
			const debut = champ.selectionStart ?? champ.value.length
			const fin = champ.selectionEnd ?? champ.value.length
			champ.value = champ.value.slice(0, debut) + caractere + champ.value.slice(fin)
			champ.setSelectionRange(debut + 1, debut + 1)
			etat.libelle = ''
			champ.focus()
			surSaisie()
		}

		function surSaisie() {
			majBouton()
			clearTimeout(etat.minuteRecherche)
			const texte = champ.value.trim()
			if (texte.length < 2 || estNumero(texte)) {
				suggestions.hidden = true
				return
			}
			etat.minuteRecherche = setTimeout(async () => {
				const r = await api('GET', 'recherche', { texte })
				if (champ.value.trim() !== texte) return
				suggestions.replaceChildren()
				const liste = (r.ok && r.resultats) || []
				if (!liste.length) {
					const li = document.createElement('li')
					li.className = 'tel3cx-vide'
					li.textContent = r.ok ? 'Aucun collègue trouvé' : (r.message || 'Recherche impossible')
					suggestions.append(li)
				}
				for (const p of liste) {
					const li = document.createElement('li')
					const b = document.createElement('button')
					b.type = 'button'
					b.innerHTML = '<span class="tel3cx-nom"></span><span class="tel3cx-num"></span>'
					b.querySelector('.tel3cx-nom').textContent = p.nom
					b.querySelector('.tel3cx-num').textContent = p.numero
					b.addEventListener('click', () => remplir(p.numero, `${p.nom} (poste ${p.numero})`))
					li.append(b)
					suggestions.append(li)
				}
				suggestions.hidden = false
			}, 250)
		}

		// ---------------------------------------------------------- récents

		const cleRecents = () => 'tel3cx-recents-' + ((etat.identifiants && etat.identifiants.utilisateur) || 'rappel')

		function lireRecentsLocaux() {
			try { return JSON.parse(localStorage.getItem(cleRecents()) || '[]') } catch (e) { return [] }
		}

		function noterRecent(numero, libelle, sens) {
			if (etat.mode !== 'telephone') return
			const liste = lireRecentsLocaux().filter((a) => !(a.numero === numero && a.sens === sens))
			liste.unshift({ date: new Date().toISOString(), numero, libelle, sens })
			try { localStorage.setItem(cleRecents(), JSON.stringify(liste.slice(0, 30))) } catch (e) { /* stockage indisponible */ }
		}

		async function chargerRecents() {
			let appels
			if (etat.mode === 'telephone') {
				appels = lireRecentsLocaux()
			} else {
				const r = await api('GET', 'recents')
				appels = (r.ok && r.appels) || []
			}
			const liste = $('.tel3cx-recents')
			liste.replaceChildren()
			appels = appels.slice(0, 6)
			$('.tel3cx-recents-bloc').hidden = !appels.length
			const fleches = { sortant: '↗ ', entrant: '↙ ', manque: '✕ ' }
			for (const a of appels) {
				const li = document.createElement('li')
				const b = document.createElement('button')
				b.type = 'button'
				b.title = 'Mettre ce numéro dans le clavier'
				b.innerHTML = '<span class="tel3cx-nom"></span><span class="tel3cx-num"></span>'
				b.querySelector('.tel3cx-nom').textContent = (fleches[a.sens] || '') + a.libelle
				if (a.sens === 'manque') b.classList.add('tel3cx-manque')
				b.querySelector('.tel3cx-num').textContent = formatDate(a.date)
				b.addEventListener('click', () => remplir(a.numero, a.libelle))
				li.append(b)
				liste.append(li)
			}
		}

		// ---------------------------------------------------------- mode rappel

		async function chargerEtatRappel() {
			const r = await api('GET', 'etat')
			if (r.statut === 403 || r.statut === 404) {
				conteneurBouton.remove()
				fermer()
				return
			}
			if (!r.ok) {
				majStatut(r.message || 'Poste introuvable', 'tel3cx-attention')
				return
			}
			majStatut(`Poste ${r.poste} · ` + (r.connecte ? 'téléphone connecté' : 'aucun téléphone connecté'),
				r.connecte ? 'tel3cx-connecte' : 'tel3cx-attention',
				r.connecte ? (r.appareils || []).join(', ') : 'Ouvrez l\'application de téléphonie pour pouvoir appeler.')
		}

		async function appelerParRappel() {
			etat.enCours = true
			majBouton()
			afficherMessage('Lancement de l\'appel…', 'info')
			const r = await api('POST', 'appel', { numero: champ.value, libelle: etat.libelle })
			etat.enCours = false
			majBouton()
			if (r.ok) {
				afficherMessage(r.message, 'succes')
				chargerRecents()
			} else {
				afficherMessage(r.message || 'L\'appel n\'a pas pu être lancé.', 'erreur')
			}
		}

		// ---------------------------------------------------------- mode téléphone (SIP WebRTC)

		function demarrerSip(id) {
			const JsSIP = window.JsSIP
			if (!JsSIP) {
				majStatut('Téléphone indisponible (bibliothèque SIP absente)', 'tel3cx-attention')
				return
			}
			etat.mode = 'telephone'
			etat.identifiants = id
			const socket = new JsSIP.WebSocketInterface(id.wss)
			const ua = new JsSIP.UA({
				sockets: [socket],
				uri: `sip:${id.utilisateur}@${id.domaine}`,
				password: id.mot_de_passe,
				display_name: id.nom_affiche || id.utilisateur,
				register: true,
				register_expires: 300,
				session_timers: false,
				user_agent: 'Telephone Nextcloud Talk' + (window.TALK_DESKTOP ? ' Desktop' : ''),
				connection_recovery_min_interval: 2,
				connection_recovery_max_interval: 30,
			})
			etat.ua = ua
			majStatut(`Poste ${id.utilisateur} · connexion…`, '')

			ua.on('registered', () => {
				etat.enregistre = true
				majStatut(`Poste ${id.utilisateur} · prêt`, 'tel3cx-connecte', 'Ce téléphone sonne pour les appels reçus sur votre poste.')
				majBouton()
			})
			ua.on('unregistered', () => {
				etat.enregistre = false
				majStatut(`Poste ${id.utilisateur} · déconnecté`, 'tel3cx-attention')
				majBouton()
			})
			ua.on('registrationFailed', (e) => {
				etat.enregistre = false
				const code = e && e.response && e.response.status_code
				majStatut(code === 401 || code === 403
					? `Poste ${id.utilisateur} · refusé par le standard`
					: `Poste ${id.utilisateur} · standard injoignable, nouvel essai…`, 'tel3cx-attention')
				majBouton()
			})
			ua.on('disconnected', () => {
				if (etat.enregistre) {
					etat.enregistre = false
					majStatut(`Poste ${id.utilisateur} · connexion perdue, reconnexion…`, 'tel3cx-attention')
					majBouton()
				}
			})
			ua.on('newRTCSession', (e) => surNouvelleSession(e))
			ua.start()

			// Libère l'enregistrement proprement quand la page se ferme.
			window.addEventListener('beforeunload', () => { try { ua.stop() } catch (err) { /* sans effet */ } })
		}

		function optionsMedia() {
			const stun = (etat.identifiants && etat.identifiants.stun) || STUN_PAR_DEFAUT
			return {
				mediaConstraints: { audio: true, video: false },
				pcConfig: { iceServers: [{ urls: stun }] },
				rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
			}
		}

		function brancherSession(session) {
			etat.session = session
			// Collecte ICE : on n'attend pas la fin si une adresse publique (STUN) est déjà connue.
			session.on('icecandidate', (d) => {
				if (d.candidate && d.candidate.type === 'srflx') d.ready()
			})
			session.on('peerconnection', (d) => {
				d.peerconnection.addEventListener('track', (t) => {
					if (t.streams && t.streams[0]) audioDistant.srcObject = t.streams[0]
				})
			})
			session.on('progress', (d) => {
				if (etat.sens === 'sortant') {
					// 183 avec son : le correspondant envoie sa propre tonalité ; sinon tonalité locale.
					if (d.response && d.response.body) sonnerie.arreter()
					else sonnerie.retour()
					majZoneAppel('Ça sonne…')
				}
			})
			session.on('confirmed', () => {
				sonnerie.arreter()
				etat.debutAppel = Date.now()
				// Le flux distant peut déjà être là (réponse à un appel entrant).
				const pc = session.connection
				if (pc && !audioDistant.srcObject) {
					const flux = new MediaStream()
					pc.getReceivers().forEach((r) => r.track && flux.addTrack(r.track))
					audioDistant.srcObject = flux
				}
				clearInterval(etat.minuteDuree)
				etat.minuteDuree = setInterval(() => {
					$('.tel3cx-appel-duree').textContent = formatDuree(Math.round((Date.now() - etat.debutAppel) / 1000))
						+ (etat.enAttente ? ' · en attente' : '')
				}, 1000)
				majZoneAppel('En communication')
				majBouton()
				afficherMessage('')
			})
			const fin = (raison) => (d) => {
				const etaitEtabli = !!etat.debutAppel
				const sens = etat.sens
				sonnerie.arreter()
				clearInterval(etat.minuteDuree)
				if (sens === 'entrant' && !etaitEtabli) noterRecent(etat.numeroCorrespondant, etat.correspondant, 'manque')
				Object.assign(etat, { session: null, sens: null, debutAppel: null, micCoupe: false, enAttente: false, clavierAppel: false })
				audioDistant.srcObject = null
				$('.tel3cx-appel-duree').textContent = ''
				majZoneAppel()
				majBouton()
				fermerNotification()
				if (raison === 'echec' && !etaitEtabli && sens === 'sortant') {
					const cause = d && d.cause
					const textes = {
						Busy: 'Le correspondant est occupé.', Rejected: 'Appel refusé.', 'Not Found': 'Numéro inconnu.',
						Unavailable: 'Correspondant indisponible.', 'Request Timeout': 'Pas de réponse.',
						'No Answer': 'Pas de réponse.', 'User Denied Media Access': 'Accès au micro refusé : autorisez le micro puis réessayez.',
						'Address Incomplete': 'Numéro incomplet.', Canceled: '',
					}
					const t = cause in textes ? textes[cause] : `Appel impossible (${cause || 'erreur'}).`
					if (t) afficherMessage(t, 'erreur')
				} else if (etaitEtabli) {
					afficherMessage('Appel terminé.', 'info')
				}
				chargerRecents()
			}
			session.on('ended', fin('fin'))
			session.on('failed', fin('echec'))
		}

		function appelerParSip() {
			const numero = numeroAComposer(champ.value)
			if (!numero) return
			const libelle = etat.libelle || lisible(numero)
			etat.sens = 'sortant'
			etat.correspondant = libelle
			etat.numeroCorrespondant = numero
			afficherMessage('')
			try {
				const session = etat.ua.call(`sip:${numero}@${etat.identifiants.domaine}`, optionsMedia())
				brancherSession(session)
				noterRecent(numero, libelle, 'sortant')
				majZoneAppel('Appel en cours…')
				majBouton()
			} catch (e) {
				etat.sens = null
				afficherMessage('Appel impossible : ' + (e && e.message ? e.message : 'erreur inconnue'), 'erreur')
			}
		}

		let notification = null
		function fermerNotification() {
			if (notification) { try { notification.close() } catch (e) { /* déjà fermée */ } notification = null }
		}

		function ramenerFenetre() {
			try { window.focus() } catch (e) { /* sans effet */ }
			if (window.TALK_DESKTOP && typeof window.TALK_DESKTOP.focusTalk === 'function') {
				window.TALK_DESKTOP.focusTalk()
			}
		}

		function surNouvelleSession(e) {
			if (e.originator !== 'remote') return
			const session = e.session
			if (etat.session) {
				// Déjà en ligne : l'appelant entend « occupé » (le standard peut renvoyer vers la messagerie).
				session.terminate({ status_code: 486, reason_phrase: 'Busy Here' })
				return
			}
			const id = session.remote_identity
			const numero = (id && id.uri && id.uri.user) || 'inconnu'
			const nom = id && id.display_name && id.display_name !== numero ? id.display_name : ''
			etat.sens = 'entrant'
			etat.correspondant = nom ? `${nom} (${lisible(numero)})` : lisible(numero)
			etat.numeroCorrespondant = numero
			brancherSession(session)
			ouvrir()
			majZoneAppel('Appel entrant')
			majBouton()
			sonnerie.sonner()
			try {
				const montrer = () => {
					notification = new Notification('Appel entrant', {
						body: etat.correspondant, tag: 'tel3cx-appel', requireInteraction: true, silent: true,
					})
					notification.onclick = () => { ramenerFenetre(); ouvrir(); fermerNotification() }
				}
				if (window.Notification && Notification.permission === 'granted') montrer()
				else if (window.Notification && Notification.permission !== 'denied') {
					Notification.requestPermission().then((p) => { if (p === 'granted' && etat.session === session && !etat.debutAppel) montrer() })
				}
			} catch (err) { /* notifications indisponibles */ }
		}

		function repondre() {
			if (!etat.session || etat.sens !== 'entrant') return
			sonnerie.arreter()
			fermerNotification()
			try {
				etat.session.answer(optionsMedia())
				majZoneAppel('Connexion…')
			} catch (e) {
				afficherMessage('Impossible de répondre : ' + (e && e.message ? e.message : 'erreur'), 'erreur')
			}
		}

		function raccrocher() {
			if (!etat.session) return
			try {
				if (etat.sens === 'entrant' && !etat.debutAppel) etat.session.terminate({ status_code: 603, reason_phrase: 'Decline' })
				else etat.session.terminate()
			} catch (e) { /* déjà terminé */ }
		}

		function basculerMicro() {
			if (!etat.session) return
			etat.micCoupe = !etat.micCoupe
			if (etat.micCoupe) etat.session.mute({ audio: true }); else etat.session.unmute({ audio: true })
			majZoneAppel('En communication')
		}

		function basculerAttente() {
			if (!etat.session) return
			const ok = etat.enAttente ? etat.session.unhold() : etat.session.hold()
			if (ok !== false) etat.enAttente = !etat.enAttente
			majZoneAppel(etat.enAttente ? 'En attente' : 'En communication')
		}

		// ---------------------------------------------------------- commun

		function appeler() {
			if (boutonAppeler.disabled) return
			if (etat.mode === 'telephone') appelerParSip()
			else appelerParRappel()
		}

		function ouvrir(numero) {
			etat.ouvert = true
			panneau.hidden = false
			boutonEntete.setAttribute('aria-expanded', 'true')
			if (numero && !etat.session) remplir(numero, '')
			if (!etat.session) afficherMessage('')
			if (etat.mode === 'rappel') chargerEtatRappel()
			chargerRecents()
			majBouton()
			if (!etat.session) champ.focus()
		}

		function fermer() {
			etat.ouvert = false
			panneau.hidden = true
			boutonEntete.setAttribute('aria-expanded', 'false')
		}

		// Clavier : un appui long sur 0 donne « + ».
		panneau.querySelectorAll('[data-touche]').forEach((b) => {
			let minuteLong = null
			let long = false
			b.addEventListener('pointerdown', () => {
				long = false
				if (b.dataset.touche === '0' && !etat.session) {
					minuteLong = setTimeout(() => { long = true; ajouter('+') }, 600)
				}
			})
			b.addEventListener('pointerup', () => clearTimeout(minuteLong))
			b.addEventListener('pointerleave', () => clearTimeout(minuteLong))
			b.addEventListener('click', () => { if (!long) ajouter(b.dataset.touche) })
		})

		$('.tel3cx-effacer').addEventListener('click', () => {
			champ.value = champ.value.slice(0, -1)
			etat.libelle = ''
			champ.focus()
			surSaisie()
		})
		champ.addEventListener('input', () => { etat.libelle = ''; surSaisie() })
		champ.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') { e.preventDefault(); appeler() }
		})
		boutonAppeler.addEventListener('click', appeler)
		boutonRaccrocher.addEventListener('click', raccrocher)
		$('.tel3cx-repondre').addEventListener('click', repondre)
		$('.tel3cx-refuser').addEventListener('click', raccrocher)
		$('.tel3cx-micro').addEventListener('click', basculerMicro)
		$('.tel3cx-attente').addEventListener('click', basculerAttente)
		$('.tel3cx-montrer-clavier').addEventListener('click', () => {
			etat.clavierAppel = !etat.clavierAppel
			majZoneAppel(etat.enAttente ? 'En attente' : 'En communication')
			majBouton()
		})

		// ---------------------------------------------------------- bouton d'en-tête

		const boutonEntete = document.createElement('button')
		boutonEntete.type = 'button'
		boutonEntete.className = 'tel3cx-bouton-entete'
		boutonEntete.title = 'Téléphone'
		boutonEntete.setAttribute('aria-label', 'Téléphone')
		boutonEntete.setAttribute('aria-expanded', 'false')
		boutonEntete.innerHTML = icone('tel', 20)
		const pastille = document.createElement('span')
		pastille.className = 'tel3cx-pastille'
		boutonEntete.append(pastille)
		boutonEntete.addEventListener('click', (e) => {
			e.stopPropagation()
			etat.ouvert ? fermer() : ouvrir()
		})

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && etat.ouvert && !etat.session) fermer()
		})
		document.addEventListener('mousedown', (e) => {
			// Pendant un appel, le panneau reste ouvert.
			if (etat.ouvert && !etat.session && !panneau.contains(e.target) && !boutonEntete.contains(e.target)) fermer()
		})
		// Les liens « tel: » de la page ouvrent le clavier avec le numéro.
		document.addEventListener('click', (e) => {
			const lien = e.target.closest && e.target.closest('a[href^="tel:"]')
			if (!lien) return
			e.preventDefault()
			ouvrir(decodeURIComponent(lien.getAttribute('href').slice(4)))
		}, true)

		const conteneurBouton = document.createElement('div')
		conteneurBouton.className = 'tel3cx-entete'
		conteneurBouton.append(boutonEntete)
		if (conteneur) {
			conteneur.prepend(conteneurBouton)
		} else {
			conteneurBouton.classList.add('tel3cx-flottant')
			document.body.append(conteneurBouton)
		}
		document.body.append(panneau, audioDistant)

		// ---------------------------------------------------------- démarrage

		;(async () => {
			const r = await api('GET', 'sip')
			if (r.statut === 403 || r.statut === 404) {
				// Appli non autorisée pour ce compte (ou absente du serveur) : pas de bouton.
				conteneurBouton.remove()
				return
			}
			if (r.ok && r.wss && r.utilisateur && r.mot_de_passe) {
				demarrerSip(r)
			} else {
				etat.mode = 'rappel'
				chargerEtatRappel()
			}
			majBouton()
		})()

		return { ouvrir, fermer }
	}

	window.Telephone3CX = { monter }
})()
