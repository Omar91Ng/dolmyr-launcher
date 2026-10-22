# Lista de distribución (mods, versión y servidor)

El launcher no lleva los mods dentro: lee una lista (`distribution.json`) publicada en internet que dice
**qué versión de Minecraft, qué cargador, qué mods y qué archivos** tiene que descargar, y **a qué servidor entra**.
Cambiar la lista actualiza a todos los jugadores sin publicar un launcher nuevo.

## Cómo funciona

1. Se edita `distribucion/config.json`.
2. Se ejecuta `npm run distribucion`. Esto:
   - descarga el perfil y las librerías de **Fabric** y comprueba sus sumas oficiales;
   - busca en **Modrinth** la versión de cada mod para la versión de Minecraft elegida, añade solas sus
     dependencias obligatorias y calcula su MD5;
   - copia los archivos extra de `distribucion/archivos/`;
   - crea `distribucion/publicar/` con `distribution.json` y todo lo que hay que alojar.
3. Se sube el **contenido** de `distribucion/publicar/` a la dirección de `urlBase` (por defecto
   `https://dolmyr.com/launcher/`). Debe quedar accesible `https://dolmyr.com/launcher/distribution.json`.

La lista lleva un bloque `dolmyr` con la **revisión de los mods** (una huella de todos los mods y archivos) y la
dirección del servicio. Si cambia un mod, cambia la revisión, y el servidor exige volver a pulsar JUGAR (que lo
descarga solo). Con GitHub Actions basta con hacer push a `main`: ver `docs/PASE-Y-AVISOS.md`.

Los mods **no se copian**: el launcher los baja del CDN oficial de Modrinth. Así no se reparten archivos de otros
(algunas licencias no lo permiten) y siempre se baja el archivo original.

## config.json

| Campo | Qué es |
|---|---|
| `urlBase` | Dónde se publica la carpeta `publicar/` |
| `rss` | Canal RSS de las **crónicas** (noticias del launcher). Vacío = "Todavía no hay crónicas" |
| `minecraft` | Versión de Minecraft (tiene que coincidir con el servidor) |
| `fabric` | Versión del cargador Fabric (ver https://fabricmc.net/develop/) |
| `java` | Versión de Java que necesita (el launcher la instala sola si falta) |
| `servidor` | Nombre, descripción, **dirección** (`play.dolmyr.com:25565`), versión de la lista e icono |
| `mods` | Lista de mods de Modrinth por su nombre corto (el de la URL de modrinth.com/mod/**nombre**) |
| `servicio` | Servicio del plugin **NetworkLauncher** del proxy (pase del launcher y avisos), p. ej. `http://play.dolmyr.com:25580` |
| `pruebasLocales` | Dirección, URL y servicio para `npm run distribucion:local` |

### Añadir un mod

```json
{ "modrinth": "nombre-del-mod" }
```

Mod **opcional** (el jugador lo activa o desactiva en Ajustes → Mods):

```json
{ "modrinth": "iris", "opcional": true, "activadoPorDefecto": false, "nombre": "Iris (shaders)" }
```

### Mods propios (hechos por nosotros)

El jar va en `distribucion/mods-propios/` con el nombre `<nombre>-<versión>.jar` y se publica junto a la lista
(en `publicar/mods-propios/`). Por ejemplo, Dolm:

```json
{ "propio": "dolmyr-dolm-1.1.0.jar", "nombre": "Dolm, la mascota" }
```

Al sacar una versión nueva: cambia el nombre del jar y la línea de `config.json`, y copia el mismo jar a
`servers/yermo/mods/` de `Network` (el servidor y el jugador deben tener la misma versión).

### Archivos extra (configuraciones, menús de FancyMenu, paquetes de recursos...)

Lo que pongas en `distribucion/archivos/` se instala tal cual en la carpeta del juego del jugador, con la misma ruta.
Ejemplos:

- `distribucion/archivos/config/fancymenu/...` → configuración del menú principal propio.
- `distribucion/archivos/resourcepacks/Dolmyr.zip` → el paquete de texturas propio.
- `distribucion/archivos/options.txt` → opciones por defecto (cuidado: sobrescribe las del jugador en cada arranque).

## Probar en local

```bash
npm run distribucion:local
npm run start:local
```

La primera genera la lista apuntando a `http://127.0.0.1:8095/` y al servidor `localhost:25565` (la network local).
La segunda sirve esa carpeta y abre el launcher usándola.

## Mods incluidos ahora (Minecraft 26.2 + Fabric 0.19.5)

Fabric API, Sodium (rendimiento), **ImmediatelyFast, Entity Culling, More Culling, FerriteCore, Dynamic FPS y
BadOptimizations** (rendimiento y memoria; More Culling trae Cloth Config), FancyMenu y Drippy Loading Screen (menú y pantalla de carga propios, de las notas de
Obsidian), ETF y EMF (texturas y modelos de entidades), con sus dependencias Melody y Konkrete. **Biomes O' Plenty**
con TerraBlender y GlitchCore (los biomas del mapa; las mismas versiones que el servidor del Yermo) y **Shoulder
Surfing Reloaded** (cámara sobre el hombro, con Forge Config API Port). **GeckoLib** y el mod propio **Dolm, la
mascota** (`mods-propios/dolmyr-dolm-1.1.0.jar`, código en `Desktop/Dolmyr-Mascota/mod`). Iris (shaders) va como opcional.

**Ojo:** BOP necesita TerraBlender y GlitchCore aunque Modrinth no lo declare: por eso están puestos a mano en la lista.
Un mod que también va en el servidor tiene que tener allí la misma versión (`servers/yermo/mods.txt` de `Network`).

## Pendientes

- Diseñar con **FancyMenu** el menú principal, la pantalla de carga (Drippy) y el **título e icono de la ventana**
  ("Dolmyr" en vez de "Minecraft 26.2"). Se hace dentro del juego y se exporta su carpeta de configuración a
  `distribucion/archivos/config/`.
- ~~Forge o NeoForge~~: decidido **Fabric 26.2** (2026-10-21).
