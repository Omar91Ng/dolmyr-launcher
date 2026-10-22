/**
 * DOLMYR — opciones iniciales de Minecraft según el equipo.
 *
 * La PRIMERA vez que se juega con Dolmyr en un equipo se escribe options.txt con valores que van bien en ese
 * equipo (nivel de calidad que detecta el launcher: alta, media o baja) y con el juego en español.
 * Si el jugador ya tenía un options.txt (jugó antes), solo se pone el idioma en español.
 * Después no se vuelve a tocar nada: lo que cambie el jugador dentro del juego se respeta.
 * Para volver a aplicarlas, se borra el archivo .dolmyr-opciones de la carpeta del juego.
 */
'use strict'

const fs = require('fs')
const path = require('path')

// Versión de datos de cada versión de Minecraft (la primera línea de options.txt).
// Sin ella el juego trataría el archivo como antiguo y lo "convertiría".
const VERSION_DATOS = {
    '26.2': 4903
}

const COMUN = {
    lang: 'es_es',
    tutorialStep: 'none',
    onboardAccessibility: 'false',
    skipMultiplayerWarning: 'true',
    joinedFirstServer: 'true',
    enableVsync: 'true',
    inactivityFpsLimit: '"afk"'
}

const NIVELES = {
    alta: {
        renderDistance: 12,
        simulationDistance: 8,
        graphicsPreset: '"fancy"',
        renderClouds: '"true"',
        entityShadows: 'true',
        biomeBlendRadius: 2,
        mipmapLevels: 4,
        particles: 0,
        maxFps: 260
    },
    media: {
        renderDistance: 8,
        simulationDistance: 6,
        graphicsPreset: '"fast"',
        renderClouds: '"fast"',
        entityShadows: 'false',
        biomeBlendRadius: 1,
        mipmapLevels: 2,
        particles: 0,
        maxFps: 120
    },
    baja: {
        renderDistance: 6,
        simulationDistance: 5,
        graphicsPreset: '"fast"',
        renderClouds: '"false"',
        entityShadows: 'false',
        biomeBlendRadius: 0,
        mipmapLevels: 1,
        particles: 1,
        maxFps: 60
    }
}

/**
 * @param {string} carpeta carpeta del juego (la instancia del servidor)
 * @param {string} versionMinecraft por ejemplo '26.2'
 * @param {string} nivel 'alta' | 'media' | 'baja'
 * @returns {string} qué se ha hecho (para el registro)
 */
exports.prepararOpciones = function (carpeta, versionMinecraft, nivel) {
    const marca = path.join(carpeta, '.dolmyr-opciones')
    if (fs.existsSync(marca)) {
        return 'ya aplicadas antes'
    }
    fs.mkdirSync(carpeta, { recursive: true })
    const archivo = path.join(carpeta, 'options.txt')
    const ajustes = NIVELES[nivel] || NIVELES.media
    let hecho

    if (!fs.existsSync(archivo)) {
        const version = VERSION_DATOS[versionMinecraft]
        if (version == null) {
            // Versión desconocida: mejor no escribir nada que el juego tenga que convertir
            return `sin datos para Minecraft ${versionMinecraft}: no se tocan las opciones`
        }
        const lineas = [`version:${version}`]
        for (const [clave, valor] of Object.entries(Object.assign({}, COMUN, ajustes))) {
            lineas.push(`${clave}:${valor}`)
        }
        fs.writeFileSync(archivo, lineas.join('\n') + '\n', 'utf8')
        hecho = `opciones iniciales para calidad ${nivel}`
    } else {
        // Ya había jugado: solo el idioma
        const texto = fs.readFileSync(archivo, 'utf8')
        const nuevo = /^lang:.*$/m.test(texto) ? texto.replace(/^lang:.*$/m, 'lang:es_es') : texto.trimEnd() + '\nlang:es_es\n'
        fs.writeFileSync(archivo, nuevo, 'utf8')
        hecho = 'juego en español (el resto de opciones se respeta)'
    }

    fs.writeFileSync(marca, `Opciones iniciales de Dolmyr aplicadas: ${hecho}.\nBorra este archivo para volver a aplicarlas al jugar.\n`, 'utf8')
    return hecho
}
