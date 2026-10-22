/**
 * DOLMYR — Dolm, el guía del launcher.
 *
 * - Figura animada: vídeos con transparencia (reposo, hablar, saludo, alegría, gruñón) que se encadenan
 *   con un fundido corto. Si los vídeos no cargan o se pide "reducir el movimiento", se ve la imagen fija.
 * - Bocadillo con el texto letra a letra y una "voz de piedra" sintetizada (sin archivos de audio).
 * - Reacciona a lo que pasa: saluda con tu nombre, comenta el estado del servidor, acompaña la descarga,
 *   celebra cuando entras al juego y refunfuña si algo falla. De vez en cuando suelta alguna frase del Yermo.
 * - Las frases están en es_ES.toml, sección [js.dolm]. Las preferencias, en la pestaña Apariencia.
 *
 * Todo va dentro de una función: los scripts de Helios comparten el ámbito global y así no chocamos.
 */
(() => {
    'use strict'

    const CLAVE_PREFS = 'dolmyr.apariencia'
    const CARPETA_VIDEOS = 'assets/videos/dolm'
    const CLIPS = ['reposo', 'hablar', 'saludo', 'alegria', 'grunon']
    const BUCLES = ['reposo', 'hablar']
    const FUNDIDO_MS = 180
    const MS_POR_LETRA = 34
    const CHARLA_MIN_MS = 55000
    const CHARLA_MAX_MS = 110000

    // -------------------------------------------------------------------------- preferencias

    function leerPrefs() {
        const base = { dolm: true, vozDolm: true, charlaDolm: true, reducirMovimiento: false }
        try {
            return Object.assign(base, JSON.parse(localStorage.getItem(CLAVE_PREFS) || '{}'))
        } catch (e) {
            return base
        }
    }

    let prefs = leerPrefs()

    // -------------------------------------------------------------------------- frases

    function frases(clave) {
        try {
            const valor = Lang.queryJS(`dolm.${clave}`)
            return Array.isArray(valor) ? valor : (valor ? [valor] : [])
        } catch (e) {
            return []
        }
    }

    const ultimas = {}

    /** Una frase al azar de la lista, sin repetir la última que salió de esa misma lista. */
    function frase(clave, datos = {}) {
        const lista = frases(clave)
        if (lista.length === 0) {
            return null
        }
        let i = Math.floor(Math.random() * lista.length)
        if (lista.length > 1 && i === ultimas[clave]) {
            i = (i + 1) % lista.length
        }
        ultimas[clave] = i
        return lista[i].replace(/\{(\w+)\}/g, (m, k) => (datos[k] != null ? String(datos[k]) : m))
    }

    // -------------------------------------------------------------------------- voz de piedra

    let audio = null

    function contextoAudio() {
        if (audio == null) {
            try {
                audio = new (window.AudioContext || window.webkitAudioContext)()
            } catch (e) {
                audio = false
            }
        }
        return audio || null
    }

    /** Un murmullo grave y rasposo, como dos piedras que se rozan. Uno por sílaba, más o menos. */
    function murmullo(pregunta) {
        const a = contextoAudio()
        if (!prefs.vozDolm || a == null || a.state === 'suspended') {
            return
        }
        const ahora = a.currentTime
        const base = (pregunta ? 120 : 82) + Math.random() * 34
        const osc = a.createOscillator()
        const filtro = a.createBiquadFilter()
        const ganancia = a.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(base, ahora)
        osc.frequency.exponentialRampToValueAtTime(base * (pregunta ? 1.25 : 0.82), ahora + 0.09)
        filtro.type = 'lowpass'
        filtro.frequency.setValueAtTime(520 + Math.random() * 260, ahora)
        filtro.Q.value = 6
        ganancia.gain.setValueAtTime(0.0001, ahora)
        ganancia.gain.exponentialRampToValueAtTime(0.07, ahora + 0.012)
        ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.11)
        osc.connect(filtro).connect(ganancia).connect(a.destination)
        osc.start(ahora)
        osc.stop(ahora + 0.12)

        // Un poco de grava encima
        const largo = Math.floor(a.sampleRate * 0.05)
        const buffer = a.createBuffer(1, largo, a.sampleRate)
        const datos = buffer.getChannelData(0)
        for (let i = 0; i < largo; i++) {
            datos[i] = (Math.random() * 2 - 1) * (1 - i / largo)
        }
        const ruido = a.createBufferSource()
        const banda = a.createBiquadFilter()
        const gRuido = a.createGain()
        ruido.buffer = buffer
        banda.type = 'bandpass'
        banda.frequency.value = 900 + Math.random() * 500
        banda.Q.value = 1.4
        gRuido.gain.value = 0.025
        ruido.connect(banda).connect(gRuido).connect(a.destination)
        ruido.start(ahora)
    }

    // El navegador no deja sonar audio hasta que la persona toca algo: se reanuda con el primer clic
    document.addEventListener('pointerdown', () => {
        const a = contextoAudio()
        if (a && a.state === 'suspended') {
            a.resume().catch(() => {})
        }
    }, true)

    // -------------------------------------------------------------------------- figura animada

    /**
     * Crea la figura animada dentro de `contenedor`. Si dentro hay una imagen, se usa como respaldo.
     */
    function crearFigura(contenedor) {
        const respaldo = contenedor.querySelector('img')
        const capa = document.createElement('div')
        capa.className = 'dolmFiguraVideos'
        contenedor.appendChild(capa)

        const videos = {}
        let fallos = 0
        CLIPS.forEach((nombre) => {
            const v = document.createElement('video')
            v.className = 'dolmClip'
            v.src = `${CARPETA_VIDEOS}/${nombre}.webm`
            v.muted = true
            v.playsInline = true
            // Solo se precargan los que se usan todo el rato; los gestos se cargan al pedirlos (son archivos locales)
            v.preload = BUCLES.includes(nombre) ? 'auto' : 'metadata'
            v.loop = BUCLES.includes(nombre)
            v.setAttribute('aria-hidden', 'true')
            v.addEventListener('error', () => {
                fallos++
                contenedor.classList.add('dolmSinVideo')
            })
            v.addEventListener('ended', () => {
                if (actual === nombre) {
                    volverABase()
                }
            })
            capa.appendChild(v)
            videos[nombre] = v
        })

        let actual = null
        let hablando = false
        let activa = false

        function base() {
            return hablando ? 'hablar' : 'reposo'
        }

        function usarVideo() {
            // En calidad baja (dolmyr.js pone la clase en body) Dolm se ve como imagen fija
            const calidadBaja = document.body.classList.contains('dolmyrNivelBajo')
            return activa && fallos === 0 && !prefs.reducirMovimiento && !calidadBaja
        }

        function mostrar(nombre) {
            if (!usarVideo()) {
                actual = nombre
                return
            }
            const nombreViejo = actual
            const nuevo = videos[nombre]
            const viejo = nombreViejo != null ? videos[nombreViejo] : null
            actual = nombre
            if (nuevo === viejo) {
                return
            }
            nuevo.currentTime = 0
            const reproducir = nuevo.play()
            const encender = () => {
                nuevo.classList.add('dolmClipVisible')
                if (viejo) {
                    viejo.classList.remove('dolmClipVisible')
                    setTimeout(() => {
                        if (actual !== nombreViejo) {
                            viejo.pause()
                        }
                    }, FUNDIDO_MS + 40)
                }
            }
            if (reproducir && reproducir.then) {
                reproducir.then(encender).catch(encender)
            } else {
                encender()
            }
        }

        function volverABase() {
            mostrar(base())
        }

        function aplicarModo() {
            contenedor.classList.toggle('dolmFija', !usarVideo())
            if (!usarVideo()) {
                Object.values(videos).forEach(v => v.pause())
            } else if (actual != null) {
                const v = videos[actual]
                v.classList.add('dolmClipVisible')
                v.play().catch(() => {})
            }
        }

        return {
            /** Reproduce un gesto una vez (saludo, alegria, grunon) y vuelve a reposo o a hablar. */
            gesto(nombre) {
                if (videos[nombre]) {
                    mostrar(nombre)
                }
            },
            hablar(si) {
                hablando = si
                if (actual === 'reposo' || actual === 'hablar' || actual == null) {
                    mostrar(base())
                }
            },
            activar(si) {
                if (si === activa) {
                    return
                }
                activa = si
                if (si) {
                    const nombre = actual || 'reposo'
                    actual = null
                    aplicarModo()
                    mostrar(nombre)
                } else {
                    Object.values(videos).forEach(v => v.pause())
                }
            },
            refrescar() {
                aplicarModo()
                if (usarVideo() && actual == null) {
                    mostrar('reposo')
                }
            },
            /** Para poder pausar al minimizar sin perder el clip actual. */
            pausar(si) {
                if (!usarVideo() || actual == null) {
                    return
                }
                if (si) {
                    videos[actual].pause()
                } else {
                    videos[actual].play().catch(() => {})
                }
            },
            respaldo
        }
    }

    // -------------------------------------------------------------------------- guía (figura + bocadillo)

    function crearGuia(contenedor, opciones = {}) {
        const figuraCaja = contenedor.querySelector('.dolmFigura')
        const figura = crearFigura(figuraCaja)

        const bocadillo = document.createElement('div')
        bocadillo.className = 'dolmBocadillo'
        bocadillo.setAttribute('role', 'status')
        bocadillo.setAttribute('aria-live', 'polite')
        const nombre = document.createElement('span')
        nombre.className = 'dolmBocadilloNombre'
        nombre.textContent = frase('nombre') || 'Dolm'
        const texto = document.createElement('span')
        texto.className = 'dolmBocadilloTexto'
        bocadillo.appendChild(nombre)
        bocadillo.appendChild(texto)
        contenedor.appendChild(bocadillo)

        let escribiendo = null
        let ocultar = null
        let prioridadActual = 0
        let ocupadoHasta = 0
        let pendiente = null

        function callar() {
            clearInterval(escribiendo)
            clearTimeout(ocultar)
            escribiendo = null
            figura.hablar(false)
        }

        function terminar() {
            prioridadActual = 0
            bocadillo.classList.remove('dolmBocadilloVisible')
            if (pendiente) {
                const p = pendiente
                pendiente = null
                setTimeout(() => decir(p.texto, p.gesto, p.prioridad), 700)
            }
        }

        /**
         * Dolm dice algo. Una frase con más prioridad interrumpe; con menos, espera su turno (solo una en cola).
         * @param {string} mensaje
         * @param {string|null} gesto saludo, alegria o grunon
         * @param {number} prioridad 1 charla · 2 aviso · 3 importante · 4 error
         */
        function decir(mensaje, gesto = null, prioridad = 1) {
            if (!mensaje) {
                return
            }
            const ocupado = Date.now() < ocupadoHasta
            if (ocupado && prioridad <= prioridadActual) {
                if (prioridad >= 2) {
                    pendiente = { texto: mensaje, gesto, prioridad }
                }
                return
            }
            callar()
            prioridadActual = prioridad
            if (gesto) {
                figura.gesto(gesto)
            }
            bocadillo.classList.remove('dolmBocadilloVisible')
            void bocadillo.offsetWidth
            bocadillo.classList.add('dolmBocadilloVisible')

            const lectura = Math.max(3800, mensaje.length * 62)
            const instantaneo = prefs.reducirMovimiento
            if (instantaneo) {
                texto.textContent = mensaje
                ocupadoHasta = Date.now() + lectura
                ocultar = setTimeout(terminar, lectura)
                return
            }

            // El resto del texto ya ocupa su sitio (invisible): el bocadillo no cambia de tamaño mientras escribe
            const letras = Array.from(mensaje)
            const escrito = document.createElement('span')
            const cursor = document.createElement('span')
            cursor.className = 'dolmCursor'
            const resto = document.createElement('span')
            resto.className = 'dolmResto'
            resto.textContent = mensaje
            texto.textContent = ''
            texto.append(escrito, cursor, resto)
            const pregunta = /\?\s*$/.test(mensaje)
            let i = 0
            let silaba = 0
            ocupadoHasta = Date.now() + letras.length * MS_POR_LETRA + lectura
            figura.hablar(!gesto)
            escribiendo = setInterval(() => {
                if (i >= letras.length) {
                    clearInterval(escribiendo)
                    escribiendo = null
                    cursor.remove()
                    resto.remove()
                    figura.hablar(false)
                    ocultar = setTimeout(terminar, lectura)
                    return
                }
                const c = letras[i++]
                escrito.textContent += c
                resto.textContent = letras.slice(i).join('')
                if (/[a-záéíóúüñ]/i.test(c) && (silaba++ % 2 === 0)) {
                    murmullo(pregunta && i > letras.length - 6)
                }
                // Si había un gesto, al acabar pasa a hablar mientras siga escribiendo
                if (gesto && i === Math.floor(letras.length * 0.6)) {
                    figura.hablar(true)
                }
            }, MS_POR_LETRA)
        }

        if (opciones.alPulsar) {
            figuraCaja.addEventListener('click', opciones.alPulsar)
            figuraCaja.classList.add('dolmPulsable')
        }

        return {
            decir,
            figura,
            activar(si) {
                figura.activar(si)
                if (!si) {
                    callar()
                    pendiente = null
                    prioridadActual = 0
                    ocupadoHasta = 0
                    bocadillo.classList.remove('dolmBocadilloVisible')
                }
            },
            ocupado() {
                return Date.now() < ocupadoHasta
            },
            /** Prioridad de lo que está diciendo ahora (0 si está callado). */
            prioridad() {
                return Date.now() < ocupadoHasta ? prioridadActual : 0
            }
        }
    }

    // -------------------------------------------------------------------------- las tres pantallas

    const guias = {}
    const cajaPrincipal = document.getElementById('dolmGuia')
    if (cajaPrincipal) {
        guias.landing = crearGuia(cajaPrincipal, {
            alPulsar: () => {
                const g = guias.landing
                const gestos = ['saludo', 'grunon', 'alegria']
                g.decir(frase('clic'), gestos[Math.floor(Math.random() * gestos.length)], 2)
            }
        })
    }
    const cajaBienvenida = document.querySelector('.dolmyrBienvenidaArte')
    if (cajaBienvenida) {
        guias.welcome = crearGuia(cajaBienvenida, {
            alPulsar: () => guias.welcome.decir(frase('clic'), 'saludo', 2)
        })
    }
    const cajaLogin = document.querySelector('.dolmyrLoginArte')
    if (cajaLogin) {
        guias.loginOptions = crearGuia(cajaLogin, {
            alPulsar: () => guias.loginOptions.decir(frase('clic'), 'grunon', 2)
        })
    }

    function vistaActual() {
        try {
            const v = getCurrentView()
            return Object.keys(VIEWS).find(k => VIEWS[k] === v) || null
        } catch (e) {
            return null
        }
    }

    function guiaVisible() {
        const v = vistaActual()
        if (v === 'landing' && !prefs.dolm) {
            return null
        }
        return guias[v] || null
    }

    // -------------------------------------------------------------------------- reacciones

    let saludoHecho = false
    let cargando = false
    let mitadDicha = false
    let ultimoEstado = null
    let ultimoNombre = null

    function nombreJugador() {
        const el = document.getElementById('user_text')
        const texto = el ? el.textContent.trim() : ''
        const sinCuenta = Lang.queryJS('landing.selectedAccount.noAccountSelected')
        return texto && texto !== sinCuenta && texto !== Lang.queryEJS('landing.usernamePlaceholder') ? texto : null
    }

    function saludarEnLanding(primeraVez) {
        const g = guias.landing
        if (!g || !prefs.dolm) {
            return
        }
        const nombre = nombreJugador()
        ultimoNombre = nombre
        if (primeraVez) {
            g.decir(nombre ? frase('saludoConCuenta', { nombre }) : frase('saludoSinCuenta'), 'saludo', 3)
        } else if (Math.random() < 0.45) {
            g.decir(frase('vuelta', { nombre: nombre || '' }), null, 1)
        }
    }

    function alEntrarEnVista(vista) {
        Object.keys(guias).forEach((k) => guias[k].activar(k === vista && (k !== 'landing' || prefs.dolm)))
        const g = guiaVisible()
        if (!g) {
            return
        }
        setTimeout(() => {
            if (vistaActual() !== vista) {
                return
            }
            if (vista === 'landing') {
                saludarEnLanding(!saludoHecho)
                saludoHecho = true
            } else if (vista === 'welcome') {
                g.decir(frase('bienvenida'), 'saludo', 3)
            } else if (vista === 'loginOptions') {
                g.decir(frase('inicioSesion'), null, 3)
            }
        }, 1100)
    }

    // Helios cambia de pantalla con switchView y, al arrancar, poniendo la vista directamente:
    // vigilar la vista actual cubre los dos casos.
    let vistaVigilada = null
    setInterval(() => {
        const v = vistaActual()
        const visible = v && document.querySelector(VIEWS[v]) && $(VIEWS[v]).is(':visible')
        if (visible && v !== vistaVigilada) {
            vistaVigilada = v
            alEntrarEnVista(v)
        }
    }, 400)

    function enLanding() {
        return vistaActual() === 'landing' && guias.landing && prefs.dolm
    }

    // Estado del servidor
    const contador = document.getElementById('player_count')
    if (contador) {
        new MutationObserver(() => {
            const t = contador.textContent.trim()
            const m = t.match(/^(\d+)\s*\/\s*(\d+)$/)
            const estado = m ? (Number(m[1]) > 0 ? 'vivo' : 'vacio') : (t === Lang.queryJS('landing.serverStatus.offline') ? 'caido' : null)
            if (estado == null || estado === ultimoEstado) {
                return
            }
            ultimoEstado = estado
            if (!enLanding() || cargando) {
                return
            }
            // Prioridad 2: si llega mientras saluda, espera en la cola y lo dice después
            const prioridad = 2
            if (estado === 'caido') {
                guias.landing.decir(frase('servidorCaido'), 'grunon', prioridad)
            } else if (estado === 'vacio') {
                guias.landing.decir(frase('servidorVacio'), null, prioridad)
            } else {
                guias.landing.decir(frase('servidorVivo', { jugadores: m[1] }), null, prioridad)
            }
        }).observe(contador, { childList: true, characterData: true, subtree: true })
    }

    // Cambio de cuenta
    const textoUsuario = document.getElementById('user_text')
    if (textoUsuario) {
        new MutationObserver(() => {
            const nombre = nombreJugador()
            if (!saludoHecho || nombre === ultimoNombre) {
                return
            }
            ultimoNombre = nombre
            if (nombre && enLanding()) {
                guias.landing.decir(frase('cambioCuenta', { nombre }), 'saludo', 2)
            }
        }).observe(textoUsuario, { childList: true, characterData: true, subtree: true })
    }

    /** Envuelve una función global de Helios para enterarse de cuándo se llama, sin cambiar lo que hace. */
    function escuchar(nombre, despues) {
        const original = window[nombre]
        if (typeof original !== 'function') {
            return
        }
        window[nombre] = function (...args) {
            const resultado = original.apply(this, args)
            try {
                despues(...args)
            } catch (e) {
                console.error(`[Dolm] Error al reaccionar a ${nombre}`, e)
            }
            return resultado
        }
    }

    escuchar('toggleLaunchArea', (abierta) => {
        if (abierta && !cargando) {
            cargando = true
            mitadDicha = false
            if (enLanding()) {
                guias.landing.decir(frase('descargaInicio'), null, 2)
            }
        } else if (!abierta) {
            cargando = false
        }
    })

    escuchar('setLaunchPercentage', (porcentaje) => {
        if (cargando && !mitadDicha && porcentaje >= 50 && porcentaje < 95 && enLanding()) {
            mitadDicha = true
            guias.landing.decir(frase('descargaMitad'), null, 1)
        }
    })

    escuchar('setLaunchDetails', (detalle) => {
        if (!enLanding()) {
            return
        }
        if (detalle === Lang.queryJS('landing.dlAsync.launchingGame')) {
            guias.landing.decir(frase('lanzando'), 'alegria', 3)
        } else if (detalle === Lang.queryJS('landing.dlAsync.doneEnjoyServer')) {
            guias.landing.decir(frase('listo'), 'alegria', 3)
        }
    })

    escuchar('showLaunchFailure', () => {
        cargando = false
        if (enLanding()) {
            guias.landing.decir(frase('error'), 'grunon', 4)
        }
    })

    // landing.js avisa si el servidor no ha dado el pase del launcher
    window.addEventListener('dolmyr:sinPase', () => {
        if (enLanding()) {
            guias.landing.decir(frase('sinPase'), 'grunon', 4)
        }
    })

    // Charla de vez en cuando
    function programarCharla() {
        setTimeout(() => {
            if (prefs.charlaDolm && enLanding() && !cargando && !document.hidden && !guias.landing.ocupado()
                && !document.getElementById('main').hasAttribute('overlay')) {
                const gestos = [null, null, null, 'grunon', 'saludo']
                guias.landing.decir(frase('charla'), gestos[Math.floor(Math.random() * gestos.length)], 1)
            }
            programarCharla()
        }, CHARLA_MIN_MS + Math.random() * (CHARLA_MAX_MS - CHARLA_MIN_MS))
    }
    programarCharla()

    // -------------------------------------------------------------------------- preferencias y ventana

    function aplicarPrefs() {
        prefs = leerPrefs()
        if (cajaPrincipal) {
            cajaPrincipal.classList.toggle('dolmOculto', !prefs.dolm)
        }
        Object.values(guias).forEach(g => g.figura.refrescar())
        const v = vistaActual()
        if (guias.landing) {
            guias.landing.activar(v === 'landing' && prefs.dolm)
        }
    }

    window.addEventListener('dolmyr:preferencias', aplicarPrefs)
    let ventanaEnPausa = false
    document.addEventListener('visibilitychange', () => {
        const g = guiaVisible()
        if (g) {
            g.figura.pausar(document.hidden || ventanaEnPausa)
        }
    })
    // dolmyr.js avisa cuando la ventana pierde o recupera el foco (por ejemplo, mientras se juega)
    window.addEventListener('dolmyr:pausa', (e) => {
        ventanaEnPausa = Boolean(e.detail)
        const g = guiaVisible()
        if (g) {
            g.figura.pausar(ventanaEnPausa || document.hidden)
        }
    })

    aplicarPrefs()

    window.dolmGuia = {
        // Para el modo capturas de dolmyr.js
        decir: (clave, gesto) => {
            const g = guiaVisible()
            if (g) {
                g.decir(frase(clave, { nombre: nombreJugador() || '', jugadores: 3 }), gesto || null, 4)
            }
        },
        /** Para novedades.js. Devuelven false si Dolm no está a la vista en la pantalla principal. */
        decirFrase: (clave, gesto, prioridad) => {
            if (!enLanding() || cargando) {
                return false
            }
            guias.landing.decir(frase(clave, { nombre: nombreJugador() || '' }), gesto || null, prioridad || 2)
            return true
        },
        decirTexto: (texto, gesto, prioridad = 3) => {
            // Corta la charla normal, pero no algo igual o más importante (un error, el saludo...)
            if (!enLanding() || cargando || guias.landing.prioridad() >= prioridad) {
                return false
            }
            guias.landing.decir(texto, gesto || null, prioridad)
            return true
        }
    }
})()
