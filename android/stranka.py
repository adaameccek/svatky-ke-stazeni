# -*- coding: utf-8 -*-
r"""
Veřejný web Svátků (https://svatky.adamhorak.cz): stránka ke stažení APK a webová verze appky.

    py -3.12 android\stranka.py          web do ..\web (stránka, APK, ikona, appka v /app)
    py -3.12 android\stranka.py --og     navíc znovu vyrobí náhled odkazu web\og.jpg (1200x630)

Vstupy: dist\svatky.apk (py build.py), stahnout.sablona.html, ikona.svg, rozhraní z ..\aplikace.
Webová verze je totéž rozhraní jako v APK, jen bez mostu do Androidu: místo kontaktů ukáže
vymyšlené lidi (UKAZKA v app.js), widget a oznámení nejdou.
Nasazení: složka ..\web jako Vercel projekt "svatky" (cd web && vercel deploy --prod --yes).
Po každém novém APK: build.py, tenhle skript, deploy.
"""
import hashlib
import io
import os
import re
import shutil
import subprocess
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

PROJ = os.path.dirname(os.path.abspath(__file__))     # ...\svatky\android
KOREN = os.path.dirname(PROJ)                          # ...\svatky
WEB = os.path.join(KOREN, "web")
APLIKACE = os.path.join(KOREN, "aplikace")
APK = os.path.join(PROJ, "dist", "svatky.apk")
IKONA = os.path.join(PROJ, "ikona.svg")
SABLONA = os.path.join(PROJ, "stahnout.sablona.html")
ADRESA = "https://svatky.adamhorak.cz/"
AAPT2 = os.path.join(os.environ["LOCALAPPDATA"], "Android", "Sdk", "build-tools", "35.0.0", "aapt2.exe")
BUILD = os.path.join(os.environ["LOCALAPPDATA"], "svatky-build")
ANDROID = "Android 8+"                                  # MIN_SDK 26 v build.py
SOUBORY_APP = ["index.html", "styl.css", "data.js", "astro.js", "hvezdy.js", "app.js", "cina.woff2"]

VERCEL = """{
  "cleanUrls": false,
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "X-Robots-Tag", "value": "noindex, nofollow" } ] },
    { "source": "/svatky.apk", "headers": [
      { "key": "Content-Type", "value": "application/vnd.android.package-archive" },
      { "key": "Content-Disposition", "value": "attachment; filename=\\"svatky.apk\\"" },
      { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" } ] },
    { "source": "/app/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" } ] },
    { "source": "/(index.html)?", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" } ] }
  ]
}
"""


def velikost_text(b):
    return "%d kB" % round(b / 1024) if b < 1024 * 1024 else ("%.1f MB" % (b / 1024 / 1024)).replace(".", ",")


def logo_svg():
    svg = io.open(IKONA, encoding="utf-8").read().strip()
    return svg.replace("<svg ", '<svg class="logo" aria-hidden="true" focusable="false" ', 1)


def qr_svg():
    """QR na stránku: 4 px na modul, viewBox kvůli škálování (segno ho sám nedá)."""
    import segno
    kod = segno.make(ADRESA, error="m")
    buf = io.BytesIO()
    kod.save(buf, kind="svg", scale=4, border=0, dark="#000", light="#fff",
             xmldecl=False, svgns=True, nl=False, svgclass="qr-kod")
    svg = buf.getvalue().decode("utf-8")
    m = re.search(r'width="(\d+)" height="(\d+)"', svg)
    return svg.replace(m.group(0), '%s viewBox="0 0 %s %s"' % (m.group(0), m.group(1), m.group(2)), 1)


def verze_apk():
    p = subprocess.run([AAPT2, "dump", "badging", APK], capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"versionCode='(\d+)' versionName='([^']*)'", p.stdout)
    if not m:
        sys.exit("CHYBA: z APK nejde přečíst verze\n" + p.stdout + p.stderr)
    return int(m.group(1)), m.group(2)


def appka(kod):
    """Rozhraní appky do web\\app; odkazy na skripty a styl s ?v=kód, ať prohlížeč nedrží starou verzi."""
    cil = os.path.join(WEB, "app")
    shutil.rmtree(cil, ignore_errors=True)
    os.makedirs(cil, exist_ok=True)   # OneDrive někdy nechá prázdnou složku
    for zbytek in os.listdir(cil):
        os.remove(os.path.join(cil, zbytek))
    for f in SOUBORY_APP:
        shutil.copy2(os.path.join(APLIKACE, f), os.path.join(cil, f))
    p = os.path.join(cil, "index.html")
    html = io.open(p, encoding="utf-8").read()
    html = re.sub(r'(src|href)="(\w+\.(?:js|css))"', lambda m: '%s="%s?v=%d"' % (m.group(1), m.group(2), kod), html)
    html = html.replace("<title>Svátky</title>", '<title>Svátky</title>\n<meta name="robots" content="noindex, nofollow">\n<link rel="icon" href="/icon.svg" type="image/svg+xml">\n'
                        '<link rel="manifest" href="/app/manifest.webmanifest">\n'
                        '<link rel="apple-touch-icon" href="/app/ikona-180.png">\n'
                        '<meta name="apple-mobile-web-app-capable" content="yes">\n'
                        '<meta name="mobile-web-app-capable" content="yes">\n'
                        '<meta name="apple-mobile-web-app-title" content="Svátky">\n'
                        '<meta name="apple-mobile-web-app-status-bar-style" content="default">')
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print("  web\\app: %d souborů appky" % len(SOUBORY_APP))


