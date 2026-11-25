package com.digitxbd.hishab;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** Quick Settings tile in the Android notification shade that opens Hishab Quick Entry. */
public final class QuickTileService extends TileService {
    @Override
    public void onStartListening() {
        Tile tile = getQsTile();
        if (tile == null) return;
        tile.setState(Tile.STATE_INACTIVE);
        tile.setLabel(getString(R.string.tile_quick_add));
        if (Build.VERSION.SDK_INT >= 29) {
            tile.setSubtitle(getString(R.string.tile_subtitle));
        }
        tile.updateTile();
    }

    @Override
    public void onClick() {
        unlockAndRun(this::openQuickEntry);
    }

    @SuppressWarnings("deprecation")
    private void openQuickEntry() {
        Intent intent = new Intent(this, MainActivity.class)
                .setAction("com.digitxbd.hishab.ACTION_QS_ADD")
                .putExtra("hishab_action", "add")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (Build.VERSION.SDK_INT >= 34) {
            PendingIntent pending = PendingIntent.getActivity(
                    this,
                    1001,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            startActivityAndCollapse(pending);
        } else {
            startActivityAndCollapse(intent);
        }
    }
}
