/**
 * DOLMYR — lo que el servidor le envía al launcher (plugin NetworkLauncher, /launcher en el proxy).
 *
 * Cada poco tiempo pregunta al servicio del servidor y:
 *   - avisos "dolm":  los dice Dolm en su bocadillo (si Dolm está oculto, salen como ventana),
 *   - avisos "aviso": salen como ventana de aviso,
 *   - mods nuevos publicados: vuelve a cargar la lista de distribución y Dolm lo anuncia
 *     (al pulsar JUGAR se descargan solos, como siempre),
 *   - mantenimiento: Dolm avisa cuando empieza y cuando acaba.
 * Cada aviso se muestra una sola vez (se recuerda en localStorage).
 *
 * Todo va dentro de una función: los scripts de Helios comparten el ámbito global y así no chocamos.
 */
(() => {
    'use strict'

    const Servicio = require('./assets/js/dolmyrservicio')

    const CLAVE_VISTOS = 'dolmyr.avisosVistos'
    const PRIMERA_MS = 8000
    const INTERVALO_MS = 90000
    const SIGUIENTE_MS = 15000

    let mantenimientoAnterior = null
    let revisionAnunciada = null

    function leerVistos() {
        try {
            return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTOS) || '[]'))
        } catch (e) {
            return new Set()
        }
    }

    function marcarVisto(clave) {
        const vistos = Array.from(leerVistos())
        vistos.push(clave)
        try {
            localStorage.setItem(CLAVE_VISTOS, JSON.stringify(vistos.slice(-200)))
        } catch (e) {
            // Sin almacenamiento: el aviso podría repetirse en otra sesión
        }
    }

    function escapar(texto) {
        const div = document.createElement('div')
        div.textContent = texto
        return div.innerHTML
    }

    function cargando() {
        const detalles = document.getElementById('launch_details')
        return detalles != null && detalles.style.display === 'flex'
    }

    function enPrincipal() {
        try {
            return getCurrentView() === VIEWS.landing
        } catch (e) {
            return false
        }
    }

    function dolmVisible() {
        const guia = document.getElementById('dolmGuia')
        return window.dolmGuia != null && guia != null && !guia.classList.contains('dolmOculto')
    }

    /** Ventana de aviso de Helios (el texto se escapa: nunca se interpreta como HTML). */
    function mostrarVentana(texto) {
        if (!enPrincipal() || cargando() || isOverlayVisible()) {
            return false
        }
        setOverlayContent(Lang.queryJS('dolm.avisoTitulo'), escapar(texto), Lang.queryJS('dolm.avisoBoton'))
        setOverlayHandler(null)
        toggleOverlay(true, false)
        return true
    }

    function mostrarAviso(aviso) {
        if (aviso.tipo === 'dolm' && dolmVisible()) {
            return window.dolmGuia.decirTexto(aviso.texto, 'saludo', 3)
        }
        return mostrarVentana(aviso.texto)
    }

    async function revisar() {
        if (document.hidden) {
            return
        }
        let distro
        try {
            distro = await DistroAPI.getDistribution()
        } catch (e) {
            return
        }
        const n = await Servicio.novedades(distro)
        if (n == null) {
            return
        }

        // Mods nuevos publicados mientras el launcher estaba abierto
        const local = Servicio.revisionDe(distro)
        if (n.revision && local && n.revision !== local && n.revision !== revisionAnunciada && !cargando()) {
            revisionAnunciada = n.revision
            try {
                const nueva = await DistroAPI.refreshDistributionOrFallback()
                onDistroRefresh(nueva)
            } catch (e) {
                console.warn('[Dolmyr] No se pudo recargar la lista de distribución', e)
            }
            if (dolmVisible()) {
                window.dolmGuia.decirFrase('modsNuevos', 'alegria', 3)
            }
            return
        }

        // Mantenimiento
        if (typeof n.mantenimiento === 'boolean') {
            if (n.mantenimiento !== mantenimientoAnterior && (mantenimientoAnterior !== null || n.mantenimiento) && dolmVisible()) {
                window.dolmGuia.decirFrase(n.mantenimiento ? 'mantenimiento' : 'finMantenimiento', n.mantenimiento ? 'grunon' : 'alegria', 3)
            }
            mantenimientoAnterior = n.mantenimiento
        }

        // Avisos nuevos: uno cada vez, para que dé tiempo a leerlos
        const vistos = leerVistos()
        const avisos = Array.isArray(n.avisos) ? n.avisos : []
        const pendientes = avisos.filter(a => a && typeof a.texto === 'string' && !vistos.has(`${a.id}-${a.creado}`))
        if (pendientes.length > 0 && mostrarAviso(pendientes[0])) {
            marcarVisto(`${pendientes[0].id}-${pendientes[0].creado}`)
        }
        return pendientes.length > 1
    }

    function programar(ms) {
        setTimeout(async () => {
            let quedan = false
            try {
                quedan = await revisar()
            } catch (e) {
                console.warn('[Dolmyr] Error al revisar las novedades del servidor', e)
            }
            // Si quedan avisos por mostrar, se vuelve a mirar pronto
            programar(quedan ? SIGUIENTE_MS : INTERVALO_MS)
        }, ms)
    }

    programar(PRIMERA_MS)

    // Para el modo capturas de dolmyr.js
    window.dolmyrNovedades = { revisar }
})()
