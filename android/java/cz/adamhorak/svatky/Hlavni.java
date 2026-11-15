package cz.adamhorak.svatky;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.provider.ContactsContract.CommonDataKinds.Event;
import android.provider.ContactsContract.CommonDataKinds.Phone;
import android.provider.ContactsContract.CommonDataKinds.StructuredName;
import android.provider.ContactsContract.Data;
import android.provider.ContactsContract.RawContacts;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Jediná obrazovka: WebView s rozhraním z assets/www. Kalendář, hledání i horoskop počítá JavaScript,
 * tady je jen to, co prohlížeč neumí: kontakty, volání, SMS, widget a oznámení (most „Android").
 */
public class Hlavni extends Activity {
    private static final String ADRESA = "file:///android_asset/www/index.html";
    private static final int ZADOST_KONTAKTY = 1, ZADOST_OZNAMENI = 2, ZADOST_ZAPIS = 3;
    private static final Pattern DATUM = Pattern.compile("(\\d{4}|-)-(\\d{2})-(\\d{2})");

    private WebView web;
    private boolean nacteno, naDnesek;
    private String zapisId, zapisDen;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.pozadi));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        s.setAllowFileAccess(true);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Most(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                if (r.getUrl().toString().startsWith("file:///android_asset/")) return false;
                otevriVen(r.getUrl().toString());
                return true;
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                nacteno = true;
                if (naDnesek) { naDnesek = false; js("window.naDnesek&&window.naDnesek()"); }
            }
        });
        setContentView(web);
        web.loadUrl(ADRESA);

        Budik.naplanuj(this);
        Widget.obnov(this);
        // o oznámení si říct jednou, hned napoprvé: bez nich by ranní připomínka nikdy nepřišla
        if (Build.VERSION.SDK_INT >= 33 && !getPreferences(MODE_PRIVATE).getBoolean("ptalSe", false)
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("ptalSe", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, ZADOST_OZNAMENI);
        }
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i.getBooleanExtra("dnes", false)) {
            if (nacteno) js("window.naDnesek&&window.naDnesek()"); else naDnesek = true;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        Widget.obnov(this);
    }

    @Override
    public void onBackPressed() {
        if (!nacteno) { super.onBackPressed(); return; }
        web.evaluateJavascript("(window.zpet&&window.zpet())===true", v -> { if (!"true".equals(v)) finish(); });
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("Android"); web.destroy(); }
        super.onDestroy();
    }

    private void js(String kod) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(kod, null); });
    }

    private boolean ma(String opravneni) {
        return checkSelfPermission(opravneni) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int kod, String[] co, int[] vysledek) {
        boolean ok = vysledek.length > 0 && vysledek[0] == PackageManager.PERMISSION_GRANTED;
        if (kod == ZADOST_KONTAKTY) js("window.poPovoleni('kontakty'," + ok + ")");
        else if (kod == ZADOST_OZNAMENI) js("window.poPovoleni&&window.poPovoleni('oznameni'," + ok + ")");
        else if (kod == ZADOST_ZAPIS) {
            if (ok && zapisId != null) zapis(zapisId, zapisDen); else js("window.poPovoleni('zapis',false)");
            zapisId = null;
        }
    }

    /** Odkaz ven: napřed appka, které patří (WhatsApp, Facebook, Instagram), jinak cokoli, co ho umí otevřít. */
    private void otevriVen(String url) {
        Uri u = Uri.parse(url);
        String host = u.getHost() == null ? "" : u.getHost();
        String balik = host.endsWith("wa.me") ? "com.whatsapp" : host.endsWith("m.me") ? "com.facebook.orca"
                : host.endsWith("t.me") ? "org.telegram.messenger" : host.endsWith("facebook.com") ? "com.facebook.katana"
                : host.endsWith("instagram.com") ? "com.instagram.android" : null;
        if (balik != null) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, u).setPackage(balik)); return; } catch (Exception e) { /* appka není */ }
        }
        spust(new Intent(Intent.ACTION_VIEW, u));
    }

    private void spust(Intent i) {
        try { startActivity(i); } catch (Exception e) { Toast.makeText(this, "V telefonu na to není žádná appka", Toast.LENGTH_SHORT).show(); }
    }

    // ---------- kontakty ----------
    private static final String WEB = "vnd.android.cursor.item/website";
    private static final String SIT_WA = "vnd.android.cursor.item/vnd.com.whatsapp.profile";
    private static final String SIT_MS = "vnd.android.cursor.item/com.facebook.messenger.chat";
    private static final String SIT_TG = "vnd.android.cursor.item/vnd.org.telegram.messenger.android.profile";
    private static final String SIT_SG = "vnd.android.cursor.item/vnd.org.thoughtcrime.securesms.contact";

    /** Otevře chat s člověkem v appce, která si k němu do kontaktů zapsala svůj řádek. */
    private void otevriChat(String kde, long radek) {
        String typ = "wa".equals(kde) ? SIT_WA : "ms".equals(kde) ? SIT_MS : "tg".equals(kde) ? SIT_TG : SIT_SG;
        spust(new Intent(Intent.ACTION_VIEW).setDataAndType(android.content.ContentUris.withAppendedId(Data.CONTENT_URI, radek), typ));
    }

    private static String datum(String s) {
        if (s == null) return null;
        Matcher m = DATUM.matcher(s);
        if (!m.find()) return null;
        return ("-".equals(m.group(1)) ? "-" : m.group(1)) + "-" + m.group(2) + "-" + m.group(3);
    }

    private String nactiKontakty() throws Exception {
        Map<Long, JSONObject> lide = new LinkedHashMap<>();
        String[] sloupce = {Data.CONTACT_ID, Data.DISPLAY_NAME, Data.MIMETYPE, Data.DATA1, Data.DATA2, Data.DATA3, Data._ID, Data.PHOTO_THUMBNAIL_URI};
        String[] typy = {StructuredName.CONTENT_ITEM_TYPE, Phone.CONTENT_ITEM_TYPE, Event.CONTENT_ITEM_TYPE, WEB, SIT_WA, SIT_MS, SIT_TG, SIT_SG};
        try (Cursor c = getContentResolver().query(Data.CONTENT_URI, sloupce, Data.MIMETYPE + " IN (?,?,?,?,?,?,?,?)", typy, Data.DISPLAY_NAME)) {
            while (c != null && c.moveToNext()) {
                String jmeno = c.getString(1);
                if (jmeno == null || jmeno.trim().isEmpty()) continue;
                long id = c.getLong(0);
                JSONObject o = lide.get(id);
                if (o == null) {
                    o = new JSONObject().put("id", String.valueOf(id)).put("jmeno", jmeno.trim()).put("krestni", "").put("tel", new JSONArray());
                    lide.put(id, o);
                }
                if (!o.has("foto") && c.getString(7) != null) o.put("foto", c.getString(7));
                String typ = c.getString(2), d1 = c.getString(3);
                if (StructuredName.CONTENT_ITEM_TYPE.equals(typ)) {
                    String krestni = c.getString(4);
                    if (krestni != null && o.optString("krestni").isEmpty()) o.put("krestni", krestni.trim());
                } else if (Phone.CONTENT_ITEM_TYPE.equals(typ)) {
                    if (d1 == null) continue;
                    JSONArray tel = o.getJSONArray("tel");
                    String cisty = konec(d1);
                    boolean je = false;
                    for (int i = 0; i < tel.length(); i++) if (konec(tel.getString(i)).equals(cisty)) je = true;
                    if (!je) tel.put(d1);
                } else if (WEB.equals(typ)) {
                    // odkaz na profil uložený u kontaktu (pole Web)
                    if (d1 == null) continue;
                    String w = d1.toLowerCase(Locale.ROOT);
                    if (w.contains("instagram.com/") && !o.has("ig")) o.put("ig", d1.trim());
                    else if ((w.contains("facebook.com/") || w.contains("fb.com/") || w.contains("m.me/")) && !o.has("fb")) o.put("fb", d1.trim());
                } else if (SIT_WA.equals(typ) || SIT_MS.equals(typ) || SIT_TG.equals(typ) || SIT_SG.equals(typ)) {
                    // řádek, který si do kontaktu zapsala sama appka: jde otevřít rovnou jako chat s tím člověkem
                    String kde = SIT_WA.equals(typ) ? "wa" : SIT_MS.equals(typ) ? "ms" : SIT_TG.equals(typ) ? "tg" : "sg";
                    JSONObject s = o.optJSONObject("site");
                    if (s == null) { s = new JSONObject(); o.put("site", s); }
                    if (!s.has(kde)) s.put(kde, c.getLong(6));
                } else {
                    String den = datum(d1);
                    if (den == null) continue;
                    String popis = c.getString(5);
                    if (c.getInt(4) == Event.TYPE_BIRTHDAY) o.put("nar", den);
                    else if (popis != null && popis.toLowerCase(Locale.ROOT).matches(".*(sv[aá]tek|jmenin|name ?day).*")) o.put("svatek", den.substring(den.length() - 5));
                }
            }
        }
        return new JSONArray(lide.values()).toString();
    }

    private static byte[] cti(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192]; int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }

    /** Posledních 9 číslic: +420 601… a 601… je totéž číslo. */
    private static String konec(String tel) {
        String c = tel.replaceAll("[^0-9]", "");
        return c.length() > 9 ? c.substring(c.length() - 9) : c;
    }

    /** Zapíše svátek do kontaktu jako vlastní událost „Svátek"; telefon ho pak ukáže i ve svém kalendáři. */
    private void zapis(String kontaktId, String den) {
        new Thread(() -> {
            boolean ok = false;
            try {
                long raw = -1; int nej = -1;
                String[] sl = {RawContacts._ID, RawContacts.ACCOUNT_TYPE};
                try (Cursor c = getContentResolver().query(RawContacts.CONTENT_URI, sl,
                        RawContacts.CONTACT_ID + "=? AND " + RawContacts.DELETED + "=0", new String[]{kontaktId}, null)) {
                    while (c != null && c.moveToNext()) {
                        String ucet = c.getString(1) == null ? "" : c.getString(1);
                        // kontakt se skládá z víc záznamů (Google, telefon, WhatsApp…); psát se dá jen do prvních dvou
                        int body = ucet.equals("com.google") ? 3 : ucet.isEmpty() || ucet.contains("samsung") || ucet.contains("phone") || ucet.contains("local") ? 2
                                : ucet.contains("whatsapp") || ucet.contains("facebook") || ucet.contains("telegram") || ucet.contains("viber") || ucet.contains("signal") ? 0 : 1;
                        if (body > nej) { nej = body; raw = c.getLong(0); }
                    }
                }
                if (raw >= 0 && den != null && den.matches("\\d\\d-\\d\\d")) {
                    ContentValues v = new ContentValues();
                    v.put(Data.RAW_CONTACT_ID, raw);
                    v.put(Data.MIMETYPE, Event.CONTENT_ITEM_TYPE);
                    v.put(Event.START_DATE, "--" + den);
                    v.put(Event.TYPE, Event.TYPE_CUSTOM);
                    v.put(Event.LABEL, "Svátek");
                    ok = getContentResolver().insert(Data.CONTENT_URI, v) != null;
                }
            } catch (Exception e) { ok = false; }
            js("window.poPovoleni('zapis'," + ok + ")");
            if (ok) posliKontakty();
        }).start();
    }

    private void posliKontakty() {
        new Thread(() -> {
            String json;
            try { json = nactiKontakty(); } catch (Exception e) { json = "[]"; }
            js("window.poKontaktech(" + JSONObject.quote(json) + ")");
        }).start();
    }

    // ---------- most pro JavaScript ----------
    private class Most {
        @JavascriptInterface public boolean maKontakty() { return ma(Manifest.permission.READ_CONTACTS); }

        @JavascriptInterface public void zadejKontakty() {
            runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, ZADOST_KONTAKTY));
        }

        @JavascriptInterface public void nactiKontakty() {
            if (ma(Manifest.permission.READ_CONTACTS)) posliKontakty();
        }

        @JavascriptInterface public void otevri(String url) { runOnUiThread(() -> otevriVen(url)); }

        @JavascriptInterface public void otevriChat(String kde, String radek) {
            runOnUiThread(() -> { try { Hlavni.this.otevriChat(kde, Long.parseLong(radek)); } catch (NumberFormatException e) { /* špatné číslo řádku */ } });
        }

        @JavascriptInterface public void volat(String tel) {
            runOnUiThread(() -> spust(new Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", tel, null))));
        }

        @JavascriptInterface public void sms(String tel, String text) {
            runOnUiThread(() -> spust(new Intent(Intent.ACTION_SENDTO, Uri.fromParts("smsto", tel, null)).putExtra("sms_body", text)));
        }

        @JavascriptInterface public void otevriKontakt(String id) {
            runOnUiThread(() -> spust(new Intent(Intent.ACTION_VIEW, Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_URI, id))));
        }

        @JavascriptInterface public void zapisSvatek(String id, String den) {
            runOnUiThread(() -> {
                if (ma(Manifest.permission.WRITE_CONTACTS)) zapis(id, den);
                else { zapisId = id; zapisDen = den; requestPermissions(new String[]{Manifest.permission.WRITE_CONTACTS}, ZADOST_ZAPIS); }
            });
        }

        @JavascriptInterface public void ulozPlan(String json) {
            Plan.uloz(Hlavni.this, json);
            Widget.obnov(Hlavni.this);
            Budik.naplanuj(Hlavni.this);
        }

        @JavascriptInterface public boolean maOznameni() {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            return nm != null && nm.areNotificationsEnabled();
        }

        @JavascriptInterface public void zadejOznameni() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && !ma(Manifest.permission.POST_NOTIFICATIONS)
                        && shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, ZADOST_OZNAMENI);
                } else {
                    // už jednou odmítnuto (nebo starší Android): zbývá nastavení appky
                    spust(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName()));
                }
            });
        }

        @JavascriptInterface public void pridejWidget() {
            runOnUiThread(() -> {
                AppWidgetManager m = AppWidgetManager.getInstance(Hlavni.this);
                if (m.isRequestPinAppWidgetSupported()) m.requestPinAppWidget(new ComponentName(Hlavni.this, Widget.class), null, null);
                else Toast.makeText(Hlavni.this, "Podrž prst na ploše a vyber Widgety, pak Svátky", Toast.LENGTH_LONG).show();
            });
        }

        /** Miniatura fotky kontaktu jako data: URL (WebView content:// sám neotevře). */
        @JavascriptInterface public String fotka(String uri) {
            if (!ma(Manifest.permission.READ_CONTACTS) || uri == null || !uri.startsWith("content://com.android.contacts/")) return "";
            try (InputStream in = getContentResolver().openInputStream(Uri.parse(uri))) {
                if (in == null) return "";
                byte[] b = cti(in);
                return "data:image/jpeg;base64," + android.util.Base64.encodeToString(b, android.util.Base64.NO_WRAP);
            } catch (Exception e) { return ""; }
        }

        /** Lidé ze sítí a loňská přání: soubor nahraný kabelem z PC (tools/lide_ze_siti.py), jen v telefonu. */
        @JavascriptInterface public String soukroma() {
            File f = new File(getExternalFilesDir(null), "lide.json");
            if (!f.exists()) return "";
            try (InputStream in = new FileInputStream(f)) { return new String(cti(in), StandardCharsets.UTF_8); }
            catch (Exception e) { return ""; }
        }

        @JavascriptInterface public void schranka(String text) {
            runOnUiThread(() -> {
                android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText("Přání", text));
            });
        }

        @JavascriptInterface public void sdilej(String text) {
            runOnUiThread(() -> spust(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), null)));
        }
    }
}
