# Publicar el launcher y sus actualizaciones

Hay **dos cosas que se actualizan por separado**:

| Qué | Cuándo cambia | Cómo llega al jugador |
|---|---|---|
| **La lista de distribución** (versión de Minecraft, mods, archivos, servidor) | Cada vez que se añade, quita o actualiza un mod | El launcher la descarga al abrirse. **No hace falta publicar un launcher nuevo.** Ver `distribucion/LEEME.md` |
| **El propio launcher** (diseño, textos, funciones) | Cuando se cambia el código | Autoactualización desde las *Releases* de GitHub |

**Automático con GitHub Actions** (`.github/workflows/`):

- *Publicar mods*: al hacer push a `main` con cambios en `distribucion/`, genera la lista y la sube a la rama
  `lista-de-mods`. Sin Actions: `npm run distribucion` y `npm run publicar-lista` desde el equipo.
- *Publicar launcher*: al subir una etiqueta `vX.Y.Z`, compila el instalador y crea la Release.

El pase del launcher y los avisos del servidor están en [PASE-Y-AVISOS.md](PASE-Y-AVISOS.md).

## Primera vez (una sola vez)

> **GitHub Actions:** si los flujos no arrancan con "account is locked due to a billing issue", hay que
> resolver el aviso de pagos en GitHub (Settings → Billing). Mientras tanto todo se puede hacer desde el equipo.


1. **Registro de Microsoft:** sigue `docs/INICIO-DE-SESION-MICROSOFT.md` y pon el ID en `app/assets/js/ipcconstants.js`.
2. **Repositorio de GitHub:** hecho. Es público: https://github.com/Omar91Ng/dolmyr-launcher (dentro no hay ninguna
   clave; tiene activados el escaneo de secretos con bloqueo de pushes y las alertas de dependencias).
3. `owner` y `repo` ya están en `electron-builder.yml` (sección `publish`) y en `dev-app-update.yml`.
4. **Alojamiento de la lista:** la rama `lista-de-mods` del repositorio, servida por
   `https://raw.githubusercontent.com/Omar91Ng/dolmyr-launcher/lista-de-mods/` (https y gratis, sin depender de
   Actions). Si algún día se usa un dominio propio, cambiar `urlBase` de `distribucion/config.json` y
   `REMOTE_DISTRO_URL` de `app/assets/js/distromanager.js`. Tiene que ser **https**: la lista dice qué archivos se
   instalan en el equipo del jugador.
5. **Servicio del pase:** puerto extra en el proxy y `"servicio"` en `distribucion/config.json`
   (ver [PASE-Y-AVISOS.md](PASE-Y-AVISOS.md)).

## Publicar una versión nueva del launcher

1. Sube el número de versión en `package.json` (por ejemplo `0.1.0` → `0.2.0`). La autoactualización compara este número.
2. Compila: `npm run dist:win`. Salen en `dist/`:
   - `Dolmyr-instalador-<versión>.exe` (el instalador)
   - `Dolmyr-instalador-<versión>.exe.blockmap` y `latest.yml` (los usa la autoactualización)
3. **Con GitHub Actions:** `git tag v<versión>` y `git push origin v<versión>`: el flujo hace el resto.
   **A mano:** crea una *Release* en GitHub con la etiqueta `v<versión>` y sube **los tres archivos**.
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
