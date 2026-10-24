/**
 * Generador de la lista de distribución de Dolmyr (distribution.json) para el launcher.
 *
 * Lee distribucion/config.json y crea distribucion/publicar/ con:
 *   - distribution.json        la lista que lee el launcher (versión de Minecraft, Fabric, mods, servidor)
 *   - fabric/<id>.json         el perfil de Fabric (alojado por nosotros para que no cambie)
 *   - icono.png                icono del servidor
 *   - archivos/...             archivos extra copiados de distribucion/archivos (configs, packs...)
 *
 * Los mods NO se copian: se descargan del CDN oficial de Modrinth (con su MD5 comprobado).
 * Las dependencias obligatorias de cada mod se añaden solas.
 *
 * Uso:
 *   node herramientas/generar-distribucion.js            -> para publicar en internet (urlBase de config.json)
 *   node herramientas/generar-distribucion.js --local    -> para probar en este equipo:
 *        escribe además %APPDATA%\Dolmyr\distribution_dev.json apuntando a http://127.0.0.1:8095/
 *        (npm run start:local sirve la carpeta y abre el launcher)
 */
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const CARPETA = path.join(RAIZ, 'distribucion')
const PUBLICAR = path.join(CARPETA, 'publicar')
const UA = { 'User-Agent': 'dolmyr-launcher/0.1 (https://dolmyr.com)' }
const LOCAL = process.argv.includes('--local')

const config = JSON.parse(fs.readFileSync(path.join(CARPETA, 'config.json'), 'utf8'))
const urlBase = (LOCAL ? config.pruebasLocales.urlBase : config.urlBase).replace(/\/?$/, '/')
const direccion = LOCAL ? config.pruebasLocales.direccion : config.servidor.direccion
const servicio = (LOCAL ? config.pruebasLocales.servicio : config.servicio) || ''

async function pedir(url) {
    const res = await fetch(url, { headers: UA })
    if (!res.ok) {
        throw new Error(`${res.status} al pedir ${url}`)
    }
    return res
}

async function json(url) {
    return (await pedir(url)).json()
}

async function bytes(url) {
    return Buffer.from(await (await pedir(url)).arrayBuffer())
}

const md5 = b => crypto.createHash('md5').update(b).digest('hex')
const sha1 = b => crypto.createHash('sha1').update(b).digest('hex')

/** Ruta maven de un identificador grupo:artefacto:versión */
function rutaMaven(id) {
    const [grupo, artefacto, version] = id.split(':')
    return `${grupo.replace(/\./g, '/')}/${artefacto}/${version}/${artefacto}-${version}.jar`
}

function limpiarVersion(v) {
    return v.replace(/[^A-Za-z0-9._+-]/g, '_')
}

// ----------------------------------------------------------------------------- Fabric

async function moduloFabric() {
    const mc = config.minecraft
    const ver = config.fabric
    console.log(`Fabric ${ver} para Minecraft ${mc}...`)
    const perfilBytes = await bytes(`https://meta.fabricmc.net/v2/versions/loader/${mc}/${ver}/profile/json`)
    const perfil = JSON.parse(perfilBytes.toString('utf8'))

    fs.mkdirSync(path.join(PUBLICAR, 'fabric'), { recursive: true })
    const archivoPerfil = `fabric/${perfil.id}.json`
    fs.writeFileSync(path.join(PUBLICAR, archivoPerfil), perfilBytes)

    let cargador = null
    const librerias = []
    for (const lib of perfil.libraries) {
        const url = lib.url.replace(/\/?$/, '/') + rutaMaven(lib.name)
        const b = await bytes(url)
        if (lib.sha1 && sha1(b) !== lib.sha1) {
            throw new Error(`SHA-1 incorrecto en ${lib.name}`)
        }
        const modulo = {
            id: lib.name,
            name: lib.name.split(':')[1],
            type: 'Library',
            artifact: { size: b.length, MD5: md5(b), url }
        }
        if (lib.name.startsWith('net.fabricmc:fabric-loader:')) {
            cargador = modulo
        } else {
            librerias.push(modulo)
        }
        console.log(`  · ${lib.name}`)
    }
    if (cargador == null) {
        throw new Error('El perfil de Fabric no incluye fabric-loader')
    }
    return {
        id: cargador.id,
        name: `Fabric ${ver}`,
        type: 'Fabric',
        artifact: cargador.artifact,
        subModules: [
            {
                id: perfil.id,
                name: 'Perfil de Fabric',
                type: 'VersionManifest',
                artifact: { size: perfilBytes.length, MD5: md5(perfilBytes), url: urlBase + archivoPerfil }
            },
            ...librerias
        ]
    }
}

