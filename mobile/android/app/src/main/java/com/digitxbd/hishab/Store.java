package com.digitxbd.hishab;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONObject;

/** Account-owned encrypted workspace snapshots; all revision transitions are transactional. */
final class Store extends SQLiteOpenHelper {
    final Vault vault = new Vault();
    Store(Context context) { super(context, "hishab.sqlite", null, 1); setWriteAheadLoggingEnabled(true); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE workspace(user_id TEXT PRIMARY KEY, body TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 0, conflict TEXT, remote_revision INTEGER, synced_at TEXT)");
        db.execSQL("CREATE TABLE recovery(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,body TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion) { throw new IllegalStateException("Unsupported database migration"); }
    synchronized JSONObject load(String user) throws Exception {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT body,revision,seq,dirty,conflict,remote_revision,synced_at FROM workspace WHERE user_id=?",new String[]{user})) {
            if (!c.moveToFirst()) return new JSONObject().put("exists",false);
            return new JSONObject().put("exists",true).put("workspace",new JSONObject(vault.open(c.getString(0))))
                .put("revision",c.getLong(1)).put("seq",c.getLong(2)).put("dirty",c.getInt(3)!=0)
                .put("conflict",!c.isNull(4)).put("remote_revision",c.isNull(5)?0:c.getLong(5)).put("synced_at",c.isNull(6)?JSONObject.NULL:c.getString(6));
        }
    }
    synchronized JSONObject save(String user, JSONObject body, long expected) throws Exception {
        SQLiteDatabase db=getWritableDatabase(); db.beginTransaction();
        try {
            JSONObject current=load(user);
            long sequence=current.optLong("seq",0);
            if(sequence!=expected) throw new IllegalStateException("Device records changed. Reload before saving.");
            ContentValues v=new ContentValues();v.put("body",vault.seal(body.toString()));v.put("seq",sequence+1);v.put("dirty",1);
            if(current.optBoolean("exists")) db.update("workspace",v,"user_id=?",new String[]{user});
            else {v.put("user_id",user);v.put("revision",0);db.insertOrThrow("workspace",null,v);}
            db.setTransactionSuccessful();return load(user);
        } finally {db.endTransaction();}
    }
    synchronized void pulled(String user,JSONObject body,long revision,long expectedSeq) throws Exception {
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try {
            JSONObject row=load(user);
            if(row.optBoolean("dirty")||row.optLong("seq")!=expectedSeq)return;
            ContentValues v=new ContentValues();v.put("user_id",user);v.put("body",vault.seal(body.toString()));v.put("revision",revision);v.put("seq",expectedSeq+1);v.put("dirty",0);v.putNull("conflict");v.putNull("remote_revision");v.put("synced_at",java.time.Instant.now().toString());
            db.insertWithOnConflict("workspace",null,v,SQLiteDatabase.CONFLICT_REPLACE);db.setTransactionSuccessful();
        }finally{db.endTransaction();}
    }
    synchronized void uploaded(String user,long seq,long revision) throws Exception {
        ContentValues v=new ContentValues();v.put("revision",revision);v.put("synced_at",java.time.Instant.now().toString());
        getWritableDatabase().update("workspace",v,"user_id=?",new String[]{user});
        v.clear();v.put("dirty",0);getWritableDatabase().update("workspace",v,"user_id=? AND seq=?",new String[]{user,Long.toString(seq)});
    }
    synchronized void conflict(String user,JSONObject remote,long revision) throws Exception {
        ContentValues v=new ContentValues();v.put("conflict",vault.seal(remote.toString()));v.put("remote_revision",revision);
        getWritableDatabase().update("workspace",v,"user_id=?",new String[]{user});
    }
    synchronized void resolve(String user,String choice) throws Exception {
        if(!choice.equals("device")&&!choice.equals("cloud"))throw new IllegalArgumentException("Choose a copy.");
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try(Cursor c=db.rawQuery("SELECT body,conflict,remote_revision,seq FROM workspace WHERE user_id=?",new String[]{user})){
            if(!c.moveToFirst()||c.isNull(1))throw new IllegalStateException("No sync conflict.");
            for(int i=0;i<2;i++){ContentValues backup=new ContentValues();backup.put("user_id",user);backup.put("body",c.getString(i));backup.put("reason",i==0?"device-before-resolution":"cloud-before-resolution");backup.put("created_at",java.time.Instant.now().toString());db.insertOrThrow("recovery",null,backup);}
            ContentValues v=new ContentValues();v.put("body",c.getString(choice.equals("cloud")?1:0));v.put("revision",c.getLong(2));v.put("seq",c.getLong(3)+1);v.put("dirty",choice.equals("cloud")?0:1);v.putNull("conflict");v.putNull("remote_revision");db.update("workspace",v,"user_id=?",new String[]{user});db.setTransactionSuccessful();
        }finally{db.endTransaction();}
    }
    synchronized org.json.JSONArray recoveries(String user) throws Exception {
        org.json.JSONArray rows=new org.json.JSONArray();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT id,body,reason,created_at FROM recovery WHERE user_id=? ORDER BY id DESC",new String[]{user})){
            while(c.moveToNext())rows.put(new JSONObject().put("id",c.getLong(0)).put("workspace",new JSONObject(vault.open(c.getString(1)))).put("reason",c.getString(2)).put("created_at",c.getString(3)));
        }return rows;
    }
}
