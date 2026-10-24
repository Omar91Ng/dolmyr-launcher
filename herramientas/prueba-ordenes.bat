@echo off
rem Prueba de las órdenes del servidor (/launcher reiniciar) con la network local.
rem Hay que abrirlo desde el Explorador (doble clic), no desde otra aplicación: así el juego ve las carpetas reales.
rem 1. Arranca el proxy local (Network\proxy). 2. Doble clic aquí: genera la lista local, abre el launcher y pulsa JUGAR solo.
rem 3. Con el juego abierto, en la consola del proxy: launcher reiniciar 15
cd /d "%~dp0.."
set DOLMYR_PRUEBA_JUGAR=1
node herramientas\generar-distribucion.js --local > herramientas\prueba-ordenes.log 2>&1
node herramientas\arrancar.js >> herramientas\prueba-ordenes.log 2>&1
