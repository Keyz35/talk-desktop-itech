/**
 * Téléphone — noyau commun du clavier et du téléphone intégré.
 * Utilisé tel quel par l'appli Nextcloud (navigateur, voir telephone.js)
 * et par la version personnalisée de Talk Desktop (voir talk-3cx/talk-desktop/).
 * JavaScript simple, sans compilation ; le mode téléphone utilise JsSIP (window.JsSIP).
 *
 * window.Telephone3CX.monter({ conteneur, api, reunion })
 *   reunion() -> Promise<{ ok, lien_organisateur?, lien_invites?, message? }> (appli « Réunions », Jitsi)
 *   ocs(methode, chemin, donnees) -> Promise<données OCS> (API Nextcloud, ex. statut utilisateur)
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

	/** « Poste 198 · 02 30 96 12 89 » : numéro direct (SDA) ajouté s'il est fourni par le standard. */
	function libellePoste(id) {
		const sda = id && id.sda ? lisible(numeroAComposer(String(id.sda))) : ''
		return `Poste ${id.utilisateur}` + (sda ? ` · ${sda}` : '')
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

	function monter({ conteneur, api, reunion, ocs }) {
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
		const audioConsult = document.createElement('audio')  // second appel (transfert après annonce, conférence)
		audioConsult.autoplay = true
		audioConsult.hidden = true

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
					<button type="button" class="tel3cx-action tel3cx-montrer-transfert" title="Transférer l'appel ou ajouter une personne">${icone('tel', 20)}<span>Transférer / Ajouter</span></button>
				</div>
				<div class="tel3cx-appel-second" hidden></div>
				<div class="tel3cx-transfert" hidden>
					<input type="text" class="tel3cx-transfert-champ" autocomplete="off" spellcheck="false"
						placeholder="Numéro, poste ou nom" aria-label="Destinataire du transfert">
					<div class="tel3cx-transfert-cible" aria-live="polite"></div>
					<div class="tel3cx-transfert-boutons">
						<button type="button" data-transfert="direct" title="Le correspondant est envoyé tout de suite au destinataire">Transférer</button>
						<button type="button" data-transfert="annonce" title="Votre correspondant patiente ; vous parlez d'abord au destinataire">Appeler d'abord</button>
						<button type="button" data-transfert="ajouter" title="Appeler la personne et l'ajouter à la conversation">Ajouter à l'appel</button>
					</div>
				</div>
				<div class="tel3cx-consultation" hidden>
					<button type="button" data-consultation="terminer">Terminer le transfert</button>
					<button type="button" data-consultation="conference">Conférence à trois</button>
					<button type="button" data-consultation="revenir">Revenir</button>
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
		const champ = $('.tel3cx-saisie input')  // champ du numéro (et non celui du transfert, placé avant)
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
			// Transfert / consultation / conférence
			const consult = etat.consult
			const second = $('.tel3cx-appel-second')
			second.hidden = !consult
			if (consult) {
				second.textContent = etat.conference
					? `Conférence avec ${etat.correspondantConsult}`
					: `Avec ${etat.correspondantConsult}${etat.consultEtablie ? '' : ' (ça sonne…)'} — ${etat.correspondant} patiente`
			}
			$('.tel3cx-transfert').hidden = !etat.transfertOuvert || !!consult || !etat.debutAppel
			$('.tel3cx-consultation').hidden = !consult || etat.conference || !etat.consultEtablie
			$('.tel3cx-montrer-transfert').hidden = !!consult
			$('.tel3cx-montrer-transfert').classList.toggle('tel3cx-actif', !!etat.transfertOuvert)
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

		// Appels manqués non encore consultés : alerte « ! » rouge sur le bouton du pavé (tableau de bord).
		const cleManques = () => 'tel3cx-manques-' + ((etat.identifiants && etat.identifiants.utilisateur) || 'rappel')
		function lireManques() {
			try { return parseInt(localStorage.getItem(cleManques()) || '0', 10) || 0 } catch (e) { return 0 }
		}
		function changerManques(n) {
			try { localStorage.setItem(cleManques(), String(n)) } catch (e) { /* stockage indisponible */ }
			majAlerteManques()
		}
		function majAlerteManques() {
			const n = lireManques()
			alerteManques.hidden = n === 0
			boutonTableau.title = n === 0
				? 'Téléphonie : contacts, appels récents, pavé numérique'
				: `${n} appel${n > 1 ? 's' : ''} manqué${n > 1 ? 's' : ''} — ouvrir la téléphonie`
			boutonTableau.setAttribute('aria-label', n === 0 ? 'Téléphonie' : `Téléphonie, ${n} appel${n > 1 ? 's' : ''} manqué${n > 1 ? 's' : ''}`)
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
			majAlerteManques()
			chargerIndexNoms(true)  // noms des appelants (carnet + collègues), puis rafraîchi toutes les 30 min
			setInterval(() => chargerIndexNoms(false), 5 * 60 * 1000)
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
			majStatut(`${libellePoste(id)} · connexion…`, '')

			ua.on('registered', () => {
				etat.enregistre = true
				majStatut(`${libellePoste(id)} · prêt`, 'tel3cx-connecte', 'Ce téléphone sonne pour les appels reçus sur votre poste.')
				majBouton()
			})
			ua.on('unregistered', () => {
				etat.enregistre = false
				majStatut(`${libellePoste(id)} · déconnecté`, 'tel3cx-attention')
				majBouton()
			})
			ua.on('registrationFailed', (e) => {
				etat.enregistre = false
				const code = e && e.response && e.response.status_code
				majStatut(code === 401 || code === 403
					? `${libellePoste(id)} · refusé par le standard`
					: `${libellePoste(id)} · standard injoignable, nouvel essai…`, 'tel3cx-attention')
				majBouton()
			})
			ua.on('disconnected', () => {
				if (etat.enregistre) {
					etat.enregistre = false
					majStatut(`${libellePoste(id)} · connexion perdue, reconnexion…`, 'tel3cx-attention')
					majBouton()
				}
			})
			ua.on('newRTCSession', (e) => surNouvelleSession(e))
			ua.start()

			// Libère l'enregistrement proprement quand la page se ferme.
			window.addEventListener('beforeunload', () => { try { ua.stop() } catch (err) { /* sans effet */ } })
		}

		// Statut Nextcloud « 📞 En communication » pendant un appel, puis restauration du statut précédent.
		// Effacé de lui-même au bout de 4 h si l'application se fermait en plein appel.
		async function signalerEnCommunication(actif) {
			if (typeof ocs !== 'function') return
			const base = 'apps/user_status/api/v1/user_status'
			try {
				if (actif) {
					const avant = await ocs('GET', base).catch(() => null)
					etat.statutAvant = avant && avant.message !== 'En communication' ? avant : (etat.statutAvant || null)
					await ocs('PUT', base + '/message/custom', {
						statusIcon: '📞', message: 'En communication', clearAt: Math.floor(Date.now() / 1000) + 4 * 3600,
					})
				} else {
					const a = etat.statutAvant
					etat.statutAvant = null
					if (a && a.messageId && a.messageIsPredefined) {
						await ocs('PUT', base + '/message/predefined', { messageId: a.messageId, clearAt: a.clearAt || null })
					} else if (a && a.message) {
						await ocs('PUT', base + '/message/custom', { statusIcon: a.icon || '', message: a.message, clearAt: a.clearAt || null })
					} else {
						await ocs('DELETE', base + '/message')
					}
				}
			} catch (e) { /* statut non modifiable : sans conséquence pour l'appel */ }
		}

		function optionsMedia() {
			const stun = (etat.identifiants && etat.identifiants.stun) || STUN_PAR_DEFAUT
			return {
				mediaConstraints: { audio: true, video: false },
				pcConfig: { iceServers: [{ urls: stun }] },
				rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
			}
		}

		function brancherSession(sessionInitiale) {
			let session = sessionInitiale
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
				signalerEnCommunication(true)
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
				if (etat.session !== session) return
				if (etat.consult) {
					const b = etat.consult
					arreterMixage()
					if (etat.transfertAccepte) {
						try { b.terminate() } catch (e) { /* déjà fini */ }
					} else if (etat.consultEtablie) {
						// Le premier correspondant a raccroché : on continue avec le second.
						const qui = etat.correspondant
						Object.assign(etat, {
							session: b, consult: null, consultEtablie: false, conference: false, enAttente: false,
							correspondant: etat.correspondantConsult, numeroCorrespondant: '', sens: 'sortant',
						})
						audioDistant.srcObject = audioConsult.srcObject || fluxDistant(b)
						audioConsult.srcObject = null
						b.removeAllListeners('ended')
						b.removeAllListeners('failed')
						b.on('ended', fin('fin'))
						b.on('failed', fin('echec'))
						session = b
						afficherMessage(`${qui} a raccroché : vous restez en ligne.`, 'info')
						majZoneAppel('En communication')
						majBouton()
						return
					} else {
						try { b.terminate() } catch (e) { /* déjà fini */ }
					}
					Object.assign(etat, { consult: null, consultEtablie: false, conference: false })
					audioConsult.srcObject = null
				}
				etat.transfertAccepte = false
				etat.transfertOuvert = false
				const etaitEtabli = !!etat.debutAppel
				const sens = etat.sens
				if (etaitEtabli) signalerEnCommunication(false)
				sonnerie.arreter()
				clearInterval(etat.minuteDuree)
				// Appel décroché ailleurs (autre appareil du même poste, collègue d'un groupe d'appel) : le standard
				// annule la sonnerie ici avec « Reason: SIP;cause=200 » (« Call completed elsewhere ») ou « Q.850;cause=26 ».
				const raisonAnnulation = (d && d.message && typeof d.message.getHeader === 'function' && d.message.getHeader('Reason')) || ''
				const prisAilleurs = sens === 'entrant' && !etaitEtabli && /SIP\s*;\s*cause\s*=\s*200\b|Q\.850\s*;\s*cause\s*=\s*26\b|completed elsewhere|NON_SELECTED_USER_CLEARING/i.test(raisonAnnulation)
				if (sens === 'entrant' && !etaitEtabli && !prisAilleurs) {
					noterRecent(etat.numeroCorrespondant, etat.correspondant, 'manque')
					// Refus volontaire (bouton Refuser) : pas d'alerte ; sinon appel manqué signalé sur le bouton du pavé.
					if (!etat.refusVolontaire && !etat.tableau) changerManques(lireManques() + 1)
				}
				etat.refusVolontaire = false
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
				if (etat.tableau) setTimeout(chargerHistorique, 1500) // le temps que le standard enregistre l'appel
			}
			session.on('ended', fin('fin'))
			session.on('failed', fin('echec'))
		}

		function appelerParSip() {
			const numero = numeroAComposer(champ.value)
			if (!numero) return
			const connu = nomPourNumero(numero)
			const libelle = etat.libelle || (connu ? `${connu} (${lisible(numero)})` : lisible(numero))
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
			if (etat.session || etat.consult) {
				// Déjà en ligne : l'appelant entend « occupé » (le standard peut renvoyer vers la messagerie).
				session.terminate({ status_code: 486, reason_phrase: 'Busy Here' })
				return
			}
			const id = session.remote_identity
			const numero = (id && id.uri && id.uri.user) || 'inconnu'
			const nomStandard = id && id.display_name && id.display_name !== numero ? id.display_name : ''
			const nom = nomPourNumero(numero) || nomStandard
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
			if (etat.consult) { try { etat.consult.terminate() } catch (e) { /* déjà fini */ } }
			try {
				if (etat.sens === 'entrant' && !etat.debutAppel) {
					etat.refusVolontaire = true
					etat.session.terminate({ status_code: 603, reason_phrase: 'Decline' })
				}
				else etat.session.terminate()
			} catch (e) { /* déjà terminé */ }
		}

		function basculerMicro() {
			if (!etat.session) return
			etat.micCoupe = !etat.micCoupe
			if (etat.micCoupe) etat.session.mute({ audio: true }); else etat.session.unmute({ audio: true })
			majZoneAppel('En communication')
		}

		// ------------------------------------------------ transfert, consultation et conférence à trois

		function cibleSip(numero) { return `sip:${numero}@${etat.identifiants.domaine}` }

		/** Destination saisie : numéro / poste, ou nom (carnet et collègues). */
		function resoudreDestination(texte) {
			const t = (texte || '').trim()
			if (!t) return null
			if (estNumero(t)) {
				const numero = numeroAComposer(t)
				const connu = nomPourNumero(numero)
				return { numero, libelle: connu ? `${connu} (${lisible(numero)})` : lisible(numero) }
			}
			const mots = sansAccents(t).split(/\s+/).filter(Boolean)
			for (const c of etat.contacts || []) {
				if (mots.every((m) => sansAccents(c.nom).includes(m))) return { numero: c.poste, libelle: `${c.nom} (poste ${c.poste})` }
			}
			for (const c of etat.mesContacts || []) {
				if (mots.every((m) => sansAccents(c.nom + ' ' + (c.societe || '')).includes(m)) && c.numeros && c.numeros[0]) {
					const numero = numeroAComposer(c.numeros[0].numero)
					return { numero, libelle: `${c.nom} (${lisible(numero)})` }
				}
			}
			return null
		}

		function fluxDistant(session) {
			const flux = new MediaStream()
			const pc = session && session.connection
			if (pc) pc.getReceivers().forEach((r) => r.track && r.track.kind === 'audio' && flux.addTrack(r.track))
			return flux
		}

		function transfererDirect(dest) {
			const a = etat.session
			try {
				const r = a.refer(cibleSip(dest.numero))
				afficherMessage(`Transfert vers ${dest.libelle}…`, 'info')
				r.on('accepted', () => {
					afficherMessage(`Appel transféré à ${dest.libelle}.`, 'succes')
					setTimeout(() => { try { if (etat.session === a) a.terminate() } catch (e) { /* déjà fini */ } }, 1500)
				})
				const echec = () => afficherMessage('Le transfert a échoué : vous êtes toujours en communication.', 'erreur')
				r.on('requestFailed', echec)
				r.on('failed', echec)
			} catch (e) {
				afficherMessage('Transfert impossible : ' + (e && e.message ? e.message : 'erreur'), 'erreur')
			}
		}

		function appelerConsultation(dest, ajouter) {
			const a = etat.session
			if (!etat.enAttente) { a.hold(); etat.enAttente = true }
			etat.correspondantConsult = dest.libelle
			etat.consultEtablie = false
			etat.ajoutConference = !!ajouter
			etat.transfertOuvert = false
			let b
			try {
				b = etat.ua.call(cibleSip(dest.numero), optionsMedia())
			} catch (e) {
				a.unhold(); etat.enAttente = false
				afficherMessage('Appel impossible : ' + (e && e.message ? e.message : 'erreur'), 'erreur')
				majZoneAppel('En communication')
				return
			}
			etat.consult = b
			b.on('icecandidate', (d) => { if (d.candidate && d.candidate.type === 'srflx') d.ready() })
			b.on('peerconnection', (d) => d.peerconnection.addEventListener('track', (t) => {
				if (t.streams && t.streams[0]) audioConsult.srcObject = t.streams[0]
			}))
			b.on('progress', (d) => { if (!(d.response && d.response.body)) sonnerie.retour() })
			b.on('confirmed', () => {
				sonnerie.arreter()
				etat.consultEtablie = true
				if (!audioConsult.srcObject) audioConsult.srcObject = fluxDistant(b)
				if (etat.ajoutConference) demarrerConference()
				majZoneAppel(etat.conference ? 'Conférence à trois' : 'En communication')
				majBouton()
			})
			const finB = (d) => finConsultation(b, d)
			b.on('ended', finB)
			b.on('failed', finB)
			afficherMessage('')
			majZoneAppel('En attente')
		}

		function finConsultation(b, d) {
			if (etat.consult !== b) return
			sonnerie.arreter()
			arreterMixage()
			const etaitConference = etat.conference
			const etaitEtablie = etat.consultEtablie
			const qui = etat.correspondantConsult
			Object.assign(etat, { consult: null, consultEtablie: false, conference: false, ajoutConference: false })
			audioConsult.srcObject = null
			if (etat.transfertAccepte) {
				etat.transfertAccepte = false
				return
			}
			const a = etat.session
			if (a && etat.enAttente) { try { a.unhold() } catch (e) { /* sans effet */ } etat.enAttente = false }
			if (etaitConference) afficherMessage(`${qui} a quitté la conférence.`, 'info')
			else if (!etaitEtablie && d && d.cause) afficherMessage(`${qui} n'a pas répondu : vous reprenez votre correspondant.`, 'info')
			majZoneAppel(a ? 'En communication' : '')
			majBouton()
		}

		function terminerTransfert() {
			const a = etat.session
			const b = etat.consult
			if (!a || !b) return
			try {
				const r = a.refer(b.remote_identity.uri, { replaces: b })
				afficherMessage(`Mise en relation avec ${etat.correspondantConsult}…`, 'info')
				r.on('accepted', () => {
					etat.transfertAccepte = true
					afficherMessage('Transfert effectué : vos deux correspondants sont en relation.', 'succes')
					setTimeout(() => {
						for (const s2 of [b, a]) { try { s2.terminate() } catch (e) { /* déjà fini */ } }
					}, 2000)
				})
				const echec = () => afficherMessage('Le transfert a échoué : utilisez « Revenir » ou « Conférence à trois ».', 'erreur')
				r.on('requestFailed', echec)
				r.on('failed', echec)
			} catch (e) {
				afficherMessage('Transfert impossible : ' + (e && e.message ? e.message : 'erreur'), 'erreur')
			}
		}

		// Conférence à trois : chaque correspondant reçoit votre voix + celle de l'autre (mélange local).
		let mixage = null
		function demarrerConference() {
			const a = etat.session
			const b = etat.consult
			if (!a || !b || etat.conference) return
			try {
				if (etat.enAttente) { a.unhold(); etat.enAttente = false }
				const ctx = new (window.AudioContext || window.webkitAudioContext)()
				const senderA = a.connection.getSenders().find((x) => x.track && x.track.kind === 'audio')
				const senderB = b.connection.getSenders().find((x) => x.track && x.track.kind === 'audio')
				const micro = ctx.createMediaStreamSource(new MediaStream([senderA.track]))
				const versA = ctx.createMediaStreamDestination()
				const versB = ctx.createMediaStreamDestination()
				micro.connect(versA)
				micro.connect(versB)
				ctx.createMediaStreamSource(fluxDistant(b)).connect(versA)
				ctx.createMediaStreamSource(fluxDistant(a)).connect(versB)
				mixage = { ctx, senderA, senderB, pisteA: senderA.track, pisteB: senderB.track }
				senderA.replaceTrack(versA.stream.getAudioTracks()[0])
				senderB.replaceTrack(versB.stream.getAudioTracks()[0])
				etat.conference = true
				afficherMessage('Conférence à trois : chacun entend les deux autres.', 'succes')
			} catch (e) {
				arreterMixage()
				afficherMessage('Conférence impossible sur ce poste : ' + (e && e.message ? e.message : 'erreur'), 'erreur')
			}
			majZoneAppel(etat.conference ? 'Conférence à trois' : 'En communication')
		}
		function arreterMixage() {
			if (!mixage) return
			try { mixage.senderA.replaceTrack(mixage.pisteA) } catch (e) { /* appel terminé */ }
			try { mixage.senderB.replaceTrack(mixage.pisteB) } catch (e) { /* appel terminé */ }
			try { mixage.ctx.close() } catch (e) { /* déjà fermé */ }
			mixage = null
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
			if (etat.tableau) return // dans le tableau de bord, le pavé reste affiché
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
		const champTransfert = $('.tel3cx-transfert-champ')
		const cibleTransfert = $('.tel3cx-transfert-cible')
		$('.tel3cx-montrer-transfert').addEventListener('click', () => {
			etat.transfertOuvert = !etat.transfertOuvert
			etat.clavierAppel = false
			majZoneAppel(etat.enAttente ? 'En attente' : 'En communication')
			majBouton()
			if (etat.transfertOuvert) { champTransfert.value = ''; cibleTransfert.textContent = ''; champTransfert.focus() }
		})
		champTransfert.addEventListener('input', () => {
			const dest = resoudreDestination(champTransfert.value)
			cibleTransfert.textContent = dest ? `→ ${dest.libelle}` : (champTransfert.value.trim() ? 'Destinataire introuvable' : '')
		})
		champTransfert.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); panneau.querySelector('[data-transfert="annonce"]').click() } })
		panneau.querySelectorAll('[data-transfert]').forEach((b) => b.addEventListener('click', () => {
			const dest = resoudreDestination(champTransfert.value)
			if (!dest) { cibleTransfert.textContent = 'Indiquez un numéro, un poste ou un nom connu.'; champTransfert.focus(); return }
			if (dest.numero === (etat.identifiants && etat.identifiants.utilisateur)) { cibleTransfert.textContent = 'C\'est votre propre poste.'; return }
			etat.transfertOuvert = false
			if (b.dataset.transfert === 'direct') transfererDirect(dest)
			else appelerConsultation(dest, b.dataset.transfert === 'ajouter')
			majBouton()
		}))
		panneau.querySelectorAll('[data-consultation]').forEach((b) => b.addEventListener('click', () => {
			const action = b.dataset.consultation
			if (action === 'terminer') terminerTransfert()
			else if (action === 'conference') demarrerConference()
			else if (action === 'revenir' && etat.consult) { try { etat.consult.terminate() } catch (e) { /* déjà fini */ } }
		}))

		$('.tel3cx-montrer-clavier').addEventListener('click', () => {
			etat.clavierAppel = !etat.clavierAppel
			majZoneAppel(etat.enAttente ? 'En attente' : 'En communication')
			majBouton()
		})

		// ---------------------------------------------------------- tableau de bord (contacts, pavé, récents)

		etat.tableau = false
		etat.contacts = null          // null = pas encore chargés
		etat.mesContacts = null
		etat.annuaireDisponible = true
		etat.filtreRecents = 'tous'

		const tableau = document.createElement('div')
		tableau.className = 'tel3cx-tableau'
		tableau.setAttribute('role', 'region')
		tableau.setAttribute('aria-label', 'Téléphonie')
		tableau.hidden = true
		tableau.innerHTML = `
			<section class="tel3cx-col tel3cx-col-contacts">
				<h2>Contacts</h2>
				<input type="search" class="tel3cx-filtre-contacts" placeholder="Nom, société ou numéro" aria-label="Rechercher un contact">
				<ul class="tel3cx-contacts"></ul>
			</section>
			<section class="tel3cx-col tel3cx-col-centre"></section>
			<section class="tel3cx-col tel3cx-col-recents">
				<h2>Appels récents</h2>
				<div class="tel3cx-onglets" role="tablist">
					<button type="button" role="tab" data-filtre="tous" aria-selected="true">Tous</button>
					<button type="button" role="tab" data-filtre="manque" aria-selected="false">Manqués</button>
				</div>
				<ul class="tel3cx-historique"></ul>
				<p class="tel3cx-note"></p>
			</section>`
		const colonneCentre = tableau.querySelector('.tel3cx-col-centre')
		const listeContacts = tableau.querySelector('.tel3cx-contacts')
		const filtreContacts = tableau.querySelector('.tel3cx-filtre-contacts')
		const listeHistorique = tableau.querySelector('.tel3cx-historique')

		function sansAccents(t) {
			return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
		}

		function initiales(nom) {
			const mots = (nom || '?').trim().split(/\s+/)
			return ((mots[0] || '?')[0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase()
		}

		// Couleurs des 4 pôles de la charte Hoalen (corail, jaune, vert, turquoise) + encre.
		const PALETTE = [
			{ fond: '#d96b5a', texte: '#ffffff' }, { fond: '#fbd469', texte: '#111110' },
			{ fond: '#96c68d', texte: '#111110' }, { fond: '#08aba8', texte: '#ffffff' },
			{ fond: '#021216', texte: '#fbfaf8' },
		]
		function teinte(texte) {
			let h = 0
			for (const c of texte || '') h = (h * 31 + c.charCodeAt(0)) % 9973
			return PALETTE[h % PALETTE.length]
		}
		const couleur = (texte) => teinte(texte).fond

		/** Appel immédiat (depuis un contact ou un récent). */
		function appelerDirect(numero, libelle) {
			if (etat.session) { afficherMessage('Un appel est déjà en cours.', 'erreur'); return }
			remplir(numero, libelle)
			if (!boutonAppeler.disabled) appeler()
		}

		function boutonAppelPetit(numero, libelle) {
			const b = document.createElement('button')
			b.type = 'button'
			b.className = 'tel3cx-appel-rapide'
			b.title = 'Appeler ' + libelle
			b.setAttribute('aria-label', 'Appeler ' + libelle)
			b.innerHTML = icone('tel', 18)
			b.addEventListener('click', (e) => { e.stopPropagation(); appelerDirect(numero, libelle) })
			return b
		}

		function ligneVide(texte) {
			const li = document.createElement('li')
			li.className = 'tel3cx-vide'
			li.textContent = texte
			return li
		}

		function titreSection(texte, nombre) {
			const li = document.createElement('li')
			li.className = 'tel3cx-section'
			li.textContent = nombre === undefined ? texte : `${texte} (${nombre})`
			return li
		}

		function ligneCollegue(c) {
			const li = document.createElement('li')
			li.className = 'tel3cx-contact'
			li.tabIndex = 0
			const avatar = document.createElement('span')
			avatar.className = 'tel3cx-avatar'
			avatar.style.background = couleur(c.nom)
			avatar.style.color = teinte(c.nom).texte
			avatar.textContent = initiales(c.nom)
			const presence = document.createElement('span')
			presence.className = 'tel3cx-presence ' + (c.enregistre ? 'tel3cx-dispo' : 'tel3cx-absent')
			presence.title = c.enregistre ? 'Connecté' : 'Non connecté'
			avatar.append(presence)
			const texte = document.createElement('span')
			texte.className = 'tel3cx-contact-texte'
			texte.innerHTML = '<span class="tel3cx-nom"></span><span class="tel3cx-num"></span>'
			texte.querySelector('.tel3cx-nom').textContent = c.nom
			texte.querySelector('.tel3cx-num').textContent = 'Poste ' + c.poste
			const libelle = `${c.nom} (poste ${c.poste})`
			li.append(avatar, texte, boutonAppelPetit(c.poste, libelle))
			li.addEventListener('click', () => remplir(c.poste, libelle))
			li.addEventListener('keydown', (e) => { if (e.key === 'Enter') appelerDirect(c.poste, libelle) })
			return li
		}

		function ligneContact(c) {
			const li = document.createElement('li')
			li.className = 'tel3cx-contact tel3cx-contact-perso'
			li.tabIndex = 0
			const avatar = document.createElement('span')
			avatar.className = 'tel3cx-avatar tel3cx-avatar-perso'
			avatar.style.background = couleur(c.nom)
			avatar.style.color = teinte(c.nom).texte
			avatar.textContent = initiales(c.nom)
			const texte = document.createElement('span')
			texte.className = 'tel3cx-contact-texte'
			const nom = document.createElement('span')
			nom.className = 'tel3cx-nom'
			nom.textContent = c.nom
			texte.append(nom)
			if (c.societe && c.societe !== c.nom) {
				const soc = document.createElement('span')
				soc.className = 'tel3cx-num'
				soc.textContent = c.societe
				texte.append(soc)
			}
			const puces = document.createElement('span')
			puces.className = 'tel3cx-puces'
			for (const n of c.numeros) {
				const b = document.createElement('button')
				b.type = 'button'
				b.className = 'tel3cx-puce'
				const numero = numeroAComposer(n.numero)
				const libelle = `${c.nom} (${n.type.toLowerCase()})`
				b.title = `Appeler ${c.nom} — ${n.type} ${n.numero}`
				b.innerHTML = '<span class="tel3cx-puce-type"></span> <span></span>'
				b.firstChild.textContent = n.type
				b.lastChild.textContent = lisible(numero)
				b.addEventListener('click', (e) => { e.stopPropagation(); appelerDirect(numero, libelle) })
				puces.append(b)
			}
			texte.append(puces)
			li.append(avatar, texte)
			const premier = c.numeros[0]
			const libelle1 = `${c.nom} (${premier.type.toLowerCase()})`
			li.addEventListener('click', () => remplir(numeroAComposer(premier.numero), libelle1))
			li.addEventListener('keydown', (e) => { if (e.key === 'Enter') appelerDirect(numeroAComposer(premier.numero), libelle1) })
			return li
		}

		function afficherContacts() {
			listeContacts.replaceChildren()
			const mots = sansAccents(filtreContacts.value).split(/\s+/).filter(Boolean)
			const chiffres = filtreContacts.value.replace(/\D/g, '')
			const correspond = (texte, numeros) => {
				const t = sansAccents(texte)
				if (mots.every((m) => t.includes(m))) return true
				return chiffres.length >= 3 && numeros.some((n) => n.replace(/\D/g, '').includes(chiffres))
			}
			const moi = etat.identifiants && etat.identifiants.utilisateur

			// Collègues (annuaire du standard)
			if (etat.contacts === null) {
				listeContacts.append(ligneVide('Chargement…'))
				return
			}
			const collegues = etat.annuaireDisponible
				? etat.contacts.filter((c) => c.poste !== moi && correspond(c.nom + ' ' + c.poste, [c.poste])) : []
			listeContacts.append(titreSection('Collègues', etat.annuaireDisponible ? collegues.length : undefined))
			if (!etat.annuaireDisponible) {
				listeContacts.append(ligneVide('L\'annuaire du standard arrive bientôt.'))
			} else if (!collegues.length) {
				listeContacts.append(ligneVide('Aucun collègue trouvé.'))
			}
			collegues.forEach((c) => listeContacts.append(ligneCollegue(c)))

			// Contacts personnels (carnet Outlook / mailcow) et partagés
			const perso = (etat.mesContacts || []).filter((c) =>
				correspond(c.nom + ' ' + (c.societe || ''), c.numeros.map((n) => n.numero)))
			listeContacts.append(titreSection('Mes contacts', perso.length))
			if (etat.mesContacts === null) {
				listeContacts.append(ligneVide('Chargement…'))
			} else if (!perso.length) {
				listeContacts.append(ligneVide(mots.length || chiffres ? 'Aucun contact trouvé.' : 'Aucun contact avec numéro dans votre carnet.'))
			}
			const LIMITE = 150
			perso.slice(0, LIMITE).forEach((c) => listeContacts.append(ligneContact(c)))
			if (perso.length > LIMITE) {
				listeContacts.append(ligneVide(`… et ${perso.length - LIMITE} autres : affinez la recherche.`))
			}
		}

		async function chargerContacts() {
			const [annuaire, carnet] = await Promise.all([
				api('GET', 'annuaire', { texte: '' }),
				api('GET', 'contacts'),
			])
			etat.annuaireDisponible = !!(annuaire.ok && annuaire.disponible)
			etat.contacts = etat.annuaireDisponible ? (annuaire.contacts || []) : []
			etat.mesContacts = carnet.ok ? [...(carnet.contacts || []), ...(carnet.partages || [])] : []
			construireIndex()
			if (etat.tableau) afficherContacts()
		}

		// Nom de l'appelant / de l'appelé : carnet du collaborateur (Outlook/mailcow) et collègues (postes).
		// Clé = 9 derniers chiffres (06…, +33 6…, 0033 6… désignent le même numéro) ; poste = numéro complet.
		const indexNoms = new Map()
		let dateIndex = 0
		function cleNumero(numero) {
			const chiffres = String(numero || '').replace(/\D/g, '')
			return chiffres.length > 6 ? chiffres.slice(-9) : chiffres
		}
		function construireIndex() {
			indexNoms.clear()
			for (const c of etat.mesContacts || []) {
				const libelle = c.societe && c.societe !== c.nom ? `${c.nom} (${c.societe})` : c.nom
				for (const n of c.numeros || []) {
					const cle = cleNumero(n.numero)
					if (cle && !indexNoms.has(cle)) indexNoms.set(cle, libelle)
				}
			}
			for (const c of etat.contacts || []) {
				if (c.poste) indexNoms.set(cleNumero(c.poste), c.nom)  // les collègues priment
			}
		}
		function nomPourNumero(numero) {
			return indexNoms.get(cleNumero(numero)) || null
		}
		async function chargerIndexNoms(forcer) {
			if (!forcer && Date.now() - dateIndex < 30 * 60 * 1000) return
			dateIndex = Date.now()
			await chargerContacts()
		}

		function formatDureeCourte(s) {
			if (!s) return ''
			return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`
		}

		async function chargerHistorique() {
			let appels
			let note = ''
			const r = await api('GET', 'historique')
			if (r.ok && r.disponible) {
				appels = (r.appels || []).map((a) => ({
					date: a.date, numero: a.numero, sens: a.sens, statut: a.statut, duree: a.duree,
					libelle: a.nom ? `${a.nom} (${lisible(a.numero)})` : lisible(a.numero),
				}))
			} else {
				appels = lireRecentsLocaux().map((a) => ({
					date: a.date, numero: a.numero, libelle: a.libelle,
					sens: a.sens === 'manque' ? 'entrant' : a.sens, statut: a.sens === 'manque' ? 'manque' : 'repondu',
				}))
				note = 'Historique de cet appareil uniquement (l\'historique complet du standard arrive bientôt).'
			}
			tableau.querySelector('.tel3cx-note').textContent = note
			listeHistorique.replaceChildren()
			const filtres = appels.filter((a) => etat.filtreRecents === 'tous' || a.statut === 'manque')
			if (!filtres.length) {
				const li = document.createElement('li')
				li.className = 'tel3cx-vide'
				li.textContent = etat.filtreRecents === 'manque' ? 'Aucun appel manqué.' : 'Aucun appel récent.'
				listeHistorique.append(li)
			}
			for (const a of filtres.slice(0, 100)) {
				const li = document.createElement('li')
				li.className = 'tel3cx-recent' + (a.statut === 'manque' ? ' tel3cx-manque' : '')
				li.tabIndex = 0
				const sens = document.createElement('span')
				sens.className = 'tel3cx-sens'
				sens.textContent = a.statut === 'manque' ? '✕' : a.sens === 'sortant' ? '↗' : '↙'
				sens.title = a.statut === 'manque' ? 'Manqué' : a.sens === 'sortant' ? 'Émis' : 'Reçu'
				// Statuts du standard affichés en clair (« pris_ailleurs » : un collègue ou un autre appareil a décroché)
				const STATUTS = { pris_ailleurs: 'pris par un collègue', echec: 'non abouti', occupe: 'occupé' }
				if (STATUTS[a.statut]) li.classList.add('tel3cx-statut-' + a.statut)
				const texte = document.createElement('span')
				texte.className = 'tel3cx-contact-texte'
				texte.innerHTML = '<span class="tel3cx-nom"></span><span class="tel3cx-num"></span>'
				texte.querySelector('.tel3cx-nom').textContent = a.libelle
				texte.querySelector('.tel3cx-num').textContent = [formatDate(a.date), formatDureeCourte(a.duree), STATUTS[a.statut]].filter(Boolean).join(' · ')
				li.append(sens, texte, boutonAppelPetit(a.numero, a.libelle))
				li.addEventListener('click', () => remplir(a.numero, a.libelle))
				li.addEventListener('keydown', (e) => { if (e.key === 'Enter') appelerDirect(a.numero, a.libelle) })
				listeHistorique.append(li)
			}
		}

		tableau.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => {
			etat.filtreRecents = b.dataset.filtre
			tableau.querySelectorAll('[data-filtre]').forEach((x) => x.setAttribute('aria-selected', String(x === b)))
			chargerHistorique()
		}))
		filtreContacts.addEventListener('input', afficherContacts)

		// Le tableau de bord occupe la zone de contenu de Talk (à droite du volet de navigation),
		// qui reste visible ; il suit sa taille (volet replié, fenêtre redimensionnée).
		const zoneContenu = () => document.querySelector('#app-content-vue') || document.querySelector('.app-content')
			|| document.querySelector('#content-vue') || null
		const voletNavigation = () => document.querySelector('#app-navigation-vue') || document.querySelector('.app-navigation') || null
		let observateurTaille = null

		function placerTableau() {
			if (!etat.tableau) return
			const zone = zoneContenu()
			const r = zone ? zone.getBoundingClientRect() : null
			if (r && r.width > 200 && r.height > 200) {
				Object.assign(tableau.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px', right: 'auto', bottom: 'auto' })
			} else {
				Object.assign(tableau.style, { top: '', left: '', width: '', height: '', right: '', bottom: '' })
			}			const largeur = tableau.getBoundingClientRect().width
			tableau.classList.toggle('tel3cx-moyen', largeur < 1050 && largeur >= 700)
			tableau.classList.toggle('tel3cx-etroit', largeur < 700)
		}

		function suivreZone() {
			if (observateurTaille) observateurTaille.disconnect()
			observateurTaille = new ResizeObserver(placerTableau)
			const zone = zoneContenu()
			if (zone) observateurTaille.observe(zone)
			const nav = voletNavigation()
			if (nav) observateurTaille.observe(nav)
			observateurTaille.observe(document.body)
		}

		window.addEventListener('resize', placerTableau)
		// Un clic dans le volet de navigation (conversation, accueil…) quitte la téléphonie.
		document.addEventListener('click', (e) => {
			if (!etat.tableau) return
			const nav = voletNavigation()
			if (nav && nav.contains(e.target)) fermerTableau()
		}, true)

		function ouvrirTableau() {
			etat.tableau = true
			tableau.hidden = false
			changerManques(0)  // les appels manqués sont listés dans la colonne Récents
			placerTableau()
			suivreZone()
			boutonTableau.setAttribute('aria-pressed', 'true')
			colonneCentre.append(panneau)
			panneau.classList.add('tel3cx-dans-tableau')
			panneau.hidden = false
			etat.ouvert = true
			boutonEntete.setAttribute('aria-expanded', 'false')
			if (etat.mode === 'rappel') chargerEtatRappel()
			afficherContacts()
			chargerContacts()
			chargerHistorique()
			majBouton()
			if (!etat.session) filtreContacts.focus()
		}

		function fermerTableau() {
			etat.tableau = false
			tableau.hidden = true
			if (observateurTaille) { observateurTaille.disconnect(); observateurTaille = null }
			boutonTableau.setAttribute('aria-pressed', 'false')
			panneau.classList.remove('tel3cx-dans-tableau')
			document.body.append(panneau)
			// Un appel en cours reste visible dans le panneau déroulant.
			if (etat.session) ouvrir(); else fermer()
		}

		// ---------------------------------------------------------- boutons d'en-tête

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
			if (etat.tableau) { fermerTableau(); ouvrir(); return }
			etat.ouvert ? fermer() : ouvrir()
		})

		const boutonTableau = document.createElement('button')
		boutonTableau.type = 'button'
		boutonTableau.className = 'tel3cx-bouton-entete tel3cx-bouton-tableau'
		boutonTableau.title = 'Téléphonie : contacts, appels récents, pavé numérique'
		boutonTableau.setAttribute('aria-label', 'Téléphonie')
		boutonTableau.setAttribute('aria-pressed', 'false')
		boutonTableau.innerHTML = icone('clavier', 20)
		const alerteManques = document.createElement('span')
		alerteManques.className = 'tel3cx-alerte-manques'
		alerteManques.textContent = '!'
		alerteManques.hidden = true
		boutonTableau.append(alerteManques)
		boutonTableau.addEventListener('click', (e) => {
			e.stopPropagation()
			etat.tableau ? fermerTableau() : ouvrirTableau()
		})

		document.addEventListener('keydown', (e) => {
			if (e.key !== 'Escape') return
			if (etat.tableau && !etat.session) fermerTableau()
			else if (etat.ouvert && !etat.session) fermer()
		})
		document.addEventListener('mousedown', (e) => {
			// Pendant un appel ou dans le tableau de bord, le pavé reste affiché.
			if (etat.ouvert && !etat.tableau && !etat.session && !panneau.contains(e.target)
				&& !boutonEntete.contains(e.target) && !boutonTableau.contains(e.target)) fermer()
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
		conteneurBouton.append(boutonEntete, boutonTableau)
		if (conteneur) {
			conteneur.prepend(conteneurBouton)
		} else {
			conteneurBouton.classList.add('tel3cx-flottant')
			document.body.append(conteneurBouton)
		}
		document.body.append(tableau, panneau, audioDistant, audioConsult)

		// ---------------------------------------------------------- réunion Jitsi (bouton de l'accueil de Talk)
		// « Commencer une réunion maintenant » crée une réunion Jitsi (meet.hoalen-avocats.com) par l'appli
		// Nextcloud « Réunions » et y fait entrer le collaborateur comme organisateur, sans autre clic.

		const fenetreReunion = document.createElement('div')
		fenetreReunion.className = 'tel3cx-reunion'
		fenetreReunion.setAttribute('role', 'dialog')
		fenetreReunion.setAttribute('aria-label', 'Votre réunion est prête')
		fenetreReunion.hidden = true
		fenetreReunion.innerHTML = `
			<form class="tel3cx-reunion-carte tel3cx-reunion-nom">
				<button type="button" class="tel3cx-reunion-fermer" aria-label="Annuler" title="Annuler">✕</button>
				<div class="tel3cx-reunion-titre">Nouvelle réunion</div>
				<label class="tel3cx-reunion-texte" for="tel3cx-reunion-nom">Nom de la salle pour vous et vos invités</label>
				<input type="text" id="tel3cx-reunion-nom" class="tel3cx-reunion-lien" maxlength="80" value="Réunion" autocomplete="off">
				<div class="tel3cx-reunion-actions">
					<button type="submit" class="tel3cx-reunion-copier">Démarrer</button>
					<button type="button" class="tel3cx-reunion-annuler">Annuler</button>
				</div>
			</form>
			<div class="tel3cx-reunion-carte tel3cx-reunion-prete" hidden>
				<button type="button" class="tel3cx-reunion-fermer" aria-label="Fermer" title="Fermer">✕</button>
				<div class="tel3cx-reunion-titre">Votre réunion est prête</div>
				<p class="tel3cx-reunion-texte">Elle s'ouvre dans votre navigateur. Envoyez ce lien à vos invités :
					ils patienteront en salle d'attente jusqu'à ce que vous les fassiez entrer.</p>
				<input type="text" class="tel3cx-reunion-lien" readonly aria-label="Lien d'invitation">
				<div class="tel3cx-reunion-actions">
					<button type="button" class="tel3cx-reunion-copier">Copier le lien</button>
					<button type="button" class="tel3cx-reunion-courriel">Envoyer par e-mail</button>
					<button type="button" class="tel3cx-reunion-rejoindre">Rouvrir la réunion</button>
				</div>
				<div class="tel3cx-reunion-message" aria-live="polite"></div>
			</div>`
		const formulaireNom = fenetreReunion.querySelector('.tel3cx-reunion-nom')
		const carteprete = fenetreReunion.querySelector('.tel3cx-reunion-prete')
		const champNom = fenetreReunion.querySelector('#tel3cx-reunion-nom')
		const lienInvites = carteprete.querySelector('.tel3cx-reunion-lien')
		let nomReunion = 'Réunion'
		const messageReunion = fenetreReunion.querySelector('.tel3cx-reunion-message')
		let lienOrganisateur = ''
		let reunionEnCours = false

		const fermerReunion = () => { fenetreReunion.hidden = true }
		fenetreReunion.querySelectorAll('.tel3cx-reunion-fermer, .tel3cx-reunion-annuler').forEach((b) => b.addEventListener('click', fermerReunion))
		fenetreReunion.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerReunion() })
		formulaireNom.addEventListener('submit', (e) => {
			e.preventDefault()
			nomReunion = champNom.value.trim() || 'Réunion'
			demarrerReunion()
		})
		fenetreReunion.addEventListener('mousedown', (e) => { if (e.target === fenetreReunion) fermerReunion() })
		carteprete.querySelector('.tel3cx-reunion-copier').addEventListener('click', async () => {
			try {
				await navigator.clipboard.writeText(lienInvites.value)
			} catch (e) {
				lienInvites.select()
				document.execCommand('copy')
			}
			messageReunion.textContent = 'Lien copié : collez-le dans votre message ou votre invitation.'
		})
		fenetreReunion.querySelector('.tel3cx-reunion-courriel').addEventListener('click', () => {
			const sujet = nomReunion === 'Réunion' ? 'Invitation à une réunion vidéo' : `Invitation : ${nomReunion}`
			const corps = `Bonjour,\n\nJe vous invite à rejoindre ma réunion vidéo « ${nomReunion} » :\n${lienInvites.value}\n\nAucun compte n'est nécessaire ; vous patienterez quelques instants en salle d'attente.\n\nBien cordialement`
			window.open(`mailto:?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`)
		})
		fenetreReunion.querySelector('.tel3cx-reunion-rejoindre').addEventListener('click', () => {
			if (lienOrganisateur) window.open(lienOrganisateur, '_blank', 'noopener')
		})

		async function demarrerReunion() {
			if (reunionEnCours) return
			reunionEnCours = true
			// Navigateur : on ouvre l'onglet tout de suite (sinon le bloqueur de fenêtres l'empêche après l'attente).
			// Talk Desktop : les liens extérieurs partent d'eux-mêmes dans le navigateur par défaut.
			const onglet = window.TALK_DESKTOP ? null : window.open('about:blank', '_blank')
			try {
				const r = await reunion()
				if (!r.ok || !r.lien_organisateur) {
					if (onglet) onglet.close()
					window.alert(r.message || 'La réunion n\'a pas pu être créée. Réessayez dans un instant.')
					return
				}
				// Titre affiché par Jitsi à la place du nom technique (aléatoire) de la salle.
				lienOrganisateur = r.lien_organisateur.split('#')[0] + '#config.subject=' + encodeURIComponent(JSON.stringify(nomReunion))
				if (onglet) {
					onglet.opener = null
					onglet.location.href = lienOrganisateur
				} else {
					window.open(lienOrganisateur, '_blank')
				}
				lienInvites.value = r.lien_invites || ''
				messageReunion.textContent = ''
				formulaireNom.hidden = true
				carteprete.hidden = false
				fenetreReunion.hidden = false
				lienInvites.focus()
				lienInvites.select()
			} finally {
				reunionEnCours = false
			}
		}

		if (typeof reunion === 'function') {
			document.body.append(fenetreReunion)
			// Interception au tout début du clic, avant que Talk ne lance sa propre visio.
			document.addEventListener('click', (e) => {
				const bouton = e.target.closest && e.target.closest('button')
				if (!bouton) return
				const texte = (bouton.textContent || '').replace(/\s+/g, ' ').trim()
				if (texte !== 'Commencer une réunion maintenant' && texte !== 'Start meeting now') return
				e.preventDefault()
				e.stopImmediatePropagation()
				champNom.value = 'Réunion'
				carteprete.hidden = true
				formulaireNom.hidden = false
				fenetreReunion.hidden = false
				champNom.focus()
				champNom.select()
			}, true)
		}

		// ---------------------------------------------------------- démarrage

		// Liens « tel: » (Talk Desktop) : le numéro est prérempli, l'utilisateur confirme (pas d'appel accidentel).
		function ouvrirAvecNumero(numero) {
			const chiffres = numeroAComposer(numero)
			const connu = nomPourNumero(chiffres)
			ouvrir()
			if (!etat.session) remplir(chiffres, connu ? `${connu} (${lisible(chiffres)})` : '')
			boutonAppeler.focus()
		}
		if (window.TALK_DESKTOP && typeof window.TALK_DESKTOP.onItechTel === 'function') {
			window.TALK_DESKTOP.onItechTel((numero) => ouvrirAvecNumero(numero))
			window.TALK_DESKTOP.itechTelEnAttente().then((numero) => { if (numero) setTimeout(() => ouvrirAvecNumero(numero), 1500) })
		}

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
