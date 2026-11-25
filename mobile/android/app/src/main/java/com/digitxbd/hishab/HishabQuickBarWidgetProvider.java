package com.digitxbd.hishab;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** Compact Hishab Quick Bar Home Screen widget for 1-tap entry and SMS parsing. */
public final class HishabQuickBarWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        WidgetStore.refreshQuickBar(context, appWidgetManager, appWidgetIds);
    }
}
