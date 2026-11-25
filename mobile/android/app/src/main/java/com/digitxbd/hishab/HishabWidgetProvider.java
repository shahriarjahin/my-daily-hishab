package com.digitxbd.hishab;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** 4x2 Hishab Home Screen widget showing balance, today's spending, and quick actions. */
public final class HishabWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        WidgetStore.refreshSummary(context, appWidgetManager, appWidgetIds);
    }
}
