# Pase del launcher, actualizaciones y avisos

Tres cosas que unen el launcher con el servidor:

1. **Pase del launcher:** solo entra al servidor quien abre el juego desde este launcher y con los mods al día.
2. **Actualizaciones:** si se publica un mod nuevo, se descarga solo; el launcher también se actualiza solo.
3. **Avisos:** desde la consola del servidor (o el juego, con permiso) se le pueden enviar mensajes al launcher.

La parte del servidor es el plugin **NetworkLauncher** del proxy (proyecto `Network`, carpeta `desarrollo/NetworkLauncher`).

## 1. El pase del launcher

```
 Jugador pulsa JUGAR
   │  1. launcher ── "dame un reto" ─────────────────▶ NetworkLauncher (proxy, puerto 25580)
   │  2. launcher ── firma el reto con su cuenta ────▶ Mojang  (como hace el juego al entrar a un servidor)
   │  3. launcher ── "ya lo he firmado" ─────────────▶ NetworkLauncher ── "¿lo ha firmado?" ──▶ Mojang
   │                                                   └─ sí: pase para esa cuenta, con la revisión de los mods
   │  4. se abre el juego y entra al servidor
   ▼
 Al entrar, NetworkLauncher comprueba:
   · que la cuenta tiene pase (vale 12 h: se puede salir y volver a entrar sin abrir el launcher),
   · que los mods del pase son los publicados ahora (revisión),
   · que el launcher no es más viejo que la versión mínima,
   · que el cliente es Fabric.
   Si algo falla, el jugador ve un mensaje que le dice qué hacer (abrir el launcher, volver a pulsar JUGAR...).
```

- **El token de Minecraft nunca llega al servidor de Dolmyr**: solo va del launcher a Mojang, igual que cuando el
  juego entra a cualquier servidor. NetworkLauncher solo pregunta a Mojang si esa cuenta ha firmado el reto.
- **Revisión de los mods:** el generador de la lista calcula una huella de todos los mods y archivos
  (`dolmyr.revision` en `distribution.json`). Si cambia algún mod, cambia la revisión, y el servidor pide volver a
  pasar por el launcher (que descarga lo nuevo solo).
- **Modo** (`/launcher modo`): `obligatorio` (sin pase no se entra), `avisar` (entra, pero queda en la consola, útil
  para la primera semana) o `desactivado`.
- **Quién se lo salta:** solo quien tenga `networklauncher.exento`, que se da a mano y a una persona concreta.
  El rango admin lo tiene negado a propósito (si no, el `*` se lo daría).

### Lo que no puede hacer (dicho claro)

Ningún sistema hecho desde fuera del juego es imposible de engañar: alguien con conocimientos podría programar un
cliente que imite al launcher. Lo que sí consigue el pase es que **nadie entre con un launcher cualquiera, sin los
mods o con mods viejos**, y que hacer trampa exija programar a propósito. Para lo que pase dentro del juego (hacks de
combate, vuelo...) está el anticheat (Vulcan).

## 2. Actualizaciones

| Qué cambia | Qué haces | Qué pasa |
|---|---|---|
| **Mods o archivos** | Editas `distribucion/config.json` o `distribucion/archivos/` y haces push a `main` | El flujo *Publicar mods* genera y publica la lista. Los launchers abiertos se enteran en ~2 min y Dolm lo anuncia. Al pulsar JUGAR se descarga todo solo. El servidor exige la revisión nueva para entrar |
| **El launcher** | Subes la versión en `package.json`, commit y `git tag vX.Y.Z` + push de la etiqueta | El flujo *Publicar launcher* compila el instalador y crea la Release. Los launchers se actualizan solos al cerrarse |

Sin GitHub Actions también se puede: `npm run distribucion` y subir `distribucion/publicar/` a mano
(ver `docs/PUBLICAR.md`).

## 3. Avisos al launcher

En la consola del proxy (o en el juego con `networklauncher.admin`):

| Comando | Qué hace |
|---|---|
| `/launcher dolm <texto>` | Dolm lo dice en su bocadillo (si el jugador ha ocultado a Dolm, sale como ventana) |
| `/launcher aviso <texto>` | Sale como ventana "Aviso del Yermo" |
| `/launcher avisos` | Lista los avisos activos con su número |
| `/launcher borrar <número\|todos>` | Quita avisos |
| `/launcher modo [obligatorio\|avisar\|desactivado]` | Ver o cambiar el modo del pase |
| `/launcher pase <jugador>` | Ver si alguien tiene pase y si sus mods están al día |
| `/launcher quitarpase <jugador>` | Obligar a alguien a volver a pasar por el launcher |
| `/launcher estado` | Resumen: modo, revisión de mods, pases activos, avisos, puerto |
| `/launcher recargar` | Volver a leer `config.properties` |

- Los launchers abiertos miran las novedades cada 90 segundos. Cada aviso se muestra **una sola vez** por equipo.
- Los avisos duran 72 horas (`avisos.duracion-horas`). Quien abra el launcher en ese tiempo también los verá.
- Si se activa el **mantenimiento** (`/mantenimiento on` de NetworkProxy), Dolm lo cuenta solo; y cuando se quita, también.
- El texto se muestra tal cual (sin HTML), con un máximo de 300 letras.

## Puesta en marcha en el host

1. Compilar los plugins (`compilar-plugins.bat` en `Network`): `NetworkLauncher.jar` queda en `proxy/plugins`.
2. En el panel del host, **añadir un segundo puerto** al servidor del proxy (asignación extra) y ponerlo en
   `plugins/networklauncher/config.properties` → `web.puerto`.
3. En `distribucion/config.json` del launcher, `"servicio": "http://play.dolmyr.com:<ese puerto>"`, y publicar la lista.
4. En `config.properties` del plugin, `distribucion.url` = la dirección pública de `distribution.json`.
5. Ejecutar los comandos de `permisos/proxy.txt` (dan `/launcher` al admin y le niegan el salto del pase).
6. Recomendado: la primera semana con `/launcher modo avisar`, mirar la consola, y luego `obligatorio`.

## Probarlo en local

```bash
npm run distribucion:local      # lista con "servicio": http://127.0.0.1:25580
npm run start:local
```

Con el proxy local encendido y en su `config.properties`, `distribucion.url` apuntando a
`%APPDATA%\Dolmyr\distribution_dev.json` (la que genera el comando anterior). `npm run capturas` hace capturas de
los avisos (`11-aviso-dolm`, `12-aviso-ventana`) si hay avisos activos.
