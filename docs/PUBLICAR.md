# Publicar el launcher y sus actualizaciones

Hay **dos cosas que se actualizan por separado**:

| Qué | Cuándo cambia | Cómo llega al jugador |
|---|---|---|
| **La lista de distribución** (versión de Minecraft, mods, archivos, servidor) | Cada vez que se añade, quita o actualiza un mod | El launcher la descarga al abrirse. **No hace falta publicar un launcher nuevo.** Ver `distribucion/LEEME.md` |
| **El propio launcher** (diseño, textos, funciones) | Cuando se cambia el código | Autoactualización desde las *Releases* de GitHub |

## Primera vez (una sola vez)

1. **Registro de Microsoft:** sigue `docs/INICIO-DE-SESION-MICROSOFT.md` y pon el ID en `app/assets/js/ipcconstants.js`.
2. **Repositorio de GitHub del equipo** (por ejemplo `dolmyr/dolmyr-launcher`). Puede ser privado para el código,
   pero las *Releases* tienen que poder descargarse: lo más sencillo es un repositorio **público** solo para publicar.
3. Pon ese `owner` y `repo` en `electron-builder.yml` (sección `publish`) y en `dev-app-update.yml`.
4. **Alojamiento de la lista:** sube `distribucion/publicar/` a `https://dolmyr.com/launcher/` (o cambia `urlBase` en
   `distribucion/config.json` y `REMOTE_DISTRO_URL` en `app/assets/js/distromanager.js`).

## Publicar una versión nueva del launcher

1. Sube el número de versión en `package.json` (por ejemplo `0.1.0` → `0.2.0`). La autoactualización compara este número.
2. Compila: `npm run dist:win`. Salen en `dist/`:
   - `Dolmyr-instalador-<versión>.exe` (el instalador)
   - `Dolmyr-instalador-<versión>.exe.blockmap` y `latest.yml` (los usa la autoactualización)
3. Crea una *Release* en GitHub con la etiqueta `v<versión>` y sube **los tres archivos**.
   También se puede hacer automáticamente con un token: `set GH_TOKEN=...` y `npx electron-builder -w --publish always`
   (el token es personal: nunca lo guardes en el código).
4. Los launchers instalados detectan la versión nueva, la descargan y se instala al cerrarlos
   (en Ajustes → Actualizaciones también se puede forzar).

## Problema conocido al compilar en Windows

Si `npm run dist:win` falla con *"Cannot create symbolic link ... libcrypto.dylib"*, es por las herramientas de firma
de electron-builder (traen archivos de macOS con enlaces simbólicos). Soluciones: activar el **Modo de desarrollador**
de Windows, compilar en una consola como administrador, o extraer el paquete `winCodeSign` sin la carpeta `darwin` en
`%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0` (es lo que se hizo en este equipo).

## Firma del instalador (opcional, para más adelante)

Sin firma digital, Windows muestra "Windows protegió su PC" al instalar (hay que pulsar *Más información → Ejecutar
de todas formas*). Quitar el aviso requiere un certificado de firma de código, que cuesta dinero cada año.
Para las primeras versiones no hace falta.
