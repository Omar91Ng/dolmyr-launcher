// ID de la aplicación de Dolmyr en Microsoft Azure (inicio de sesión con cuentas de Minecraft).
// PENDIENTE: registrar la aplicación de Dolmyr en Azure, pedir el permiso de Mojang y pegar aquí su ID
// (pasos en docs/INICIO-DE-SESION-MICROSOFT.md). También se puede pasar con la variable DOLMYR_AZURE_CLIENT_ID.
const AZURE_CLIENT_ID_DOLMYR = ''

// ID público de HeliosLauncher: SOLO para probar en local mientras llega el de Dolmyr. No publicar con él.
exports.AZURE_CLIENT_ID_HELIOS = '1ce6e35a-126f-48fd-97fb-54d143ac6d45'

exports.AZURE_CLIENT_ID = process.env.DOLMYR_AZURE_CLIENT_ID || AZURE_CLIENT_ID_DOLMYR || exports.AZURE_CLIENT_ID_HELIOS


// Opcodes
exports.MSFT_OPCODE = {
    OPEN_LOGIN: 'MSFT_AUTH_OPEN_LOGIN',
    OPEN_LOGOUT: 'MSFT_AUTH_OPEN_LOGOUT',
    REPLY_LOGIN: 'MSFT_AUTH_REPLY_LOGIN',
    REPLY_LOGOUT: 'MSFT_AUTH_REPLY_LOGOUT'
}
// Reply types for REPLY opcode.
exports.MSFT_REPLY_TYPE = {
    SUCCESS: 'MSFT_AUTH_REPLY_SUCCESS',
    ERROR: 'MSFT_AUTH_REPLY_ERROR'
}
// Error types for ERROR reply.
exports.MSFT_ERROR = {
    ALREADY_OPEN: 'MSFT_AUTH_ERR_ALREADY_OPEN',
    NOT_FINISHED: 'MSFT_AUTH_ERR_NOT_FINISHED'
}

exports.SHELL_OPCODE = {
    TRASH_ITEM: 'TRASH_ITEM'
}