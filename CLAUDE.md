# Launcher de Dolmyr — instrucciones para Claude

Launcher propio de **Dolmyr** (juego de rol medieval sobre Minecraft), construido sobre HeliosLauncher (Electron).
Lema: "Nadie te espera en el Yermo." Lee el [README](README.md) para la estructura y los comandos.

## Fuentes de verdad

- Bóveda de Obsidian de José: `C:\Users\usa04\Documents\Obsidian Vault\dolmyr\` (sobre todo `Launcher/`,
  `00 Marca/` y `Decisiones generales.md`). **Manda la bóveda.**
- Contexto común del proyecto (paleta, decisiones, servidor): carpeta `contexto/` del proyecto del servidor `Network`.

## Reglas

- **Solo cuentas originales (Microsoft).** No se implementa acceso sin cuenta ("no premium"): va contra la licencia
  de Minecraft e impediría la aprobación de Microsoft.
- **No romper la lógica de Helios:** el diseño va en `app/assets/css/dolmyr.css` y `app/assets/js/scripts/dolmyr.js`.
  No cambiar identificadores (`id`) de las pantallas: los usa la lógica de inicio de sesión, descarga y lanzamiento.
- Los scripts de Helios comparten el ámbito global: el código propio va dentro de funciones (sin `const` globales).
- **Todo en español.** Textos en `app/assets/lang/es_ES.toml` (nunca escritos a mano en el código).
- **Solo la paleta de Dolmyr** (variables en `:root` de `dolmyr.css`):
  rojo `#C8352E` · amarillo `#E9B63B` · azul `#2B4C8C` · hueso `#F2EBDD` · oscuro `#2A2420` ·
  piedra `#A39C90` · piedra oscura `#6E685E` · musgo `#4E7A3A` · liquen `#D9A23B` · luz del ojo `#F6D77A`.
  Letras: Ruslan Display (títulos, siempre en mayúsculas), Kelly Slab (subtítulos y botones), Alegreya Sans (texto).
- **Dolm tiene un solo ojo.** Nunca dos. Y no tiene boca: sus emociones van en la luz del ojo y el párpado de piedra.
- **Dolm, el guía** (`dolm.js`): sus frases van en `[js.dolm]` de `es_ES.toml`, en tú, gruñón pero leal y sin
  inventar mecánicas que no estén en la bóveda. Los vídeos se rehacen como explica `arte/DOLM-ANIMADO.md`.
- Mods solo desde Modrinth (el launcher los descarga de su CDN; no se redistribuyen).
- Nada de tokens, contraseñas ni secretos en el código. El ID de Azure no es secreto.

- **Pase del launcher** (`dolmyrservicio.js` + plugin NetworkLauncher del proxy): el token de Minecraft solo se envía
  a Mojang, nunca al servicio de Dolmyr. No añadir puertas traseras ni modos de prueba que se salten el pase.
  Los textos de los avisos del servidor se muestran siempre escapados (nunca como HTML).

## Cómo comprobar los cambios

1. `npm run lint` (debe salir limpio).
2. `npm run distribucion:local` y `npm run capturas`: revisar las imágenes de `capturas/`.
3. Para cambios de empaquetado: `npm run dist:win` y `npm run capturas -- --empaquetado`.

## Pendientes

Ver la sección "Pendiente para publicar" del README.
