package cz.adamhorak.svatky;

import android.content.Context;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import java.util.Locale;

/**
 * Plán na příští rok, který spočítalo rozhraní (app.js, ulozPlan): pro každý den text widgetu
 * a případné ranní oznámení. Widget a budík díky tomu nepotřebují kalendář jmen ani WebView.
 *
 * {"cas":"07:00","zap":true,"dny":{"2026-11-17":{"a":"Dnes je","b":"Den boje za svobodu","t":"…","x":"…"}}}
 */
final class Plan {
    final boolean zap;
    final int hodina, minuta;
    private final JSONObject dny;

    private Plan(JSONObject o) {
        boolean z = false; int h = 7, m = 0; JSONObject d = null;
        if (o != null) {
            z = o.optBoolean("zap", false);
            d = o.optJSONObject("dny");
            String[] c = o.optString("cas", "07:00").split(":");
            try { h = Integer.parseInt(c[0]); m = Integer.parseInt(c[1]); } catch (Exception e) { h = 7; m = 0; }
        }
        zap = z; hodina = h; minuta = m; dny = d;
    }

    /** Záznam dne nebo null. */
    JSONObject den(String iso) { return dny == null ? null : dny.optJSONObject(iso); }

    static String dnes() {
        Calendar c = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static File soubor(Context ctx) { return new File(ctx.getFilesDir(), "plan.json"); }

    static void uloz(Context ctx, String json) {
        try {
            new JSONObject(json);   // rozbitý plán neukládat
            File tmp = new File(ctx.getFilesDir(), "plan.tmp");
            try (FileOutputStream f = new FileOutputStream(tmp)) { f.write(json.getBytes(StandardCharsets.UTF_8)); }
            if (!tmp.renameTo(soubor(ctx))) { soubor(ctx).delete(); tmp.renameTo(soubor(ctx)); }
        } catch (Exception e) { /* zůstane starý plán */ }
    }

    static Plan nacti(Context ctx) {
        File s = soubor(ctx);
        if (!s.exists()) return new Plan(null);
        try (FileInputStream f = new FileInputStream(s)) {
            byte[] b = new byte[(int) s.length()];
            int n = 0;
            while (n < b.length) { int k = f.read(b, n, b.length - n); if (k < 0) break; n += k; }
            return new Plan(new JSONObject(new String(b, 0, n, StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return new Plan(null);
        }
    }
}
