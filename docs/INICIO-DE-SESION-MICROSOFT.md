# Inicio de sesión con Microsoft (registro de Dolmyr)

Para que el launcher pueda iniciar sesión con cuentas de Minecraft, Microsoft tiene que conocer la aplicación
de Dolmyr y Mojang tiene que aprobarla. **Es gratis, pero solo lo puede hacer el equipo** con una cuenta de
Microsoft propia (mejor la del proyecto, la de @dolmyr.com). Puede tardar una semana o más: conviene empezar ya.

Mientras tanto, el launcher usa en local el registro público de HeliosLauncher **solo para pruebas**.
No se debe publicar así (al arrancar sale un aviso en la consola).

## 1. Registrar la aplicación en Microsoft Entra (Azure)

1. Entra en https://portal.azure.com con la cuenta del proyecto.
2. Busca **Microsoft Entra ID** y abre **Registros de aplicaciones** (App registrations).
3. **Nuevo registro**:
   - **Nombre:** `Dolmyr`
   - **Tipos de cuenta:** *Cuentas de cualquier directorio organizativo y cuentas personales de Microsoft* (multiinquilino + personales).
   - **URI de redirección:** déjalo vacío.
   - Pulsa **Registrar**.
4. En la aplicación, ve a **Autenticación** → **Agregar una plataforma** → **Aplicaciones móviles y de escritorio**.
   - Marca `https://login.microsoftonline.com/common/oauth2/nativeclient` como URI de redirección.
   - Pulsa **Configurar**.
5. Ve a **Certificados y secretos** → **Secretos de cliente** → **Nuevo secreto de cliente**, ponle una descripción y
   pulsa **Agregar**. No hace falta copiarlo: Microsoft solo exige que exista.
6. Vuelve a **Información general** y copia el **Id. de aplicación (cliente)**.

## 2. Ponerlo en el launcher

Abre `app/assets/js/ipcconstants.js` y pega el ID:

```js
const AZURE_CLIENT_ID_DOLMYR = 'aquí-el-id-copiado'
```

Este ID **no es secreto**: se puede guardar en GitHub sin problema.

Después abre el launcher (`npm run start:local`) e **intenta iniciar sesión una vez**. Saldrá un error porque aún no
está aprobado: es normal y **es obligatorio** (Microsoft necesita ver actividad antes de aprobarlo).

## 3. Pedir la aprobación de Mojang

1. Rellena el formulario oficial: https://aka.ms/mce-reviewappid
   - Es una aplicación nueva (new appID).
   - Te pedirá el **Client ID** y el **Tenant ID** (los dos están en *Información general* de Azure).
   - Explica el proyecto: launcher propio de Dolmyr, solo para cuentas originales de Minecraft: Java Edition,
     entra directamente a nuestro servidor. Pon la web (dolmyr.com).
2. Espera la respuesta de Microsoft.
3. Cuando lo aprueben, los cambios pueden tardar hasta 24 horas en aplicarse.

Lo que ayuda a que lo aprueben (de las notas de Obsidian): que el launcher **solo deje entrar con cuenta original**
(ya lo hace), que haya una **web real** y que el pedido explique bien el proyecto.

**Plan B** mientras llega la aprobación: jugar con Prism Launcher normal (que ya tiene permiso) y los mismos mods.

Referencias: https://help.minecraft.net/hc/en-us/articles/16254801392141 y `docs/MicrosoftAuth.md` (guía original de Helios).
