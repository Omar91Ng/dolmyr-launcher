/**
 * Publica la lista de mods (distribucion/publicar/) en la rama "lista-de-mods" del repositorio de GitHub.
 * El launcher la lee de https://raw.githubusercontent.com/<dueño>/<repositorio>/lista-de-mods/distribution.json
 * (urlBase de distribucion/config.json y REMOTE_DISTRO_URL de app/assets/js/distromanager.js).
 *
 * Uso:
 *   npm run distribucion        genera la lista para publicar
 *   npm run publicar-lista      la sube a la rama lista-de-mods
 *
 * Lo mismo hace solo el flujo "Publicar mods" de GitHub Actions al hacer push a main.
 * La rama solo contiene la lista generada: no se edita a mano.
 */
'use strict'

const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const PUBLICAR = path.join(RAIZ, 'distribucion', 'publicar')
const RAMA = 'lista-de-mods'

function git(args, cwd = RAIZ) {
    return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()
}

function copiar(origen, destino) {
    for (const nombre of fs.readdirSync(origen)) {
        const o = path.join(origen, nombre)
        const d = path.join(destino, nombre)
        if (fs.statSync(o).isDirectory()) {
            fs.mkdirSync(d, { recursive: true })
            copiar(o, d)
        } else {
            fs.copyFileSync(o, d)
        }
    }
}

function principal() {
    const archivo = path.join(PUBLICAR, 'distribution.json')
    if (!fs.existsSync(archivo)) {
        throw new Error('Falta distribucion/publicar/distribution.json. Ejecuta antes: npm run distribucion')
    }
    const lista = JSON.parse(fs.readFileSync(archivo, 'utf8'))
    const servidor = lista.servers && lista.servers[0]
    if (servidor && /127\.0\.0\.1|localhost/.test(JSON.stringify([servidor.address, servidor.icon, lista.dolmyr]))) {
        throw new Error('Esta lista es la de pruebas locales (npm run distribucion:local). Genera la buena con: npm run distribucion')
    }
    const revision = (lista.dolmyr && lista.dolmyr.revision) || 'sin revisión'

    const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'dolmyr-lista-'))
    try {
        let existe = false
        try {
            git(['fetch', 'origin', RAMA])
            existe = true
        } catch (_e) {
            existe = false
        }
        if (existe) {
            git(['worktree', 'add', '-B', RAMA, temporal, `origin/${RAMA}`])
        } else {
            git(['worktree', 'add', '--detach', temporal])
            git(['checkout', '--orphan', RAMA], temporal)
        }
        // Vaciar (menos .git) y copiar la lista nueva
        for (const nombre of fs.readdirSync(temporal)) {
            if (nombre !== '.git') {
                fs.rmSync(path.join(temporal, nombre), { recursive: true, force: true })
            }
        }
        copiar(PUBLICAR, temporal)
        fs.writeFileSync(path.join(temporal, 'README.md'),
            '# Lista de mods de Dolmyr\n\nRama generada por `herramientas/publicar-lista.js` (o por el flujo *Publicar mods*).\n'
            + 'No se edita a mano: se cambia `distribucion/config.json` en `main`.\n')

        git(['add', '-A'], temporal)
        const cambios = git(['status', '--porcelain'], temporal)
        if (!cambios) {
            console.log('La lista publicada ya es esta: no hay nada que subir.')
            return
        }
        git(['commit', '-q', '-m', `Lista de mods (revisión ${revision})`], temporal)
        git(['push', 'origin', RAMA], temporal)
        console.log(`Lista publicada en la rama ${RAMA} (revisión ${revision}).`)
        console.log('Los launchers abiertos se enterarán en unos minutos; al pulsar JUGAR se descarga lo nuevo.')
    } finally {
        try {
            git(['worktree', 'remove', '--force', temporal])
        } catch (_e) {
            fs.rmSync(temporal, { recursive: true, force: true })
        }
    }
}

try {
    principal()
} catch (err) {
    console.error('\nERROR:', err.message)
    process.exit(1)
}
