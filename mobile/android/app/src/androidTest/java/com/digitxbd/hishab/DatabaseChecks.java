package com.digitxbd.hishab;

import android.app.Instrumentation;
import static android.app.Activity.RESULT_OK;
import static android.app.Activity.RESULT_CANCELED;
import android.os.Bundle;
import android.database.Cursor;
import org.json.JSONObject;

/** Device tests use synthetic isolated accounts and never make cloud requests. */
public final class DatabaseChecks extends Instrumentation {
    int checks=0;
    void check(boolean condition,String message){if(!condition)throw new AssertionError(message);checks++;}
    @Override public void onCreate(Bundle arguments){super.onCreate(arguments);start();}
    @Override public void onStart(){Bundle report=new Bundle();Store store=null;
        try{
            store=new Store(getTargetContext());
            String a="instrumentation-account-a",b="instrumentation-account-b";
            store.getWritableDatabase().delete("workspace","user_id IN (?,?)",new String[]{a,b});
            store.getWritableDatabase().delete("recovery","user_id IN (?,?)",new String[]{a,b});
            JSONObject one=new JSONObject().put("label","PRIVATE-SYNTHETIC-LEDGER");
            JSONObject saved=store.save(a,one,0);
            check(saved.getLong("seq")==1&&saved.getBoolean("dirty"),"Device commit must be durable and pending");
            check(!store.load(b).getBoolean("exists"),"Account isolation");
            try(Cursor c=store.getReadableDatabase().rawQuery("SELECT body FROM workspace WHERE user_id=?",new String[]{a})){c.moveToFirst();check(!c.getString(0).contains("PRIVATE-SYNTHETIC-LEDGER"),"SQLite must contain ciphertext");}
            boolean stale=false;try{store.save(a,one,0);}catch(IllegalStateException expected){stale=true;}check(stale,"Stale device revision must fail");
            store.uploaded(a,1,10);
            check(!store.load(a).getBoolean("dirty")&&store.load(a).getLong("revision")==10,"Upload acknowledgment");
            store.save(a,new JSONObject().put("label","new edit"),1);
            store.uploaded(a,1,11);
            check(store.load(a).getBoolean("dirty"),"New edits must survive an older upload acknowledgment");
            store.pulled(a,new JSONObject().put("label","cloud"),12,2);
            check(store.load(a).getJSONObject("workspace").getString("label").equals("new edit"),"Cloud pull cannot replace dirty data");
            store.conflict(a,new JSONObject().put("label","cloud"),12);
            check(store.load(a).getBoolean("conflict"),"Conflict stored");
            store.resolve(a,"cloud");
            check(store.load(a).getJSONObject("workspace").getString("label").equals("cloud")&&!store.load(a).getBoolean("dirty"),"Explicit cloud choice");
            check(store.recoveries(a).length()==2&&store.recoveries(b).length()==0,"Both copies retained and account scoped");
            store.save(a,new JSONObject().put("label","device choice"),3);
            store.conflict(a,new JSONObject().put("label","cloud choice"),13);
            store.resolve(a,"device");
            check(store.load(a).getBoolean("dirty")&&store.load(a).getLong("revision")==13,"Device choice retains pending work against latest revision");
            store.close();store=new Store(getTargetContext());
            check(store.load(a).getJSONObject("workspace").getString("label").equals("device choice"),"SQLite survives close and reopen");
            Runtime.get(getTargetContext()).session(null);
            android.content.Intent launch=new android.content.Intent(getTargetContext(),MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            MainActivity activity=(MainActivity)startActivitySync(launch);
            boolean loginReady=false;
            for(int retry=0;retry<100&&!loginReady;retry++){
                java.util.concurrent.CountDownLatch latch=new java.util.concurrent.CountDownLatch(1);
                java.util.concurrent.atomic.AtomicReference<String> result=new java.util.concurrent.atomic.AtomicReference<>();
                runOnMainSync(()->activity.web.evaluateJavascript("Boolean(document.querySelector('#auth-form')&&document.querySelectorAll('[data-action=auth-mode]').length===2)",value->{result.set(value);latch.countDown();}));
                latch.await(2,java.util.concurrent.TimeUnit.SECONDS);loginReady="true".equals(result.get());
                if(!loginReady)Thread.sleep(200);
            }
            check(loginReady,"Packaged UI, native transport and sign-in controls must load");
            report.putString("stream","PASS: "+checks+" native database checks\n");finish(RESULT_OK,report);
        }catch(Throwable error){report.putString("stream","FAIL: "+error.toString()+"\n");finish(RESULT_CANCELED,report);}
        finally{if(store!=null)store.close();}
    }
}
