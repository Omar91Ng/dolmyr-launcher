/**
 * Arranca el launcher en modo prueba, sin tener que tocar variables de entorno a mano.
 *
 *   npm run start:local      Sirve distribucion/publicar en http://127.0.0.1:8095/ y abre el launcher
 *                            usando la lista local (antes: npm run distribucion:local).
 *   npm run capturas         Igual, pero recorre todas las pantallas, guarda capturas en capturas/ y se cierra.
 */
'use strict'

const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const PUBLICAR = path.join(RAIZ, 'distribucion', 'publicar')
const PUERTO = 8095
const capturas = process.argv.includes('--capturas')

const TIPOS = {
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jar': 'application/java-archive',
    '.zip': 'application/zip',
    '.txt': 'text/plain; charset=utf-8'
}

function servir() {
    return new Promise((resolver) => {
        const servidor = http.createServer((req, res) => {
            const ruta = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '')
            const archivo = path.join(PUBLICAR, ruta)
            if (!archivo.startsWith(PUBLICAR) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
                res.writeHead(404)
                res.end('No encontrado')
                return
            }
            res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' })
            fs.createReadStream(archivo).pipe(res)
        })
        servidor.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`El puerto ${PUERTO} ya está en uso: se asume que la lista ya se está sirviendo.`)
                resolver(null)
            } else {
                throw err
            }
        })
        servidor.listen(PUERTO, '127.0.0.1', () => {
            console.log(`Lista de distribución servida en http://127.0.0.1:${PUERTO}/`)
            resolver(servidor)
        })
    })
}

async function principal() {
    if (!fs.existsSync(path.join(PUBLICAR, 'distribution.json'))) {
        console.error('Falta distribucion/publicar/distribution.json. Ejecuta antes: npm run distribucion:local')
        process.exit(1)
    }
    const servidor = await servir()
    const env = Object.assign({}, process.env, { DOLMYR_DISTRIBUCION_LOCAL: '1' })
    if (capturas) {
        env.DOLMYR_CAPTURAS = path.join(RAIZ, 'capturas')
        console.log(`Modo capturas: se guardarán en ${env.DOLMYR_CAPTURAS}`)
    }
    // --empaquetado: probar el programa compilado (dist/win-unpacked/Dolmyr.exe) en vez del Electron de desarrollo
    const empaquetado = process.argv.includes('--empaquetado')
    const ejecutable = empaquetado ? path.join(RAIZ, 'dist', 'win-unpacked', 'Dolmyr.exe') : require('electron')
    const proceso = spawn(ejecutable, empaquetado ? [] : ['.'], { cwd: RAIZ, env, stdio: 'inherit' })
    proceso.on('exit', (codigo) => {
        if (servidor) {
            servidor.close()
        }
        process.exit(codigo || 0)
    })
}

principal()