MANIFEST = """{
  "name": "Svátky",
  "short_name": "Svátky",
  "lang": "cs",
  "start_url": "/app/",
  "scope": "/app/",
  "display": "standalone",
  "background_color": "#F4EEE3",
  "theme_color": "#F4EEE3",
  "icons": [
    {"src": "/app/ikona-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
    {"src": "/app/ikona-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
  ]
}
"""


def ikony():
    """PNG ikony pro plochu iPhonu a manifest (180, 192, 512), vykreslené z ikona.svg.
    Čtverec bez zaoblení: iOS i Android si rohy zaoblí samy. Drží se v BUILD, kreslí se jen při změně svg."""
    os.makedirs(BUILD, exist_ok=True)
    svg = io.open(IKONA, encoding="utf-8").read().replace(' rx="16"', "")
    znak = hashlib.sha256(svg.encode("utf-8")).hexdigest()[:12]
    velikosti = (180, 192, 512)
    cesty = {v: os.path.join(BUILD, "ikona-%d-%s.png" % (v, znak)) for v in velikosti}
    if not all(os.path.exists(c) for c in cesty.values()):
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch(channel="msedge", headless=True)
            for v in velikosti:
                pg = b.new_page(viewport={"width": v, "height": v}, device_scale_factor=1)
                pg.set_content('<style>html,body{margin:0}svg{display:block;width:%dpx;height:%dpx}</style>%s' % (v, v, svg))
                pg.screenshot(path=cesty[v], clip={"x": 0, "y": 0, "width": v, "height": v})
                pg.close()
            b.close()
    cil = os.path.join(WEB, "app")
    for v in velikosti:
        shutil.copyfile(cesty[v], os.path.join(cil, "ikona-%d.png" % v))
    with io.open(os.path.join(cil, "manifest.webmanifest"), "w", encoding="utf-8", newline="\n") as f:
        f.write(MANIFEST)
    print("  web\\app: ikony pro plochu a manifest")


def og():
    """Náhled odkazu 1200x630: hlavní stránka vyfocená v headless Edge (webová appka v rámečku)."""
    from playwright.sync_api import sync_playwright
    from PIL import Image
    import http.server
    import threading
    import functools
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    os.makedirs(BUILD, exist_ok=True)
    png = os.path.join(BUILD, "og.png")
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="msedge", headless=True)
            pg = b.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1, color_scheme="light")
            pg.goto("http://127.0.0.1:%d/" % srv.server_address[1], wait_until="networkidle")
            pg.add_style_tag(content=".qr, .instalace, .meta, .naCelou { display: none !important; } main { padding-top: 24px !important; }")
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(800)
            pg.screenshot(path=png, clip={"x": 0, "y": 0, "width": 1200, "height": 630})
            b.close()
    finally:
        srv.shutdown()
    cil = os.path.join(WEB, "og.jpg")
    Image.open(png).convert("RGB").save(cil, "JPEG", quality=86, optimize=True, progressive=True)
    print("  web\\og.jpg  %s" % velikost_text(os.path.getsize(cil)))


def main():
    if not os.path.exists(APK):
        sys.exit("CHYBA: chybí dist\\svatky.apk, nejdřív py build.py")
    os.makedirs(WEB, exist_ok=True)
    data = open(APK, "rb").read()
    kod, nazev = verze_apk()
    shutil.copyfile(APK, os.path.join(WEB, "svatky.apk"))
    shutil.copyfile(IKONA, os.path.join(WEB, "icon.svg"))
    appka(kod)
    ikony()
    html = (io.open(SABLONA, encoding="utf-8").read()
            .replace("{{KOD}}", str(kod)).replace("{{VERZE}}", nazev.split(" ")[0])
            .replace("{{ANDROID}}", ANDROID).replace("{{VELIKOST}}", velikost_text(len(data)))
            .replace("{{LOGO}}", logo_svg()).replace("{{QR}}", qr_svg()))
    zbylo = re.findall(r"\{\{[A-Z_]+\}\}", html)
    if zbylo:
        sys.exit("CHYBA: v šabloně zůstalo %s" % ", ".join(sorted(set(zbylo))))
    with io.open(os.path.join(WEB, "index.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    with io.open(os.path.join(WEB, "vercel.json"), "w", encoding="utf-8", newline="\n") as f:
        f.write(VERCEL)
    with io.open(os.path.join(WEB, ".gitignore"), "w", encoding="utf-8", newline="\n") as f:
        f.write(".vercel\n")
    if "--og" in sys.argv or not os.path.exists(os.path.join(WEB, "og.jpg")):
        og()
    print("Web pro verzi %s (kód %d), APK %s, SHA-256 %s" % (nazev, kod, velikost_text(len(data)), hashlib.sha256(data).hexdigest()[:16]))


if __name__ == "__main__":
    main()
