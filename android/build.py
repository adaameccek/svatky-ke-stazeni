# -*- coding: utf-8 -*-
r"""
Sestaví appku Svátky bez Android Studia a Gradlu, jen nástroji z Android SDK.
Postup je převzatý z cifernik\android\build.py.

    py -3.12 build.py        APK do dist\svatky.apk

Kroky:
  1. rozhraní z ..\aplikace (index.html, styl.css, data.js, astro.js, hvezdy.js, app.js) -> assets/www v APK
  2. aapt2 compile/link -> javac -> d8 -> zipalign -> apksigner -> kontrola

Kalendář jmen (..\aplikace\data.js) se sestavuje zvlášť: py -3.12 ..\tools\data.py

Podpis: podpis\svatky.jks, heslo v C:\Users\info\.secrets\svatky-keystore.txt.
TÍMHLE KLÍČEM MUSÍ BÝT PODEPSANÁ KAŽDÁ DALŠÍ VERZE - jinak ji telefon nenainstaluje
přes starou a appka by se musela odinstalovat (a s ní oblíbení lidé a nastavení).
Klíč ani heslo nepatří do gitu. Mezivýsledky jdou mimo OneDrive do %LOCALAPPDATA%\svatky-build.
"""
import datetime
import hashlib
import io
import os
import secrets
import shutil
import subprocess
import sys
import zipfile

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

PROJ = os.path.dirname(os.path.abspath(__file__))
KOREN = os.path.dirname(PROJ)
APLIKACE = os.path.join(KOREN, "aplikace")         # rozhraní, přibalí se do APK

SDK = os.path.join(os.environ["LOCALAPPDATA"], "Android", "Sdk")
BT = os.path.join(SDK, "build-tools", "35.0.0")
ANDROID_JAR = os.path.join(SDK, "platforms", "android-35", "android.jar")
BUILD = os.path.join(os.environ["LOCALAPPDATA"], "svatky-build")

KEYSTORE = os.path.join(PROJ, "podpis", "svatky.jks")
HESLO = os.path.join(os.path.expanduser("~"), ".secrets", "svatky-keystore.txt")
ALIAS = "svatky"

MIN_SDK = 26
TARGET_SDK = 34
NAZEV_APK = "svatky.apk"
SOUBORY_ROZHRANI = ["index.html", "styl.css", "data.js", "astro.js", "hvezdy.js", "app.js", "cina.woff2"]


def krok(nazev):
    print("\n== " + nazev)


