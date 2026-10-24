/**
 * DOLMYR — órdenes del servidor al launcher (plugin NetworkLauncher, /launcher reiniciar en el proxy).
 *
 * Sirve para meter algo nuevo (un mod, un evento) con gente jugando, sin que nadie tenga que hacer nada:
 *   1. el servidor avisa dentro del juego con una cuenta atrás ("el juego se reinicia en 10 s"),
 *   2. a la hora marcada este launcher cierra el juego,
 *   3. baja la lista nueva de mods (esperando a que sea la misma que pide el servidor),
 *   4. vuelve a abrir el juego, que entra solo al servidor.
 *
 * Mientras el juego está abierto pregunta cada 5 segundos (es una petición muy pequeña); con el juego cerrado no
 * hace nada (al pulsar JUGAR ya se baja todo lo nuevo). Cada orden se cumple una sola vez por equipo.
 *
 * Todo va dentro de una función: los scripts de Helios comparten el ámbito global y así no chocamos.
 */
(() => {
    'use strict'

    const Servicio = require('./assets/js/dolmyrservicio')

    const CLAVE_HECHAS = 'dolmyr.ordenesHechas'
    const CON_JUEGO_MS = 5000
    const SIN_JUEGO_MS = 30000
    /** Una orden que llega con la hora ya pasada se cumple igual si no hace más de esto */
    const TARDE_MS = 60000
    /** Intentos para bajar la lista nueva (el servidor de GitHub puede tardar un poco en darla) */
    const INTENTOS_LISTA = 12
    const ESPERA_LISTA_MS = 5000

    let programada = null

    function hechas() {
        try {
            return new Set(JSON.parse(localStorage.getItem(CLAVE_HECHAS) || '[]'))
        } catch (e) {
            return new Set()
        }
    }

    function marcarHecha(id) {
        const lista = Array.from(hechas())
        lista.push(String(id))
        try {
            localStorage.setItem(CLAVE_HECHAS, JSON.stringify(lista.slice(-50)))
        } catch (e) {
            // Sin almacenamiento: podría repetirse si se reinicia el launcher
        }
    }

    function esperar(ms) {
        return new Promise(r => setTimeout(r, ms))
    }

    function dolmDice(clave) {
        const guia = document.getElementById('dolmGuia')
        if (window.dolmGuia != null && guia != null && !guia.classList.contains('dolmOculto')) {
            window.dolmGuia.decirFrase(clave, 'alegria', 4)
        }
    }

    /** Pone el launcher a la vista (estaba detrás del juego) */
    function traerAlFrente() {
        try {
            const ventana = require('@electron/remote').getCurrentWindow()
            if (ventana.isMinimized()) {
                ventana.restore()
            }
            ventana.show()
            ventana.focus()
        } catch (e) {
            // No pasa nada si no se puede
        }
    }

    /** Baja la lista de distribución sin caché hasta que tenga la revisión que pide el servidor */
    async function bajarLista(revision) {
        const original = DistroAPI.remoteUrl
        try {
            for (let i = 0; i < INTENTOS_LISTA; i++) {
                DistroAPI.remoteUrl = `${original}?v=${Date.now()}`
                try {
                    const distro = await DistroAPI.refreshDistributionOrFallback()
                    if (revision == null || Servicio.revisionDe(distro) === revision) {
                        onDistroRefresh(distro)
                        return true
                    }
                } catch (e) {
                    console.warn('[Dolmyr] No se pudo bajar la lista de distribución', e)
                }
                await esperar(ESPERA_LISTA_MS)
            }
            return false
        } finally {
            DistroAPI.remoteUrl = original
        }
    }

    async function reiniciar(orden) {
        console.info(`[Dolmyr] Orden del servidor: reiniciar el juego (${orden.motivo || 'sin motivo'})`)
        traerAlFrente()
        dolmDice('reinicioAviso')
        await cerrarJuego()
        // Un respiro para que el servidor dé por desconectado al jugador
        await esperar(2000)
        if (!await bajarLista(orden.revision)) {
            console.warn('[Dolmyr] La lista nueva no llegó a tiempo: se abre el juego con la que haya')
        }
        dolmDice('reinicioAbriendo')
        await esperar(1500)
        const boton = document.getElementById('launch_button')
        if (boton != null && !boton.disabled) {
            boton.click()
        }
    }

    function atender(orden) {
        if (orden == null || orden.tipo !== 'reiniciar' || hechas().has(String(orden.id))) {
            // Si se canceló la que estaba programada, se quita
            if (programada != null && (orden == null || String(orden.id) !== programada.id)) {
                clearTimeout(programada.temporizador)
                programada = null
            }
            return
        }
        if (programada != null && programada.id === String(orden.id)) {
            return
        }
        const falta = orden.hora - Date.now()
        if (falta < -TARDE_MS || !juegoAbierto()) {
            return
        }
        if (programada != null) {
            clearTimeout(programada.temporizador)
        }
        programada = {
            id: String(orden.id),
            temporizador: setTimeout(() => {
                programada = null
                marcarHecha(orden.id)
                reiniciar(orden).catch(e => console.warn('[Dolmyr] Error al reiniciar el juego', e))
            }, Math.max(0, falta))
        }
    }

    async function revisar() {
        let distro
        try {
            distro = await DistroAPI.getDistribution()
        } catch (e) {
            return
        }
        const n = await Servicio.novedades(distro)
        if (n != null) {
            atender(n.orden || null)
        }
    }

    function programar() {
        setTimeout(async () => {
            if (juegoAbierto()) {
                try {
                    await revisar()
                } catch (e) {
                    console.warn('[Dolmyr] Error al mirar las órdenes del servidor', e)
                }
            }
            programar()
        }, juegoAbierto() ? CON_JUEGO_MS : SIN_JUEGO_MS)
    }

    programar()

    // Pruebas (DOLMYR_PRUEBA_JUGAR=1): pulsa JUGAR solo al abrirse, para probar las órdenes sin tocar nada
    if (process.env.DOLMYR_PRUEBA_JUGAR === '1') {
        setTimeout(() => {
            const boton = document.getElementById('launch_button')
            console.info(`[Dolmyr] Prueba: pulsando JUGAR (activo: ${boton != null && !boton.disabled})`)
            if (boton != null && !boton.disabled) {
                boton.click()
            }
        }, 15000)
    }

    // Para el modo capturas y las pruebas
    window.dolmyrOrdenes = { revisar, atender }
})()
