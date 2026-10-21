/**
 * DOLMYR — conexión del launcher con el servidor (plugin NetworkLauncher del proxy).
 *
 * - pedirPase(): al pulsar JUGAR. El servidor solo deja entrar a quien tiene pase:
 *     1. pide un reto al servidor,
 *     2. lo firma ante Mojang con la cuenta del jugador (lo mismo que hace el juego al entrar a un servidor),
 *     3. el servidor pregunta a Mojang si esa cuenta lo ha firmado y le da el pase con la revisión de los mods.
 *   El token de Minecraft solo viaja del launcher a Mojang: al servidor de Dolmyr no le llega nunca.
 * - novedades(): avisos para el launcher, revisión de los mods publicada y mantenimiento.
 *
 * La dirección del servicio y la revisión de los mods vienen en la lista de distribución (bloque "dolmyr").
 * Se usa Node (http/https) y no fetch: así no hay problemas de CORS con Mojang ni con el servicio.
 */
'use strict'

const http = require('http')
const https = require('https')

const MOJANG_JOIN = 'https://sessionserver.mojang.com/session/minecraft/join'
const TIEMPO_MS = 10000

/** Petición JSON. Devuelve { estado, datos } (datos = objeto o null). */
function peticion(url, { metodo = 'GET', cuerpo = null } = {}) {
    return new Promise((resolver, rechazar) => {
        const destino = new URL(url)
        const modulo = destino.protocol === 'https:' ? https : http
        const datos = cuerpo == null ? null : Buffer.from(JSON.stringify(cuerpo), 'utf8')
        const req = modulo.request(destino, {
            method: metodo,
            timeout: TIEMPO_MS,
            headers: Object.assign(
                { 'Accept': 'application/json', 'User-Agent': 'DolmyrLauncher' },
                datos ? { 'Content-Type': 'application/json', 'Content-Length': datos.length } : {}
            )
        }, (res) => {
            const trozos = []
            let total = 0
            res.on('data', (t) => {
                total += t.length
                if (total <= 256 * 1024) {
                    trozos.push(t)
                }
            })
            res.on('end', () => {
                const texto = Buffer.concat(trozos).toString('utf8')
                let json = null
                try {
                    json = texto ? JSON.parse(texto) : null
                } catch (_e) {
                    json = null
                }
                resolver({ estado: res.statusCode, datos: json })
            })
        })
        req.on('timeout', () => req.destroy(new Error('Tiempo de espera agotado')))
        req.on('error', rechazar)
        if (datos) {
            req.write(datos)
        }
        req.end()
    })
}

/** Bloque "dolmyr" de la lista de distribución ({ servicio, revision }), o null. */
function datosDolmyr(distro) {
    const d = distro && distro.rawDistribution && distro.rawDistribution.dolmyr
    return d && typeof d.servicio === 'string' && d.servicio ? d : null
}

function base(servicio) {
    return servicio.replace(/\/+$/, '')
}

/**
 * Pide el pase para entrar al servidor con la cuenta elegida.
 * @returns {Promise<{ok: boolean, hasta?: number, motivo?: string}>}
 */
exports.pedirPase = async function (distro, cuenta, versionLauncher) {
    const d = datosDolmyr(distro)
    if (d == null) {
        return { ok: false, motivo: 'sin-servicio' }
    }
    if (cuenta == null || cuenta.type !== 'microsoft' || !cuenta.accessToken) {
        return { ok: false, motivo: 'sin-cuenta' }
    }
    const nombre = cuenta.displayName
    const url = base(d.servicio)

    const reto = await peticion(`${url}/pase/reto`, { metodo: 'POST', cuerpo: { nombre } })
    if (reto.estado !== 200 || !reto.datos || !reto.datos.reto) {
        return { ok: false, motivo: (reto.datos && reto.datos.motivo) || `reto-${reto.estado}` }
    }

    const firma = await peticion(MOJANG_JOIN, {
        metodo: 'POST',
        cuerpo: {
            accessToken: cuenta.accessToken,
            selectedProfile: String(cuenta.uuid).replace(/-/g, ''),
            serverId: reto.datos.reto
        }
    })
    if (firma.estado !== 204 && firma.estado !== 200) {
        return { ok: false, motivo: `mojang-${firma.estado}` }
    }

    const confirmacion = await peticion(`${url}/pase/confirmar`, {
        metodo: 'POST',
        cuerpo: {
            nombre,
            reto: reto.datos.reto,
            launcher: versionLauncher,
            revision: d.revision || ''
        }
    })
    if (confirmacion.estado !== 200 || !confirmacion.datos || confirmacion.datos.ok !== true) {
        return { ok: false, motivo: (confirmacion.datos && confirmacion.datos.motivo) || `confirmar-${confirmacion.estado}` }
    }
    return { ok: true, hasta: confirmacion.datos.hasta }
}

/**
 * Novedades del servidor para el launcher: { modo, revision, mantenimiento, avisos: [{id, tipo, texto, creado}] }.
 * Devuelve null si no hay servicio o no responde.
 */
exports.novedades = async function (distro) {
    const d = datosDolmyr(distro)
    if (d == null) {
        return null
    }
    try {
        const res = await peticion(`${base(d.servicio)}/launcher/novedades`)
        return res.estado === 200 && res.datos ? res.datos : null
    } catch (_e) {
        return null
    }
}

/** Revisión de los mods de la lista de distribución cargada (o null). */
exports.revisionDe = function (distro) {
    const d = distro && distro.rawDistribution && distro.rawDistribution.dolmyr
    return d && d.revision ? d.revision : null
}
