@echo off
rem Abre el launcher contra la network LOCAL (localhost:25565), para probar.
rem Hazle doble clic desde el Explorador: si se abre desde otra aplicacion, Windows puede cambiar
rem las rutas de AppData por debajo y Fabric se rompe al arrancar el juego.
chcp 65001 >nul
cd /d "%~dp0"
title Dolmyr - prueba local
echo Preparando la lista de mods local (tarda un minuto la primera vez)...
call npm run distribucion:local
if errorlevel 1 (
    echo.
    echo No se pudo preparar la lista de mods. Revisa la conexion a internet.
    pause
    exit /b 1
)
echo.
echo Abriendo el launcher...
call npm run start:local
