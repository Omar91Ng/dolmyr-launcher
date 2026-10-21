# Dolm animado — cómo se hicieron los vídeos

Los vídeos de `app/assets/videos/dolm/` salen de la imagen de Dolm del launcher (`app/assets/images/dolm.png`).

1. **Imagen de partida:** `originales/dolm-magenta.png` (1024 × 1024). Dolm centrado, ocupando el 72 % del alto,
   sobre fondo magenta puro `#FF00FF` (el verde chocaría con el musgo de la corona).
2. **Vídeo:** Higgsfield, modelo **Kling 3.0**, modo `pro`, 5 s, 1:1, sin sonido, con la misma imagen como
   **primer y último fotograma** para que los bucles no salten. Unos 8,75 créditos por clip.
   Cada indicación pide cámara fija, mismo tamaño y posición, fondo magenta que no cambia, **un solo ojo y sin boca**.

   | Clip | Qué hace |
   |---|---|
   | `reposo` | Respira, se mecen las flores y las cintas, parpadea una vez (bucle) |
   | `hablar` | Cabecea al ritmo de la voz, la luz del ojo parpadea, abre la mano y gesticula (bucle) |
   | `saludo` | Levanta el puño y lo agita para saludar |
   | `alegria` | Saltito, puño en alto dos veces, el ojo brilla mucho |
   | `grunon` | Párpado a media asta, ladea la cabeza, se da golpecitos en la mano y suspira |

3. **Quitar el fondo** (ffmpeg): clave de color sobre el magenta, quitar el tinte magenta de los bordes y
   WebM VP9 con transparencia a 640 × 640:

   ```bash
   ffmpeg -i clip.mp4 -an -vf "scale=640:640:flags=lanczos,format=rgb24,colorkey=0xFF00FF:0.30:0.12,format=rgba,geq=r='r(X,Y)-max(0,min(r(X,Y),b(X,Y))-g(X,Y))':g='g(X,Y)':b='b(X,Y)-max(0,min(r(X,Y),b(X,Y))-g(X,Y))':a='alpha(X,Y)'" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 33 -auto-alt-ref 0 clip.webm
   ```

Para añadir un gesto nuevo: generar el clip igual, convertirlo, dejarlo en `app/assets/videos/dolm/` y añadir su
nombre a `CLIPS` en `app/assets/js/scripts/dolm.js`.