def spust(args, **kw):
    """Spustí nástroj; .bat přes cmd. Při chybě vypíše výstup a skončí."""
    if args[0].lower().endswith(".bat"):
        args = ["cmd", "/c"] + args
    p = subprocess.run(args, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", **kw)
    if p.returncode != 0:
        print(p.stdout)
        print(p.stderr)
        jmeno = os.path.basename(args[2] if args[0] == "cmd" else args[0])
        sys.exit("CHYBA: %s skončil kódem %d" % (jmeno, p.returncode))
    return p.stdout + p.stderr


def java_soubory(koren):
    out = []
    for d, _, soubory in os.walk(koren):
        out += [os.path.join(d, s) for s in soubory if s.endswith(".java")]
    return sorted(out)


def verze():
    ted = datetime.datetime.now()
    kod = (ted.date() - datetime.date(2026, 1, 1)).days * 1440 + ted.hour * 60 + ted.minute
    nazev = "%d.%d.%d %d:%02d" % (ted.day, ted.month, ted.year, ted.hour, ted.minute)
    return kod, nazev


def zajisti_podpis():
    if os.path.exists(KEYSTORE):
        if not os.path.exists(HESLO):
            sys.exit("CHYBA: podpisový klíč existuje, ale chybí heslo %s" % HESLO)
        return
    if os.path.exists(HESLO):
        sys.exit("CHYBA: heslo existuje, ale chybí klíč %s - nic nepřepisuju" % KEYSTORE)
    os.makedirs(os.path.dirname(HESLO), exist_ok=True)
    os.makedirs(os.path.dirname(KEYSTORE), exist_ok=True)
    with open(HESLO, "w", encoding="ascii") as f:
        f.write(secrets.token_urlsafe(24) + "\n")
    spust(["keytool", "-genkeypair", "-keystore", KEYSTORE, "-storetype", "PKCS12",
           "-alias", ALIAS, "-keyalg", "RSA", "-keysize", "3072", "-validity", "36500",
           "-dname", "CN=Adam Horak, O=adamhorak.cz, C=CZ",
           "-storepass:file", HESLO, "-keypass:file", HESLO])
    print("  vytvořen nový podpisový klíč (heslo v %s)" % HESLO)


def pribal_rozhrani(assets):
    """Rozhraní z ..\\aplikace do assets/www. Jediný zdroj je složka aplikace."""
    www = os.path.join(assets, "www")
    os.makedirs(www)
    for f in SOUBORY_ROZHRANI:
        zdroj = os.path.join(APLIKACE, f)
        if not os.path.exists(zdroj):
            sys.exit("CHYBA: chybí %s" % zdroj)
        shutil.copy2(zdroj, os.path.join(www, f))
    print("  %d souborů rozhraní" % len(SOUBORY_ROZHRANI))


def main():
    kod, nazev = verze()
    print("Svátky, verze %s (kód %d)" % (nazev, kod))
    for p in (BT, ANDROID_JAR):
        if not os.path.exists(p):
            sys.exit("CHYBA: chybí %s" % p)

    shutil.rmtree(BUILD, ignore_errors=True)
    for d in ("gen", "classes", "dex"):
        os.makedirs(os.path.join(BUILD, d))
    assets = os.path.join(BUILD, "assets")

    krok("rozhraní do assets")
    pribal_rozhrani(assets)

    krok("zdroje (aapt2)")
    res_zip = os.path.join(BUILD, "res.zip")
    zaklad = os.path.join(BUILD, "zaklad.apk")
    spust([os.path.join(BT, "aapt2.exe"), "compile", "--dir", os.path.join(PROJ, "res"),
           "-o", res_zip])
    spust([os.path.join(BT, "aapt2.exe"), "link", "-o", zaklad, "-I", ANDROID_JAR,
           "--manifest", os.path.join(PROJ, "AndroidManifest.xml"), "-R", res_zip,
           "-A", assets,
           "--java", os.path.join(BUILD, "gen"), "--auto-add-overlay",
           "--min-sdk-version", str(MIN_SDK), "--target-sdk-version", str(TARGET_SDK),
           "--version-code", str(kod), "--version-name", nazev])

    krok("kompilace (javac)")
    zdrojaky = java_soubory(os.path.join(PROJ, "java")) + java_soubory(os.path.join(BUILD, "gen"))
    # android.jar nemá LambdaMetafactory, kterou javac na lambdy potřebuje; d8 je pak přepíše
    lambda_stuby = os.path.join(BT, "core-lambda-stubs.jar")
    vystup = spust(["javac", "-encoding", "UTF-8", "-source", "8", "-target", "8",
                    "-Xlint:-options", "-Xlint:unchecked",
                    "-bootclasspath", ANDROID_JAR + os.pathsep + lambda_stuby,
                    "-d", os.path.join(BUILD, "classes")] + zdrojaky)
    if vystup.strip():
        print(vystup.strip())
    print("  %d souborů" % len(zdrojaky))

    krok("dex (d8)")
    classes_jar = os.path.join(BUILD, "classes.jar")
    spust(["jar", "cf", classes_jar, "-C", os.path.join(BUILD, "classes"), "."])
    spust([os.path.join(BT, "d8.bat"), "--release", "--min-api", str(MIN_SDK),
           "--lib", ANDROID_JAR, "--output", os.path.join(BUILD, "dex"), classes_jar])
    with zipfile.ZipFile(zaklad, "a", compression=zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(BUILD, "dex", "classes.dex"), "classes.dex")

    krok("zarovnání a podpis")
    zarovnano = os.path.join(BUILD, "zarovnano.apk")
    hotovo = os.path.join(BUILD, NAZEV_APK)
    spust([os.path.join(BT, "zipalign.exe"), "-p", "-f", "4", zaklad, zarovnano])
    zajisti_podpis()
    # jen --ks-pass: apksigner čte soubor s heslem po řádcích, druhé čtení téhož souboru
    # skončí na konci; heslo klíče se v PKCS12 bere stejné jako heslo úložiště
    spust([os.path.join(BT, "apksigner.bat"), "sign", "--ks", KEYSTORE,
           "--ks-key-alias", ALIAS, "--ks-pass", "file:" + HESLO,
           "--out", hotovo, zarovnano])

    krok("kontrola")
    podpis = spust([os.path.join(BT, "apksigner.bat"), "verify", "--verbose",
                    "--print-certs", hotovo])
    for radek in podpis.splitlines():
        if radek.startswith(("Verified using v2", "Verified using v3 ", "Signer #1 certificate DN")):
            print("  " + radek)
    if "Verifies" not in podpis:
        sys.exit("CHYBA: podpis neprošel")
    badging = spust([os.path.join(BT, "aapt2.exe"), "dump", "badging", hotovo])
    for radek in badging.splitlines():
        if radek.startswith(("package:", "application-label:", "launchable-activity")):
            print("  " + radek)
    with zipfile.ZipFile(hotovo) as z:
        v_apk = [n for n in z.namelist() if n.startswith("assets/www/")]
    if len(v_apk) != len(SOUBORY_ROZHRANI):
        sys.exit("CHYBA: v APK chybí rozhraní (%s)" % v_apk)
    print("  rozhraní v APK: " + ", ".join(n.split("/")[-1] for n in v_apk))

    krok("výstupy")
    data = open(hotovo, "rb").read()
    os.makedirs(os.path.join(PROJ, "dist"), exist_ok=True)
    shutil.copy2(hotovo, os.path.join(PROJ, "dist", NAZEV_APK))
    print("  dist\\%s  %d kB" % (NAZEV_APK, round(len(data) / 1024)))
    print("  SHA-256 %s" % hashlib.sha256(data).hexdigest())


main()
