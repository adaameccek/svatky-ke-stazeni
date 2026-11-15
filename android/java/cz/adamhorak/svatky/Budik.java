package cz.adamhorak.svatky;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

import java.util.Calendar;

/**
 * Dva budíky: o půlnoci překreslit widget, ráno poslat oznámení. Po restartu telefonu,
 * změně času a aktualizaci appky se nastaví znovu (systém je jinak zapomene).
 */
public class Budik extends BroadcastReceiver {
    static final String PULNOC = "cz.adamhorak.svatky.PULNOC";
    static final String OZNAMENI = "cz.adamhorak.svatky.OZNAMENI";
    private static final String KANAL = "svatky";

    @Override
    public void onReceive(Context ctx, Intent i) {
        Widget.obnov(ctx);
        // po restartu nebo posunu času dohnat oznámení, které mezitím propadlo
        oznam(ctx, !OZNAMENI.equals(i.getAction()));
        naplanuj(ctx);
    }

    private static PendingIntent zamer(Context ctx, String akce, int kod) {
        Intent i = new Intent(ctx, Budik.class).setAction(akce);
        return PendingIntent.getBroadcast(ctx, kod, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void nastav(AlarmManager am, PendingIntent pi, long kdy) {
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, kdy, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, kdy, pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, kdy, pi);
        }
    }

    static void naplanuj(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar pul = Calendar.getInstance();
        pul.add(Calendar.DAY_OF_MONTH, 1);
        pul.set(Calendar.HOUR_OF_DAY, 0); pul.set(Calendar.MINUTE, 0); pul.set(Calendar.SECOND, 5); pul.set(Calendar.MILLISECOND, 0);
        nastav(am, zamer(ctx, PULNOC, 1), pul.getTimeInMillis());

        Plan p = Plan.nacti(ctx);
        PendingIntent ranni = zamer(ctx, OZNAMENI, 2);
        am.cancel(ranni);
        if (!p.zap) return;
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, p.hodina); c.set(Calendar.MINUTE, p.minuta); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= System.currentTimeMillis()) c.add(Calendar.DAY_OF_MONTH, 1);
        nastav(am, ranni, c.getTimeInMillis());
    }

    /** Pošle dnešní oznámení, pokud na dnešek nějaké je a ještě neodešlo. */
    private static void oznam(Context ctx, boolean dohnat) {
        Plan p = Plan.nacti(ctx);
        if (!p.zap) return;
        String dnes = Plan.dnes();
        android.content.SharedPreferences pr = ctx.getSharedPreferences("budik", Context.MODE_PRIVATE);
        if (dnes.equals(pr.getString("poslano", ""))) return;
        Calendar ted = Calendar.getInstance();
        int minut = ted.get(Calendar.HOUR_OF_DAY) * 60 + ted.get(Calendar.MINUTE);
        if (dohnat && (minut < p.hodina * 60 + p.minuta || minut >= 21 * 60)) return;
        if (!dohnat && minut + 2 < p.hodina * 60 + p.minuta) return;
        pr.edit().putString("poslano", dnes).apply();
        JSONObject d = p.den(dnes);
        if (d == null || !d.has("t")) return;

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || !nm.areNotificationsEnabled()) return;
        NotificationChannel k = new NotificationChannel(KANAL, "Svátky a významné dny", NotificationManager.IMPORTANCE_DEFAULT);
        k.setDescription("Ranní oznámení, kdo má svátek a co je za den");
        nm.createNotificationChannel(k);
        String titul = d.optString("t"), text = d.optString("x", "");
        Intent i = new Intent(ctx, Hlavni.class).putExtra("dnes", true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Notification.Builder b = new Notification.Builder(ctx, KANAL)
                .setSmallIcon(R.drawable.ic_stat)
                .setColor(ctx.getColor(R.color.cervena))
                .setContentTitle(titul)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_EVENT)
                .setContentIntent(PendingIntent.getActivity(ctx, 11, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        if (!text.isEmpty()) b.setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text));
        nm.notify(1, b.build());
    }
}
