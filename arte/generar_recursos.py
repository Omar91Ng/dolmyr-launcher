"""
Genera todos los recursos gráficos del launcher de Dolmyr a partir de arte/originales/.

Uso (desde cualquier carpeta):
    python arte/generar_recursos.py

Necesita Pillow (pip install pillow). Crea o reemplaza:
    app/assets/images/backgrounds/0..N.jpg   fondos del launcher (1920x1080)
    app/assets/images/dolm.png               Dolm saludando (pantalla de bienvenida)
    app/assets/images/SealCircle.png/.ico    icono de la app: la "O" con el ojo
    app/assets/images/LoadingSeal.png        sello de la pantalla de carga
    app/assets/images/LoadingText.png        anillo de texto que gira alrededor del sello
    build/icon.png                           icono para el instalador (1024x1024)
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(RAIZ, "arte", "originales")
IMG = os.path.join(RAIZ, "app", "assets", "images")
FUENTES = os.path.join(RAIZ, "app", "assets", "fonts")

# Paleta de Dolmyr
ROJO = (200, 53, 46)
AMARILLO = (233, 182, 59)
HUESO = (242, 235, 221)
OSCURO = (42, 36, 32)
PIEDRA_OSCURA = (110, 104, 94)
LUZ_OJO = (246, 215, 122)

# Orden de los fondos (el launcher elige uno al azar en cada arranque)
FONDOS = ["fondo-yermo", "fondo-niebla", "fondo-asentamiento", "fondo-forja", "fondo-amanecer"]


def cubrir(im, ancho, alto):
    """Escala y recorta al centro para cubrir ancho x alto (como background-size: cover)."""
    escala = max(ancho / im.width, alto / im.height)
    im = im.resize((round(im.width * escala), round(im.height * escala)), Image.LANCZOS)
    x = (im.width - ancho) // 2
    y = (im.height - alto) // 2
    return im.crop((x, y, x + ancho, y + alto))


def fondos():
    carpeta = os.path.join(IMG, "backgrounds")
    for f in os.listdir(carpeta):
        os.remove(os.path.join(carpeta, f))
    for i, nombre in enumerate(FONDOS):
        im = Image.open(os.path.join(ORIG, nombre + ".png")).convert("RGB")
        cubrir(im, 1920, 1080).save(os.path.join(carpeta, f"{i}.jpg"), quality=86, optimize=True, progressive=True)
    print(f"fondos: {len(FONDOS)}")


def dolm():
    im = Image.open(os.path.join(ORIG, "dolm-saludo.png")).convert("RGBA")
    im = im.crop(im.getbbox())
    im.thumbnail((900, 900), Image.LANCZOS)
    im.save(os.path.join(IMG, "dolm.png"), optimize=True)
    print("dolm:", im.size)


def ojo_o(tam, con_fondo):
    """La 'O' de Ruslan Display en amarillo con la luz del ojo dentro del hueco."""
    lienzo = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    if con_fondo:
        fondo = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
        d = ImageDraw.Draw(fondo)
        r = tam // 5
        d.rounded_rectangle((0, 0, tam - 1, tam - 1), radius=r, fill=OSCURO + (255,))
        grosor = max(2, tam // 48)
        m = grosor * 2
        d.rounded_rectangle((m, m, tam - 1 - m, tam - 1 - m), radius=r - m, outline=ROJO + (255,), width=grosor)
        lienzo.alpha_composite(fondo)

    fuente = ImageFont.truetype(os.path.join(FUENTES, "RuslanDisplay-Regular.ttf"), int(tam * 0.9))
    capa = Image.new("L", (tam * 2, tam * 2), 0)
    ImageDraw.Draw(capa).text((tam // 2, tam // 2), "O", font=fuente, fill=255)
    caja = capa.getbbox()
    letra = capa.crop(caja)
    objetivo = int(tam * (0.62 if con_fondo else 0.9))
    escala = objetivo / max(letra.size)
    letra = letra.resize((max(1, int(letra.width * escala)), max(1, int(letra.height * escala))), Image.LANCZOS)
    ox = (tam - letra.width) // 2
    oy = (tam - letra.height) // 2

    # Hueco interior de la O: relleno por inundación desde el centro de la letra
    hueco = Image.new("L", letra.size, 0)
    binaria = letra.point(lambda v: 255 if v > 128 else 0)
    semilla = (letra.width // 2, letra.height // 2)
    marca = binaria.copy().convert("RGB")
    ImageDraw.floodfill(marca, semilla, (255, 0, 0), thresh=10)
    px = marca.load()
    hp = hueco.load()
    for y in range(letra.height):
        for x in range(letra.width):
            if px[x, y] == (255, 0, 0):
                hp[x, y] = 255
    hueco = hueco.filter(ImageFilter.GaussianBlur(max(1, tam // 160)))

    # Luz del ojo: degradado radial dentro del hueco
    luz = Image.new("RGBA", letra.size, (0, 0, 0, 0))
    lp = luz.load()
    cx, cy = letra.width / 2, letra.height / 2
    rmax = max(letra.size) / 2
    for y in range(letra.height):
        for x in range(letra.width):
            t = min(1.0, math.hypot(x - cx, y - cy) / (rmax * 0.55))
            c = tuple(int(LUZ_OJO[i] * (1 - t) + AMARILLO[i] * 0.35 * t + OSCURO[i] * 0.65 * t) for i in range(3))
            lp[x, y] = c + (255,)
    luz.putalpha(hueco)

    # Resplandor alrededor de la O
    halo = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    halo_mask = Image.new("L", (tam, tam), 0)
    halo_mask.paste(letra, (ox, oy))
    halo_mask = halo_mask.filter(ImageFilter.GaussianBlur(tam // 28))
    halo.paste(AMARILLO + (110,), (0, 0), halo_mask)
    lienzo.alpha_composite(halo)

    lienzo.alpha_composite(luz, (ox, oy))
    color = Image.new("RGBA", letra.size, AMARILLO + (255,))
    color.putalpha(letra)
    lienzo.alpha_composite(color, (ox, oy))
    return lienzo


def anillo_texto(tam):
    """Texto en círculo que gira alrededor del sello en la pantalla de carga."""
    texto = "DOLMYR  ·  NADIE TE ESPERA EN EL YERMO  ·  "
    fuente = ImageFont.truetype(os.path.join(FUENTES, "KellySlab-Regular.ttf"), int(tam * 0.06))
    lienzo = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    radio = tam * 0.42
    circ = 2 * math.pi * radio
    anchos = [fuente.getlength(c) for c in texto]
    total = sum(anchos)
    texto = texto * max(1, int(circ // total))
    anchos = [fuente.getlength(c) for c in texto]
    paso = circ / sum(anchos)
    angulo = -math.pi / 2
    for c, a in zip(texto, anchos):
        ang_c = angulo + (a * paso / 2) / radio
        letra = Image.new("RGBA", (int(tam * 0.1), int(tam * 0.1)), (0, 0, 0, 0))
        ImageDraw.Draw(letra).text((letra.width / 2, letra.height / 2), c, font=fuente, fill=HUESO + (230,), anchor="mm")
        letra = letra.rotate(-math.degrees(ang_c) - 90, resample=Image.BICUBIC)
        x = tam / 2 + radio * math.cos(ang_c) - letra.width / 2
        y = tam / 2 + radio * math.sin(ang_c) - letra.height / 2
        lienzo.alpha_composite(letra, (int(x), int(y)))
        angulo += a * paso / radio
    return lienzo


def iconos():
    icono = ojo_o(1024, con_fondo=True)
    icono.save(os.path.join(RAIZ, "build", "icon.png"))
    icono.resize((512, 512), Image.LANCZOS).save(os.path.join(IMG, "SealCircle.png"))
    icono.save(os.path.join(IMG, "SealCircle.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    ojo_o(512, con_fondo=False).save(os.path.join(IMG, "LoadingSeal.png"))
    anillo_texto(1024).resize((512, 512), Image.LANCZOS).save(os.path.join(IMG, "LoadingText.png"))
    print("iconos y sellos listos")


if __name__ == "__main__":
    fondos()
    dolm()
    iconos()