// ----------------------------------------------------------------------------- Mods de Modrinth

const proyectosVistos = new Map()

// fijada: un número de versión exacto (campo "version" en config.json); si no, la última estable para esta versión de Minecraft
async function versionModrinth(proyecto, fijada) {
    const q = new URLSearchParams({
        loaders: JSON.stringify(['fabric']),
        game_versions: JSON.stringify([config.minecraft])
    })
    const versiones = await json(`https://api.modrinth.com/v2/project/${encodeURIComponent(proyecto)}/version?${q}`)
    const estable = fijada
        ? versiones.find(v => v.version_number === fijada)
        : versiones.find(v => v.version_type === 'release') || versiones[0]
    if (estable == null) {
        throw new Error(`El mod "${proyecto}" no tiene ${fijada ? `la versión ${fijada}` : 'versión'} para Fabric ${config.minecraft}`)
    }
    return estable
}

async function moduloMod(entrada, porDependencia = false) {
    const version = await versionModrinth(entrada.modrinth, entrada.version)
    const proyecto = await json(`https://api.modrinth.com/v2/project/${version.project_id}`)
    if (proyectosVistos.has(proyecto.id)) {
        return []
    }
    proyectosVistos.set(proyecto.id, true)

    const archivo = version.files.find(f => f.primary) || version.files[0]
    const b = await bytes(archivo.url)
    if (sha1(b) !== archivo.hashes.sha1) {
        throw new Error(`SHA-1 incorrecto en ${archivo.filename}`)
    }
    const modulo = {
        id: `com.modrinth.${proyecto.slug}:${proyecto.slug}:${limpiarVersion(version.version_number)}`,
        name: entrada.nombre || proyecto.title,
        type: 'FabricMod',
        artifact: { size: b.length, MD5: md5(b), url: archivo.url }
    }
    if (entrada.opcional) {
        modulo.required = { value: false, def: entrada.activadoPorDefecto !== false }
    }
    console.log(`  · ${modulo.name} ${version.version_number}${porDependencia ? ' (dependencia)' : ''}${entrada.opcional ? ' (opcional)' : ''}`)

    const resultado = [modulo]
    for (const dep of version.dependencies || []) {
        if (dep.dependency_type === 'required' && dep.project_id && !proyectosVistos.has(dep.project_id)) {
            resultado.push(...await moduloMod({ modrinth: dep.project_id }, true))
        }
    }
    return resultado
}

// ----------------------------------------------------------------------------- Mods propios

// Mods hechos por nosotros (por ejemplo Dolm): el jar va en distribucion/mods-propios/<nombre>-<versión>.jar
// y se publica junto a la lista, en publicar/mods-propios/.
function moduloPropio(entrada) {
    const partes = /^(.*)-(\d[\w.+-]*)\.jar$/.exec(entrada.propio)
    if (partes == null) {
        throw new Error(`El mod propio "${entrada.propio}" tiene que llamarse <nombre>-<versión>.jar`)
    }
    const b = fs.readFileSync(path.join(CARPETA, 'mods-propios', entrada.propio))
    const destino = path.join(PUBLICAR, 'mods-propios', entrada.propio)
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    fs.writeFileSync(destino, b)
    console.log(`  · ${entrada.nombre || partes[1]} ${partes[2]} (propio)`)
    return {
        id: `com.dolmyr:${partes[1]}:${partes[2]}`,
        name: entrada.nombre || partes[1],
        type: 'FabricMod',
        artifact: { size: b.length, MD5: md5(b), url: urlBase + 'mods-propios/' + encodeURIComponent(entrada.propio) }
    }
}

// ----------------------------------------------------------------------------- Archivos extra

