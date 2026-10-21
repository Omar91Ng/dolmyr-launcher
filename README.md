# Launcher de Dolmyr

El launcher oficial de **Dolmyr**, un juego de rol medieval, duro y sin héroes, hecho sobre Minecraft.
*Nadie te espera en el Yermo.*

Hace que desde el primer segundo parezca otro juego: el jugador abre el launcher, inicia sesión con su cuenta
original de Minecraft, el launcher descarga e instala todo lo necesario y entra **directamente al servidor**.

Está construido sobre [HeliosLauncher](https://github.com/dscalzi/HeliosLauncher) (licencia MIT), con la identidad,
las pantallas, los textos y varias funciones propias de Dolmyr.

## Qué hace

- **Solo cuentas originales** (Microsoft / Xbox Game Pass para PC). No hay acceso sin cuenta.
- **Solo para el servidor de Dolmyr:** entra directo, sin pasar por la lista de servidores.
- **Descarga e instala todo solo:** Java 25, Minecraft 26.2, Fabric y los mods, comprobando cada archivo.
  La lista de mods vive en internet: si cambia, todos los jugadores se actualizan al abrir el launcher.
- **Mods opcionales:** el jugador puede activar o desactivar algunos (por ejemplo, shaders) en Ajustes → Mods.
- **Se actualiza solo:** las versiones nuevas del launcher se descargan e instalan desde GitHub.
- **Pase del launcher:** el servidor solo deja entrar a quien abre el juego desde este launcher y con los mods al día
  (plugin NetworkLauncher del proxy). Si se publica un mod nuevo, se descarga solo al pulsar JUGAR.
- **Avisos desde el servidor:** `/launcher dolm <texto>` lo dice Dolm; `/launcher aviso <texto>` sale como ventana.
  Ver [docs/PASE-Y-AVISOS.md](docs/PASE-Y-AVISOS.md).
- **Todo en español.**
- **Identidad de Dolmyr:** paleta folk, letras Ruslan Display, Kelly Slab y Alegreya Sans, y Dolm, la mascota.
- **Animaciones:** paisajes que cambian con fundido y movimiento lento, niebla, brasas flotando, el ojo de la O que
  late, botón JUGAR que respira y brilla, entradas suaves de cada pantalla y sonidos suaves de interfaz.
- **Dolm, el guía:** el gólem animado (vídeos con transparencia) que habla en un bocadillo letra a letra con una voz de
  piedra. Saluda por tu nombre, comenta el estado del servidor, te acompaña en la descarga, celebra cuando entras y
  refunfuña si algo falla. Si le das un toque, contesta. Aparece en la bienvenida, el inicio de sesión y la pantalla principal.
- **Personalización** (Ajustes → Apariencia): elegir paisaje o dejarlo al azar, cambio automático, movimiento,
  partículas, niebla, sonidos, Dolm (mostrarlo, que hable solo, su voz) y un modo "reducir el movimiento" para equipos lentos.
- **Crónicas:** las noticias del juego, desde un canal RSS.

## Pantallas

Al arrancar en modo capturas (`npm run capturas`) se genera una imagen de cada pantalla en `capturas/`.

## Uso para desarrollar

Requisitos: Node.js 22 o superior, Git y Python con Pillow (solo para regenerar imágenes).

```bash
npm install                  # dependencias (la primera vez)
npm run distribucion:local   # genera la lista de mods para probar en este equipo
npm run start:local          # abre el launcher usando esa lista
npm run capturas             # recorre todas las pantallas y guarda capturas en capturas/
npm run lint                 # revisa el código
npm run dist:win             # compila el instalador en dist/
```

| Comando | Qué hace |
|---|---|
| `npm run distribucion` | Genera la lista para publicar en internet (`distribucion/publicar/`) |
| `npm run distribucion:local` | Igual, pero apuntando a este equipo y a la network local (`localhost:25565`) |
| `npm run start:local` | Sirve la lista local y abre el launcher con ella |
| `npm run capturas` | Como el anterior, recorre las pantallas, guarda capturas y se cierra (`-- --empaquetado` usa el programa compilado) |
| `npm run recursos` | Regenera fondos, icono y sellos desde `arte/originales/` |
| `npm run dist:win` | Compila `dist/Dolmyr-instalador-<versión>.exe` |

## Estructura

| Ruta | Qué es |
|---|---|
| `app/` | El launcher: pantallas (`.ejs`), estilos, scripts, textos e imágenes |
| `app/assets/css/dolmyr.css` | **Toda la capa visual de Dolmyr** (paleta, vidrio, animaciones). Se carga encima del CSS de Helios |
| `app/assets/js/scripts/dolmyr.js` | Escena animada, pestaña Apariencia, sonidos y modo capturas |
| `app/assets/js/dolmyrservicio.js` | Conexión con el servidor: **pase del launcher** al pulsar JUGAR y novedades |
| `app/assets/js/scripts/novedades.js` | Avisos del servidor, mods nuevos publicados y mantenimiento (cada 90 s) |
| `.github/workflows/` | **Publicar mods** (push a `main`) y **publicar launcher** (etiqueta `vX.Y.Z`) |
| `app/assets/js/scripts/dolm.js` | **Dolm, el guía:** figura animada, bocadillo, voz y reacciones. Sus frases están en `es_ES.toml`, sección `[js.dolm]` |
| `app/assets/videos/dolm/` | Los 5 vídeos de Dolm con transparencia (reposo, hablar, saludo, alegria, grunon). Cómo se hicieron: `arte/DOLM-ANIMADO.md` |
| `app/assets/lang/es_ES.toml` | Todos los textos en español |
| `app/assets/lang/_custom.toml` | Textos de la marca y **enlaces de redes** (los que están en `#` se ocultan solos) |
| `app/assets/js/ipcconstants.js` | **ID de Microsoft** (pendiente de registrar: ver docs) |
| `app/assets/js/distromanager.js` | Dirección de la lista de distribución |
| `arte/` | Imágenes originales (generadas con Higgsfield) y el script que crea los recursos |
| `distribucion/` | Configuración de la lista de mods y su generador (`LEEME.md`) |
| `herramientas/` | Generador de la lista y arrancador de pruebas |
| `docs/` | Guías: inicio de sesión con Microsoft, publicar, y las originales de Helios |
| `build/` | Iconos del instalador |

## Pendiente para publicar

1. **Registrar la aplicación en Microsoft y pedir el permiso de Mojang** → `docs/INICIO-DE-SESION-MICROSOFT.md`.
   Hasta entonces se usa el ID de Helios **solo para pruebas**.
2. **Repositorio de GitHub y alojamiento de la lista** → `docs/PUBLICAR.md`.
3. **Enlaces de redes** (Discord, YouTube, Instagram, TikTok, Facebook) en `app/assets/lang/_custom.toml`.
4. **Canal de crónicas** (RSS) en `distribucion/config.json`.
5. **Menú principal y pantalla de carga dentro del juego** con FancyMenu y Drippy (título e icono de la ventana
   incluidos) → `distribucion/LEEME.md`.
6. Decidir el **cargador definitivo**: el launcher soporta Fabric y Forge, **no NeoForge**.

## Créditos y licencias

- Base: [HeliosLauncher](https://github.com/dscalzi/HeliosLauncher) de Daniel Scalzi, licencia MIT (`LICENSE.txt`).
- Letras: Ruslan Display, Kelly Slab y Alegreya Sans, de Google Fonts, licencia SIL OFL (`app/assets/fonts/OFL-Dolmyr.txt`).
- Arte de fondos y de Dolm: generado para Dolmyr con Higgsfield a partir del concepto oficial de Dolm.
  Animaciones de Dolm: Kling 3.0 (en Higgsfield) a partir de la misma imagen.
- Los mods se descargan de Modrinth y pertenecen a sus autores; el launcher no los redistribuye.
- Dolmyr no está afiliado a Mojang ni a Microsoft.
