# Génère les icônes PNG (soleil et lune) : python make_icons.py
from PIL import Image, ImageDraw
import math
def icon(size):
    S = 4 * size
    im = Image.new("RGB", (S, S), "#f3eee4"); d = ImageDraw.Draw(im)
    u = S / 100
    # soleil en haut à gauche
    cx, cy, r = 38*u, 38*u, 15*u
    for k in range(8):
        a = k * math.pi / 4
        d.line([(cx+math.cos(a)*21*u, cy+math.sin(a)*21*u), (cx+math.cos(a)*28*u, cy+math.sin(a)*28*u)], fill="#c47a1c", width=int(4.5*u))
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill="#f0b43c", outline="#c47a1c", width=int(3.5*u))
    # lune en bas à droite
    mx, my, mr = 64*u, 64*u, 21*u
    moon = Image.new("L", (S, S), 0); md = ImageDraw.Draw(moon)
    md.ellipse([mx-mr, my-mr, mx+mr, my+mr], fill=255)
    md.ellipse([mx-mr+13*u, my-mr-9*u, mx+mr+13*u, my+mr-9*u], fill=0)
    edge = Image.new("L", (S, S), 0); ed = ImageDraw.Draw(edge)
    ed.ellipse([mx-mr-3*u, my-mr-3*u, mx+mr+3*u, my+mr+3*u], fill=255)
    ed.ellipse([mx-mr+13*u+3*u, my-mr-9*u-3*u, mx+mr+13*u-3*u, my+mr-9*u+3*u], fill=0)
    im.paste("#34489e", (0, 0), edge); im.paste("#5b74d6", (0, 0), moon)
    return im.resize((size, size), Image.LANCZOS)
for s in (180, 192, 512): icon(s).save(f"icon-{s}.png")
