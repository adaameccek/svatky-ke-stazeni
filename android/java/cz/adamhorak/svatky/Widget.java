package cz.adamhorak.svatky;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Widget 1x1 bez pozadí: drobné „Dnes má svátek" a pod tím jméno na jednom řádku, ve svátek „Dnes je"
 * a název dne. Texty bere z plánu. Kreslí se do obrázku patkovým písmem appky (res/font/patka.ttf),
 * protože Samsung písmo TextView ve widgetu přepisuje systémovým.
 */
public class Widget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, pohled(ctx, m, id));
        Budik.naplanuj(ctx);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager m, int id, Bundle o) {
        m.updateAppWidget(id, pohled(ctx, m, id));
    }

    /** Překreslí všechny widgety na ploše. */
    static void obnov(Context ctx) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(ctx);
            for (int id : m.getAppWidgetIds(new ComponentName(ctx, Widget.class))) m.updateAppWidget(id, pohled(ctx, m, id));
        } catch (Exception e) { /* launcher bez widgetů */ }
    }

    private static RemoteViews pohled(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget);
        JSONObject d = Plan.nacti(ctx).den(Plan.dnes());
        String a = "Svátky", b = "Otevři appku";
        if (d != null) {
            a = d.optString("a", "Dnes má svátek");
            b = d.optString("b", "");
            if (b.isEmpty()) { a = "Dnes"; b = "nikdo"; }
        }
        // velikost buňky na ploše (na výšku: nejmenší šířka x největší výška)
        int sirka = 76, vyska = 76;
        try {
            Bundle o = m.getAppWidgetOptions(id);
            int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH), h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);
            if (w > 30) sirka = Math.min(w, 400);
            if (h > 30) vyska = Math.min(h, 400);
        } catch (Exception e) { /* launcher velikost neřekl */ }
        v.setImageViewBitmap(R.id.obr, kresli(ctx, a.trim(), b.trim(), sirka, vyska));
        v.setContentDescription(R.id.obr, a + " " + b);
        Intent i = new Intent(ctx, Hlavni.class).putExtra("dnes", true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.koren, PendingIntent.getActivity(ctx, 10, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    /** Zmenšuje písmo, dokud se text nevejde na šířku. */
    private static void vejdi(Paint p, String s, float nej, float min, float sirka) {
        p.setTextSize(nej);
        float w = p.measureText(s);
        if (w > sirka) p.setTextSize(Math.max(min, nej * sirka / w));
    }

    private static Bitmap kresli(Context ctx, String a, String b, int sirkaDp, int vyskaDp) {
        float dp = ctx.getResources().getDisplayMetrics().density;
        // velký widget: obrázek nesmí být obří (jde přes hranici procesů), launcher si ho dotáhne
        if (sirkaDp * dp * vyskaDp * dp > 700000f) dp = (float) Math.sqrt(700000f / (sirkaDp * (float) vyskaDp));
        int w = Math.round(sirkaDp * dp), h = Math.round(vyskaDp * dp);
        // písmo roste s widgetem: 1 = buňka 1x1, širší nebo vyšší widget ho zvětší
        float k = Math.max(1f, Math.min(4f, Math.min(sirkaDp / 76f, vyskaDp / 76f * 1.25f)));
        dp *= k;
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Typeface pismo;
        try { pismo = ctx.getResources().getFont(R.font.patka); } catch (Exception e) { pismo = Typeface.create(Typeface.SERIF, Typeface.BOLD); }
        float misto = w - 4 * dp / k;

        Paint pa = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        pa.setTypeface(pismo); pa.setColor(0xE6FFFFFF); pa.setTextAlign(Paint.Align.CENTER);
        pa.setShadowLayer(3 * dp, 0, dp, 0xB0000000);
        vejdi(pa, a, 10.5f * dp, 6 * dp, misto);

        Paint pb = new Paint(pa);
        pb.setColor(0xFFFFFFFF);
        // jméno vždy na jeden řádek; jen víceslovný název svátku, který by byl moc drobný, jde na dva
        String[] radky = {b};
        vejdi(pb, b, 19 * dp, 7 * dp, misto);
        if (b.contains(" ") && pb.getTextSize() < 13 * dp) {
            int pul = b.length() / 2, rez = -1;
            for (int i = 0; i < b.length(); i++) if (b.charAt(i) == ' ' && (rez < 0 || Math.abs(i - pul) < Math.abs(rez - pul))) rez = i;
            radky = new String[]{b.substring(0, rez), b.substring(rez + 1)};
            String delsi = pb.measureText(radky[0]) > pb.measureText(radky[1]) ? radky[0] : radky[1];
            vejdi(pb, delsi, 16 * dp, 7 * dp, misto);
        }

        // zlatý řez: volné místo nad textem : pod textem = 0,382 : 0,618 (stará appka to má podobně),
        // mezi popiskem a jménem vzduch; nic nesmí přetéct přes horní okraj
        float va = pa.getTextSize(), vb = pb.getTextSize(), mezera = 7 * dp, radek = vb * 1.12f;
        float celek = va + mezera + vb + (radky.length - 1) * radek;
        float y = Math.max(3 * dp / k, (h - celek) * 0.382f) + va * 0.9f;
        c.drawText(a, w / 2f, y, pa);
        y += mezera + vb * 0.95f;
        for (String r : radky) { c.drawText(r, w / 2f, y, pb); y += radek; }
        return bmp;
    }
}