function modulosArchivos() {
    const origen = path.join(CARPETA, 'archivos')
    const modulos = []
    if (!fs.existsSync(origen)) {
        return modulos
    }
    const recorrer = (dir) => {
        for (const nombre of fs.readdirSync(dir)) {
            const completo = path.join(dir, nombre)
            if (fs.statSync(completo).isDirectory()) {
                recorrer(completo)
                continue
            }
            const relativo = path.relative(origen, completo).split(path.sep).join('/')
            const destino = path.join(PUBLICAR, 'archivos', relativo)
            fs.mkdirSync(path.dirname(destino), { recursive: true })
            fs.copyFileSync(completo, destino)
            const b = fs.readFileSync(completo)
            modulos.push({
                id: `dolmyr.archivos:${relativo.replace(/[^A-Za-z0-9]/g, '_')}:1`,
                name: relativo,
                type: 'File',
                artifact: { size: b.length, MD5: md5(b), url: urlBase + 'archivos/' + encodeURI(relativo), path: relativo }
            })
            console.log(`  · ${relativo}`)
        }
    }
    recorrer(origen)
    return modulos
}

// ----------------------------------------------------------------------------- Principal

async function principal() {
    fs.rmSync(PUBLICAR, { recursive: true, force: true })
    fs.mkdirSync(PUBLICAR, { recursive: true })

    const fabric = await moduloFabric()
    console.log('Mods (desde Modrinth y propios)...')
    const mods = []
    for (const entrada of config.mods) {
        mods.push(...(entrada.propio ? [moduloPropio(entrada)] : await moduloMod(entrada)))
    }
    console.log('Archivos extra...')
    const archivos = modulosArchivos()

    const icono = path.join(RAIZ, 'app', 'assets', 'images', 'SealCircle.png')
    fs.copyFileSync(icono, path.join(PUBLICAR, config.servidor.icono))

    const modulos = [fabric, ...mods, ...archivos]
    // Revisión de los mods: huella de los módulos (versiones y MD5). Solo cambia si cambian los mods o los archivos.
    // El servidor (NetworkLauncher) la compara con la del pase: con otra revisión no se entra hasta volver a pulsar JUGAR.
    const revision = crypto.createHash('sha256').update(JSON.stringify(modulos)).digest('hex').slice(0, 16)

    const distribucion = {
        version: '1.0.0',
        dolmyr: {
            revision,
            servicio,
            generada: new Date().toISOString()
        },
        rss: config.rss || '',
        discord: null,
        servers: [{
            id: config.servidor.id,
            name: config.servidor.nombre,
            description: config.servidor.descripcion,
            icon: urlBase + config.servidor.icono,
            version: config.servidor.version,
            address: direccion,
            minecraftVersion: config.minecraft,
            javaOptions: config.java,
            mainServer: true,
            autoconnect: true,
            modules: modulos
        }]
    }
    const texto = JSON.stringify(distribucion, null, 2)
    fs.writeFileSync(path.join(PUBLICAR, 'distribution.json'), texto)
    console.log(`\nLista creada: distribucion/publicar/distribution.json (${mods.length} mods, ${archivos.length} archivos)`)
    console.log(`Revisión de los mods: ${revision}${servicio ? '' : '  (AVISO: falta "servicio" en config.json: no habrá pase ni avisos)'}`)

    if (LOCAL) {
        // Carpeta del programa (userData de Electron = nombre del producto), donde Helios busca distribution_dev.json
        const datos = path.join(process.env.APPDATA || path.join(require('os').homedir(), '.config'), 'Dolmyr')
        fs.mkdirSync(datos, { recursive: true })
        fs.writeFileSync(path.join(datos, 'distribution_dev.json'), texto)
        console.log(`Copia para pruebas: ${path.join(datos, 'distribution_dev.json')}`)
        console.log('Arranca el launcher con "npm run start:local" (sirve la lista en http://127.0.0.1:8095/).')
    } else {
        console.log(`Sube el CONTENIDO de distribucion/publicar/ a ${urlBase}`)
    }
}

principal().catch((err) => {
    console.error('\nERROR:', err.message)
    process.exit(1)
})
