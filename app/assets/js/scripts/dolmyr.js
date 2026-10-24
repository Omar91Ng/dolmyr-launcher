/**
 * DOLMYR — efectos y personalización del launcher.
 *
 * - Escena de fondo: paisaje con fundido entre fondos, movimiento lento, niebla y partículas.
 * - Pestaña "Apariencia" de los ajustes: se guarda en localStorage (por jugador y por equipo).
 * - Sonidos suaves de la interfaz, sintetizados (sin archivos de audio).
 * - Modo capturas (DOLMYR_CAPTURAS=<carpeta>): recorre las pantallas, guarda capturas PNG y cierra.
 *
 * Todo va dentro de una función: los scripts de Helios comparten el ámbito global y así no chocamos.
 */
(() => {
    'use strict'

    const fs = require('fs')
    const path = require('path')
    const remoteMod = require('@electron/remote')

    // Cualquier error no capturado queda registrado en la consola (Ctrl + Mayús + I) con su origen
    window.addEventListener('error', (e) => {
        console.error('[Dolmyr] Error no capturado:', e.message, e.filename + ':' + e.lineno, e.error && e.error.stack)
    })
    window.addEventListener('unhandledrejection', (e) => {
        const r = e.reason
        console.error('[Dolmyr] Promesa rechazada sin capturar:', r && r.stack ? r.stack : r)
    })

    const CLAVE = 'dolmyr.apariencia'
    const PREDETERMINADO = {
        fondo: 'aleatorio',      // 'aleatorio' o el número del fondo
        fondoRotativo: true,
        movimientoFondo: true,
        particulas: true,
        niebla: true,
        reducirMovimiento: false,
        sonido: true,
        dolm: true,              // Dolm, el guía (dolm.js)
        charlaDolm: true,
        vozDolm: true,
        calidad: 'auto'          // 'auto' (según el equipo y lo que mide), 'alta', 'media' o 'baja'
    }
    const NOMBRES_FONDOS = ['El Yermo', 'Puerto de Niebla', 'Asentamiento', 'La Forja', 'Amanecer']
    const INTERVALO_FONDO_MS = 32000

    // -------------------------------------------------------------------------- preferencias

    function leer() {
        try {
            const guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}')
            return Object.assign({}, PREDETERMINADO, guardado)
        } catch (e) {
            return Object.assign({}, PREDETERMINADO)
        }
    }

    function guardar(prefs) {
        try {
            localStorage.setItem(CLAVE, JSON.stringify(prefs))
        } catch (e) {
            // Sin almacenamiento: las preferencias duran solo esta sesión
        }
    }

    let prefs = leer()

    // -------------------------------------------------------------------------- fondos

    const carpetaFondos = path.join(__dirname, 'assets', 'images', 'backgrounds')
    let fondos = []
    try {
        fondos = fs.readdirSync(carpetaFondos)
            .filter(f => /^\d+\.jpg$/i.test(f))
            .map(f => parseInt(f, 10))
            .sort((a, b) => a - b)
    } catch (e) {
        fondos = []
    }

    const capaA = document.getElementById('dolmyrFondoA')
    const capaB = document.getElementById('dolmyrFondoB')
    let capaVisible = capaA
    let fondoActual = -1
    let temporizadorFondo = null

    function urlFondo(n) {
        return `assets/images/backgrounds/${n}.jpg`
    }

    function mostrarFondo(n, inmediato = false) {
        if (n === fondoActual || !fondos.includes(n)) {
            return
        }
        const destino = capaVisible === capaA && fondoActual !== -1 ? capaB : capaA
        const img = new Image()
        img.onload = () => {
            destino.style.backgroundImage = `url('${urlFondo(n)}')`
            if (inmediato) {
                destino.style.transition = 'none'
            }
            destino.setAttribute('visible', '')
            if (destino !== capaVisible) {
                capaVisible.removeAttribute('visible')
            }
            capaVisible = destino
            if (inmediato) {
                requestAnimationFrame(() => { destino.style.transition = '' })
            }
        }
        img.src = urlFondo(n)
        fondoActual = n
    }

    function fondoInicial() {
        if (prefs.fondo !== 'aleatorio' && fondos.includes(Number(prefs.fondo))) {
            return Number(prefs.fondo)
        }
        const bkid = parseInt(document.body.getAttribute('bkid'), 10)
        return fondos.includes(bkid) ? bkid : fondos[0]
    }

    function programarRotacion() {
        clearInterval(temporizadorFondo)
        temporizadorFondo = null
        if (prefs.fondoRotativo && fondos.length > 1 && !prefs.reducirMovimiento) {
            temporizadorFondo = setInterval(() => {
                if (document.hidden || pausado) {
                    return
                }
                const i = fondos.indexOf(fondoActual)
                mostrarFondo(fondos[(i + 1) % fondos.length])
            }, INTERVALO_FONDO_MS)
        }
    }

    // -------------------------------------------------------------------------- rendimiento

    // Sin aceleración gráfica (drivers raros o DOLMYR_SIN_GPU=1): sin desenfoques, brasas ni movimiento de fondo
    // Se pregunta a WebGL qué dibuja de verdad: al arrancar, el estado de la GPU de Electron aún no es fiable.
    // SwiftShader o el "Microsoft Basic Render Driver" = se dibuja con el procesador.
    let sinGpu = false
    let tarjeta = ''
    try {
        const gl = document.createElement('canvas').getContext('webgl')
        const info = gl && gl.getExtension('WEBGL_debug_renderer_info')
        tarjeta = gl ? String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : ''
        sinGpu = gl == null || /swiftshader|basic render|llvmpipe|software/i.test(tarjeta)
    } catch (e) {
        sinGpu = false
    }
    document.body.classList.toggle('dolmyrSinGpu', sinGpu)

    // ---- Nivel de calidad: alta · media · baja ----------------------------------------------------
    // En automático se estima con el equipo (gráfica, núcleos, memoria) y luego se MIDE: si la ventana va a
    // menos de 40 fotogramas por segundo se baja un nivel, y se recuerda para la próxima vez en este equipo.
    const NIVELES = ['baja', 'media', 'alta']
    const CLAVE_MEDIDO = 'dolmyr.nivelMedido'
    const memoriaGB = require('os').totalmem() / 1073741824
    const nucleos = navigator.hardwareConcurrency || 4

    function nivelDelEquipo() {
        if (sinGpu || nucleos <= 2 || memoriaGB < 4) {
            return 'baja'
        }
        // Gráficas integradas antiguas de Intel (HD/UHD) o equipos justos: nivel medio
        const integradaVieja = /intel.*(hd|uhd) graphics/i.test(tarjeta)
        if (integradaVieja || nucleos <= 4 || memoriaGB < 7.5) {
            return 'media'
        }
        return 'alta'
    }

    function leerMedido() {
        try {
            const m = JSON.parse(localStorage.getItem(CLAVE_MEDIDO) || 'null')
            return m && m.tarjeta === tarjeta && NIVELES.includes(m.nivel) ? m.nivel : null
        } catch (e) {
            return null
        }
    }

    function guardarMedido(valor) {
        try {
            localStorage.setItem(CLAVE_MEDIDO, JSON.stringify({ tarjeta, nivel: valor }))
        } catch (e) {
            // sin almacenamiento: se volverá a medir
        }
    }

    /** "ANGLE (NVIDIA, NVIDIA GeForce RTX 4050 Laptop GPU (0x28E1) Direct3D11 ...)" -> "NVIDIA GeForce RTX 4050 Laptop GPU" */
    function nombreTarjeta() {
        const m = /^ANGLE \([^,]*, (.+?)\s*(\(0x|Direct3D|OpenGL|Vulkan|,|\)$)/.exec(tarjeta)
        return (m ? m[1] : tarjeta) || '?'
    }

    function nivelAutomatico() {
        const equipo = nivelDelEquipo()
        const medido = leerMedido()
        return medido && NIVELES.indexOf(medido) < NIVELES.indexOf(equipo) ? medido : equipo
    }

    let nivel = 'alta'
    function calcularNivel() {
        // DOLMYR_CALIDAD=alta|media|baja fuerza un nivel (para probar), sin guardarlo
        const forzada = NIVELES.includes(process.env.DOLMYR_CALIDAD) ? process.env.DOLMYR_CALIDAD : null
        nivel = sinGpu ? 'baja' : (forzada || (NIVELES.includes(prefs.calidad) ? prefs.calidad : nivelAutomatico()))
        document.body.classList.toggle('dolmyrNivelMedio', nivel === 'media')
        document.body.classList.toggle('dolmyrNivelBajo', nivel === 'baja')
    }

    // Con la ventana sin foco (por ejemplo, mientras se juega) se para todo: no gasta ni procesador ni gráfica
    let pausado = false

    // -------------------------------------------------------------------------- partículas

    const lienzo = document.getElementById('dolmyrParticulas')
    const ctx = lienzo ? lienzo.getContext('2d') : null
    const COLORES = ['246,215,122', '233,182,59', '217,162,59', '222,74,64', '242,235,221']
    let particulas = []
    let animacion = null
    let ultimoFotograma = 0

    // El halo de cada color se dibuja una sola vez en un lienzo pequeño y se reutiliza
    // (antes: shadowBlur en cada partícula y en cada fotograma, lo más caro que hay en un canvas)
    const sprites = {}
    function sprite(color, brillo) {
        const clave = color + (brillo ? '+' : '')
        if (sprites[clave] == null) {
            const t = brillo ? 32 : 12
            const c = document.createElement('canvas')
            c.width = t
            c.height = t
            const g = c.getContext('2d')
            const degradado = g.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2)
            degradado.addColorStop(0, `rgba(${color},1)`)
            degradado.addColorStop(brillo ? 0.16 : 0.45, `rgba(${color},0.9)`)
            if (brillo) {
                degradado.addColorStop(0.42, `rgba(${color},0.22)`)
            }
            degradado.addColorStop(1, `rgba(${color},0)`)
            g.fillStyle = degradado
            g.fillRect(0, 0, t, t)
            sprites[clave] = c
        }
        return sprites[clave]
    }

    function ajustarLienzo() {
        if (!lienzo) {
            return
        }
        // Como mucho 1,5 píxeles por píxel de pantalla: las brasas son puntos borrosos, no hace falta más
        const escala = Math.min(window.devicePixelRatio || 1, nivel === 'alta' ? 1.5 : 1)
        lienzo.width = Math.floor(window.innerWidth * escala)
        lienzo.height = Math.floor(window.innerHeight * escala)
        ctx.setTransform(escala, 0, 0, escala, 0, 0)
    }

    function nuevaParticula(inicial) {
        const ancho = window.innerWidth
        const alto = window.innerHeight
        const brasa = Math.random() < 0.55
        return {
            x: Math.random() * ancho,
            y: inicial ? Math.random() * alto : alto + 10,
            r: brasa ? 0.8 + Math.random() * 1.8 : 0.6 + Math.random() * 1.2,
            vy: -(brasa ? 0.25 + Math.random() * 0.55 : 0.08 + Math.random() * 0.2),
            vx: (Math.random() - 0.5) * 0.15,
            fase: Math.random() * Math.PI * 2,
            amplitud: 0.2 + Math.random() * 0.5,
            vida: 0,
            duracion: 600 + Math.random() * 900,
            color: brasa ? COLORES[Math.floor(Math.random() * 4)] : COLORES[4],
            brillo: brasa
        }
    }

    function pintarParticulas(t) {
        animacion = requestAnimationFrame(pintarParticulas)
        // Máximo ~30 fotogramas por segundo: suficiente y gasta poco
        if (t - ultimoFotograma < 33) {
            return
        }
        ultimoFotograma = t
        if (document.hidden) {
            return
        }
        const ancho = window.innerWidth
        const alto = window.innerHeight
        ctx.clearRect(0, 0, ancho, alto)
        for (let i = 0; i < particulas.length; i++) {
            const p = particulas[i]
            p.vida++
            p.fase += 0.02
            p.x += p.vx + Math.sin(p.fase) * p.amplitud * 0.3
            p.y += p.vy
            const progreso = p.vida / p.duracion
            let alfa = progreso < 0.15 ? progreso / 0.15 : progreso > 0.75 ? (1 - progreso) / 0.25 : 1
            alfa = Math.max(0, Math.min(1, alfa)) * (p.brillo ? 0.85 : 0.35)
            if (p.vida >= p.duracion || p.y < -20) {
                particulas[i] = nuevaParticula(false)
                continue
            }
            const tam = p.brillo ? p.r * 9 : p.r * 3
            ctx.globalAlpha = alfa
            ctx.drawImage(sprite(p.color, p.brillo), p.x - tam / 2, p.y - tam / 2, tam, tam)
        }
        ctx.globalAlpha = 1
    }

    function activarParticulas(activo) {
        if (!ctx) {
            return
        }
        if (activo && animacion == null) {
            ajustarLienzo()
            if (particulas.length === 0) {
                const tope = nivel === 'alta' ? 70 : 30
                const cantidad = Math.round(Math.min(tope, (window.innerWidth * window.innerHeight) / (nivel === 'alta' ? 18000 : 40000)))
                particulas = Array.from({ length: cantidad }, () => nuevaParticula(true))
            }
            animacion = requestAnimationFrame(pintarParticulas)
        } else if (!activo && animacion != null) {
            cancelAnimationFrame(animacion)
            animacion = null
            if (!pausado) {
                particulas = []
                ctx.clearRect(0, 0, lienzo.width, lienzo.height)
            }
        }
    }

    function particulasActivas() {
        return prefs.particulas && !prefs.reducirMovimiento && nivel !== 'baja' && !pausado
    }

    window.addEventListener('resize', () => {
        if (animacion != null) {
            ajustarLienzo()
        }
    })

    function pausar(si) {
        if (si === pausado || process.env.DOLMYR_CAPTURAS) {
            return
        }
        pausado = si
        document.body.classList.toggle('dolmyrPausado', si)
        activarParticulas(particulasActivas())
        window.dispatchEvent(new CustomEvent('dolmyr:pausa', { detail: si }))
    }
    window.addEventListener('blur', () => pausar(true))
    window.addEventListener('focus', () => pausar(false))

    // -------------------------------------------------------------------------- sonidos

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

    /** Golpe suave, como piedra contra madera. */
    function sonidoClic() {
        const a = contextoAudio()
        if (!prefs.sonido || a == null) {
            return
        }
        const ahora = a.currentTime
        const osc = a.createOscillator()
        const ganancia = a.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(320, ahora)
        osc.frequency.exponentialRampToValueAtTime(140, ahora + 0.08)
        ganancia.gain.setValueAtTime(0.0001, ahora)
        ganancia.gain.exponentialRampToValueAtTime(0.08, ahora + 0.005)
        ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.12)
        osc.connect(ganancia).connect(a.destination)
        osc.start(ahora)
        osc.stop(ahora + 0.13)
    }

    /** Tambor grave con un brillo metálico: al pulsar JUGAR. */
    function sonidoJugar() {
        const a = contextoAudio()
        if (!prefs.sonido || a == null) {
            return
        }
        const ahora = a.currentTime
        const tambor = a.createOscillator()
        const gTambor = a.createGain()
        tambor.type = 'sine'
        tambor.frequency.setValueAtTime(110, ahora)
        tambor.frequency.exponentialRampToValueAtTime(48, ahora + 0.5)
        gTambor.gain.setValueAtTime(0.0001, ahora)
        gTambor.gain.exponentialRampToValueAtTime(0.32, ahora + 0.01)
        gTambor.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.7)
        tambor.connect(gTambor).connect(a.destination)
        tambor.start(ahora)
        tambor.stop(ahora + 0.72)

        ;[660, 990, 1320].forEach((f, i) => {
            const o = a.createOscillator()
            const g = a.createGain()
            o.type = 'sine'
            o.frequency.setValueAtTime(f, ahora)
            g.gain.setValueAtTime(0.0001, ahora + 0.02)
            g.gain.exponentialRampToValueAtTime(0.03 / (i + 1), ahora + 0.04)
            g.gain.exponentialRampToValueAtTime(0.0001, ahora + 1.3)
            o.connect(g).connect(a.destination)
            o.start(ahora + 0.02)
            o.stop(ahora + 1.32)
        })
    }

    document.addEventListener('click', (e) => {
        const boton = e.target.closest('button')
        if (boton == null || boton.disabled) {
            return
        }
        if (boton.id === 'launch_button') {
            sonidoJugar()
        } else {
            sonidoClic()
        }
    }, true)

    // -------------------------------------------------------------------------- aplicar preferencias

    function aplicar() {
        const nivelAntes = nivel
        calcularNivel()
        if (nivelAntes !== nivel && animacion != null) {
            // Otro nivel = otra cantidad de brasas: se rehacen
            activarParticulas(false)
        }
        const cuerpo = document.body
        cuerpo.classList.toggle('dolmyrSinMovimiento', prefs.reducirMovimiento)
        cuerpo.classList.toggle('dolmyrSinMovimientoFondo', !prefs.movimientoFondo || prefs.reducirMovimiento)
        cuerpo.classList.toggle('dolmyrSinNiebla', !prefs.niebla || prefs.reducirMovimiento)
        cuerpo.classList.toggle('dolmyrSinParticulas', !prefs.particulas || prefs.reducirMovimiento)
        activarParticulas(particulasActivas())
        programarRotacion()
        sincronizarAjustes()
        // dolm.js lee las mismas preferencias: se le avisa de cada cambio
        window.dispatchEvent(new CustomEvent('dolmyr:preferencias'))
    }

    // -------------------------------------------------------------------------- pestaña Apariencia

    function construirSelectorFondos() {
        const contenedor = document.getElementById('dolmyrSelectorFondos')
        if (contenedor == null) {
            return
        }
        contenedor.innerHTML = ''
        const aleatorio = document.createElement('div')
        aleatorio.className = 'dolmyrFondoMiniatura dolmyrFondoAleatorio'
        aleatorio.setAttribute('fondo', 'aleatorio')
        aleatorio.innerHTML = '&#10022;<span>Al azar</span>'
        contenedor.appendChild(aleatorio)
        fondos.forEach((n) => {
            const m = document.createElement('div')
            m.className = 'dolmyrFondoMiniatura'
            m.setAttribute('fondo', String(n))
            m.style.backgroundImage = `url('${urlFondo(n)}')`
            const etiqueta = document.createElement('span')
            etiqueta.textContent = NOMBRES_FONDOS[n] || `Fondo ${n + 1}`
            m.appendChild(etiqueta)
            contenedor.appendChild(m)
        })
        contenedor.addEventListener('click', (e) => {
            const m = e.target.closest('.dolmyrFondoMiniatura')
            if (m == null) {
                return
            }
            sonidoClic()
            const valor = m.getAttribute('fondo')
            prefs.fondo = valor === 'aleatorio' ? 'aleatorio' : Number(valor)
            if (prefs.fondo !== 'aleatorio') {
                mostrarFondo(prefs.fondo)
            }
            guardar(prefs)
            sincronizarAjustes()
        })
    }

    function sincronizarAjustes() {
        document.querySelectorAll('input[dolmyrOpcion]').forEach((input) => {
            input.checked = Boolean(prefs[input.getAttribute('dolmyrOpcion')])
        })
        document.querySelectorAll('.dolmyrFondoMiniatura').forEach((m) => {
            if (String(prefs.fondo) === m.getAttribute('fondo')) {
                m.setAttribute('elegido', '')
            } else {
                m.removeAttribute('elegido')
            }
        })
        // Calidad: botón elegido y qué nivel está usando de verdad
        document.querySelectorAll('[dolmyrCalidad]').forEach((b) => {
            b.toggleAttribute('elegido', b.getAttribute('dolmyrCalidad') === prefs.calidad)
        })
        const estado = document.getElementById('dolmyrCalidadEstado')
        if (estado) {
            const nombreNivel = { alta: 'calidadNivelAlta', media: 'calidadNivelMedia', baja: 'calidadNivelBaja' }[nivel]
            estado.textContent = Lang.queryEJS('dolmyr.calidadEstado', {
                nivel: Lang.queryEJS(`dolmyr.${nombreNivel}`),
                equipo: `${nombreTarjeta()} · ${nucleos} núcleos · ${Math.round(memoriaGB)} GB`
            })
        }
    }

    document.querySelectorAll('[dolmyrCalidad]').forEach((b) => {
        b.addEventListener('click', () => {
            prefs.calidad = b.getAttribute('dolmyrCalidad')
            guardar(prefs)
            aplicar()
        })
    })

    document.querySelectorAll('input[dolmyrOpcion]').forEach((input) => {
        input.addEventListener('change', () => {
            prefs[input.getAttribute('dolmyrOpcion')] = input.checked
            guardar(prefs)
            aplicar()
        })
    })

    const botonRestablecer = document.getElementById('dolmyrRestablecer')
    if (botonRestablecer != null) {
        botonRestablecer.addEventListener('click', () => {
            prefs = Object.assign({}, PREDETERMINADO)
            guardar(prefs)
            aplicar()
        })
    }

    // -------------------------------------------------------------------------- enlaces sin configurar

    /** Los enlaces de redes que siguen en "#" (sin cuenta todavía) se ocultan. */
    function ocultarEnlacesVacios() {
        document.querySelectorAll('#externalMedia .mediaURL').forEach((a) => {
            const href = (a.getAttribute('href') || '').trim()
            if (href === '' || href === '#') {
                const contenedor = a.closest('.mediaContainer')
                if (contenedor) {
                    contenedor.style.display = 'none'
                }
            }
        })
    }

    // -------------------------------------------------------------------------- modo capturas

    function esperar(ms) {
        return new Promise(r => setTimeout(r, ms))
    }

    async function capturar(carpeta, nombre) {
        const imagen = await remoteMod.getCurrentWebContents().capturePage()
        fs.writeFileSync(path.join(carpeta, `${nombre}.png`), imagen.toPNG())
    }

    async function irA(vista) {
        await new Promise((resolver) => {
            switchView(getCurrentView(), vista, 250, 250, () => {}, () => resolver())
        })
        await esperar(1600)
    }

    async function modoCapturas(carpeta) {
        fs.mkdirSync(carpeta, { recursive: true })
        // Esperar a que termine la pantalla de carga
        for (let i = 0; i < 60 && document.getElementById('loadingContainer').style.display !== 'none'; i++) {
            await esperar(500)
        }
        await esperar(2500)
        await capturar(carpeta, '00-inicio')
        await irA(VIEWS.welcome)
        await esperar(3200)
        await capturar(carpeta, '01-bienvenida')
        await irA(VIEWS.loginOptions)
        await esperar(3200)
        await capturar(carpeta, '02-inicio-sesion')
        await irA(VIEWS.waiting)
        await capturar(carpeta, '03-esperando-microsoft')
        await irA(VIEWS.landing)
        await esperar(3500)
        await capturar(carpeta, '04-principal')
        // Dolm hablando y con un gesto
        if (window.dolmGuia) {
            window.dolmGuia.decir('charla', 'grunon')
            await esperar(1800)
            await capturar(carpeta, '09-dolm-gesto')
            await esperar(2600)
            await capturar(carpeta, '10-dolm-frase')
        }
        // Avisos enviados desde el servidor (/launcher dolm|aviso), si el servicio está en marcha
        if (window.dolmyrNovedades) {
            try {
                localStorage.removeItem('dolmyr.avisosVistos')
            } catch (e) {
                // sin almacenamiento
            }
            await esperar(9000)
            await window.dolmyrNovedades.revisar()
            await esperar(3200)
            await capturar(carpeta, '11-aviso-dolm')
            await esperar(9000)
            await window.dolmyrNovedades.revisar()
            await esperar(1500)
            await capturar(carpeta, '12-aviso-ventana')
            toggleOverlay(false)
            await esperar(800)
        }
        await prepareSettings()
        await irA(VIEWS.settings)
        const pestanas = Array.from(document.getElementsByClassName('settingsNavItem')).filter(b => b.hasAttribute('rSc'))
        for (let i = 0; i < pestanas.length; i++) {
            settingsNavItemListener(pestanas[i], false)
            await esperar(900)
            await capturar(carpeta, `05-ajustes-${String(i + 1).padStart(2, '0')}-${pestanas[i].getAttribute('rSc').replace('settingsTab', '').toLowerCase()}`)
            const pestana = document.getElementById(pestanas[i].getAttribute('rSc'))
            if (pestana && pestana.scrollHeight > pestana.clientHeight + 40) {
                pestana.scrollTop = pestana.scrollHeight
                await esperar(400)
                await capturar(carpeta, `05-ajustes-${String(i + 1).padStart(2, '0')}b-final`)
                pestana.scrollTop = 0
            }
        }
        await irA(VIEWS.landing)
        // Barra de descarga (simulada: no se descarga nada)
        toggleLaunchArea(true)
        setLaunchDetails('Descargando archivos...')
        setLaunchPercentage(63)
        await esperar(1200)
        await capturar(carpeta, '07-descargando')
        toggleLaunchArea(false)
        // Panel de crónicas
        document.getElementById('newsButton').click()
        await esperar(2600)
        await capturar(carpeta, '08-cronicas')
        // Se cierra con su botón de volver, pulsándolo donde se ve (si algo lo tapa, el clic no le llega)
        const volver = document.getElementById('newsVolver').getBoundingClientRect()
        document.elementFromPoint(volver.left + volver.width / 2, volver.top + volver.height / 2).click()
        await esperar(2600)
        await capturar(carpeta, '08b-cronicas-cerradas')
        // El botón mientras el juego está abierto
        marcarJugando(true)
        await esperar(800)
        await capturar(carpeta, '13-jugando')
        marcarJugando(false)
        setOverlayContent('Ejemplo de aviso', 'Así se ven los avisos del launcher. <a href="https://dolmyr.com">Un enlace</a> dentro del texto.', 'Entendido', 'Cerrar')
        toggleOverlay(true, true)
        await esperar(1200)
        await capturar(carpeta, '06-aviso')
        toggleOverlay(false)
        remoteMod.app.quit()
    }

    // -------------------------------------------------------------------------- inicio

    construirSelectorFondos()
    if (fondos.length > 0) {
        mostrarFondo(fondoInicial(), true)
    }
    aplicar()
    ocultarEnlacesVacios()

    // ---- Medir la fluidez real y bajar de nivel si hace falta (solo en automático) ----------------
    function medirFps(ms) {
        return new Promise((resolver) => {
            let fotogramas = 0
            let inicio = null
            function paso(t) {
                if (inicio == null) {
                    inicio = t
                }
                fotogramas++
                if (t - inicio < ms) {
                    requestAnimationFrame(paso)
                } else {
                    resolver((fotogramas - 1) * 1000 / (t - inicio))
                }
            }
            requestAnimationFrame(paso)
        })
    }

    async function vigilarFluidez() {
        let medidas = 0
        await esperar(7000)
        while (medidas < 2) {
            if (prefs.calidad !== 'auto' || nivel === 'baja') {
                return
            }
            // Solo se mide con la ventana a la vista y en primer plano
            if (document.hidden || pausado) {
                await esperar(3000)
                continue
            }
            const fps = await medirFps(3000)
            if (document.hidden || pausado) {
                continue
            }
            medidas++
            console.log(`[Dolmyr] Fluidez: ${Math.round(fps)} fps en calidad ${nivel}`)
            if (fps >= 40) {
                return
            }
            const menor = NIVELES[NIVELES.indexOf(nivel) - 1]
            guardarMedido(menor)
            console.log(`[Dolmyr] Va lento: calidad ${nivel} -> ${menor}`)
            aplicar()
            await esperar(4000)
        }
    }

    // Para la pestaña Apariencia
    window.dolmyrCalidad = {
        nivel: () => nivel,
        // Lo que aguanta el equipo (sin contar el ajuste manual del launcher): lo usa dolmyrjuego.js
        nivelEquipo: () => (sinGpu ? 'baja' : nivelAutomatico()),
        equipo: () => `${tarjeta || 'gráfica desconocida'} · ${nucleos} núcleos · ${Math.round(memoriaGB)} GB`
    }
    console.log(`[Dolmyr] Equipo: ${window.dolmyrCalidad.equipo()} · calidad ${nivel}${process.env.DOLMYR_CALIDAD ? ' (forzada)' : prefs.calidad === 'auto' ? ' (automática)' : ''}`)
    if (!process.env.DOLMYR_CAPTURAS) {
        vigilarFluidez().catch(() => {})
    }

    if (process.env.DOLMYR_CAPTURAS) {
        modoCapturas(process.env.DOLMYR_CAPTURAS).catch((err) => {
            console.error('[Dolmyr] Error en el modo capturas', err)
            remoteMod.app.quit()
        })
    }
})()
