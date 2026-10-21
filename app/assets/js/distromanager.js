const { DistributionAPI } = require('helios-core/common')

const ConfigManager = require('./configmanager')

// Lista de distribución de Dolmyr: dice qué versión de Minecraft, qué cargador y qué mods
// tiene que descargar el launcher, y a qué servidor entra. Se genera con Nebula (ver distribucion/LEEME.md)
// y se publica en internet. Cambiarla actualiza a todos los jugadores sin publicar un launcher nuevo.
exports.REMOTE_DISTRO_URL = 'https://dolmyr.com/launcher/distribution.json'

// Pruebas: con la variable de entorno DOLMYR_DISTRIBUCION_LOCAL=1 se usa el archivo
// distribution_dev.json de la carpeta del programa (%APPDATA%\Dolmyr) en vez de la lista de internet.
// La crea "npm run distribucion:local".
const usarDistribucionLocal = process.env.DOLMYR_DISTRIBUCION_LOCAL === '1'

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    exports.REMOTE_DISTRO_URL,
    usarDistribucionLocal
)

exports.DistroAPI = api
