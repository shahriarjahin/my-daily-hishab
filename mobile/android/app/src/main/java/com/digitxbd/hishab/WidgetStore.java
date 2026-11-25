package com.digitxbd.hishab;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.util.Locale;

/** Stores encrypted widget metrics and renders both Hishab Home Screen widgets. */
final class WidgetStore {
    private static final String PREF = "hishab_widget";
    private static final String KEY_SUMMARY = "summary";

    private WidgetStore() {}

    static void save(Context context, JSONObject summary) {
        try {
            Context app = context.getApplicationContext();
            SharedPreferences prefs = app.getSharedPreferences(PREF, Context.MODE_PRIVATE);
            String sealed = Runtime.get(app).store.vault.seal(summary.toString());
            prefs.edit().putString(KEY_SUMMARY, sealed).apply();
        } catch (Exception ignored) {
        }
        refreshAll(context);
    }

    static void clear(Context context) {
        try {
            Context app = context.getApplicationContext();
            app.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().remove(KEY_SUMMARY).apply();
        } catch (Exception ignored) {
        }
        refreshAll(context);
    }

    static JSONObject read(Context context) {
        try {
            Context app = context.getApplicationContext();
            String raw = app.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString(KEY_SUMMARY, null);
            if (raw != null && !raw.isEmpty()) {
                return new JSONObject(Runtime.get(app).store.vault.open(raw));
            }
        } catch (Exception ignored) {
        }
        return new JSONObject();
    }

    static void refreshAll(Context context) {
        Context app = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(app);
        int[] summaryIds = manager.getAppWidgetIds(new ComponentName(app, HishabWidgetProvider.class));
        if (summaryIds != null && summaryIds.length > 0) {
            refreshSummary(app, manager, summaryIds);
        }
        int[] barIds = manager.getAppWidgetIds(new ComponentName(app, HishabQuickBarWidgetProvider.class));
        if (barIds != null && barIds.length > 0) {
            refreshQuickBar(app, manager, barIds);
        }
    }

    static void refreshSummary(Context context, AppWidgetManager manager, int[] widgetIds) {
        JSONObject data = read(context);
        boolean signedIn = data.optBoolean("signed_in", false);
        for (int id : widgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_summary);
            views.setOnClickPendingIntent(R.id.widget_header, launchIntent(context, null, 200));
            views.setOnClickPendingIntent(R.id.widget_metrics, launchIntent(context, null, 200));
            views.setOnClickPendingIntent(R.id.widget_btn_add, launchIntent(context, "add", 201));
            views.setOnClickPendingIntent(R.id.widget_btn_sms, launchIntent(context, "sms", 202));
            views.setOnClickPendingIntent(R.id.widget_btn_transfer, launchIntent(context, "transfer", 203));

            views.setTextViewText(R.id.widget_btn_add, pick(data, "label_add", context.getString(R.string.widget_quick_add)));
            views.setTextViewText(R.id.widget_btn_sms, pick(data, "label_sms", context.getString(R.string.shortcut_sms_short)));
            views.setTextViewText(R.id.widget_btn_transfer, pick(data, "label_transfer", context.getString(R.string.shortcut_transfer_short)));

            if (signedIn) {
                views.setTextViewText(R.id.widget_balance_label, pick(data, "label_total", context.getString(R.string.widget_total_balance)));
                views.setTextViewText(R.id.widget_balance_value, pick(data, "total_balance", "--"));
                views.setTextViewText(R.id.widget_today_label, pick(data, "label_today", context.getString(R.string.widget_today)));
                views.setTextViewText(R.id.widget_today_value, pick(data, "today_spent", "--"));
                String topWallet = data.optString("top_wallet", "").trim();
                if (topWallet.isEmpty()) {
                    views.setViewVisibility(R.id.widget_top_wallet, View.GONE);
                } else {
                    views.setViewVisibility(R.id.widget_top_wallet, View.VISIBLE);
                    views.setTextViewText(R.id.widget_top_wallet, topWallet);
                }
            } else {
                views.setTextViewText(R.id.widget_balance_label, context.getString(R.string.widget_total_balance));
                views.setTextViewText(R.id.widget_balance_value, context.getString(R.string.widget_open_prompt));
                views.setTextViewText(R.id.widget_today_label, context.getString(R.string.widget_today));
                views.setTextViewText(R.id.widget_today_value, "--");
                views.setViewVisibility(R.id.widget_top_wallet, View.GONE);
            }
            manager.updateAppWidget(id, views);
        }
    }

    static void refreshQuickBar(Context context, AppWidgetManager manager, int[] widgetIds) {
        JSONObject data = read(context);
        boolean signedIn = data.optBoolean("signed_in", false);
        for (int id : widgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_bar);
            views.setOnClickPendingIntent(R.id.widget_bar_open, launchIntent(context, null, 210));
            views.setOnClickPendingIntent(R.id.widget_bar_add, launchIntent(context, "add", 211));
            views.setOnClickPendingIntent(R.id.widget_bar_sms, launchIntent(context, "sms", 212));

            views.setTextViewText(R.id.widget_bar_add, pick(data, "label_add", context.getString(R.string.widget_quick_add)));
            if (signedIn) {
                views.setTextViewText(R.id.widget_bar_label, pick(data, "label_today", context.getString(R.string.widget_today)));
                views.setTextViewText(R.id.widget_bar_value, pick(data, "today_spent", context.getString(R.string.widget_open_prompt)));
            } else {
                views.setTextViewText(R.id.widget_bar_label, context.getString(R.string.app_brand));
                views.setTextViewText(R.id.widget_bar_value, context.getString(R.string.widget_open_prompt));
            }
            manager.updateAppWidget(id, views);
        }
    }

    private static PendingIntent launchIntent(Context context, String action, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class)
                .setAction(action == null
                        ? Intent.ACTION_MAIN
                        : "com.digitxbd.hishab.WIDGET_" + action.toUpperCase(Locale.ROOT))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (action != null) {
            intent.putExtra("hishab_action", action);
        }
        return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static String pick(JSONObject data, String key, String fallback) {
        String value = data.optString(key, "").trim();
        return value.isEmpty() ? fallback : value;
    }
}
