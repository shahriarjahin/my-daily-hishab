package com.digitxbd.hishab;

import android.app.Instrumentation;
import static android.app.Activity.RESULT_OK;
import static android.app.Activity.RESULT_CANCELED;
import android.os.Bundle;
import android.database.Cursor;
import org.json.JSONObject;

/** Device tests use synthetic isolated accounts and never make cloud requests. */
public final class DatabaseChecks extends Instrumentation {
    int checks=0;boolean expectUpgrade=false;boolean offlineAi=false;boolean statementOnly=false;
    void check(boolean condition,String message){if(!condition)throw new AssertionError(message);checks++;}
    @Override public void onCreate(Bundle arguments){super.onCreate(arguments);expectUpgrade="true".equals(arguments.getString("upgrade"));offlineAi="true".equals(arguments.getString("offlineAi"));statementOnly="true".equals(arguments.getString("statement"));start();}
    @Override public void onStart(){Bundle report=new Bundle();Store store=null;
        try{
            if(statementOnly){int pages=StatementChecks.run(this);report.putString("stream","PASS: offline native PDF, "+pages+" pages, embedded logos, Bangla text and validation.\n");finish(RESULT_OK,report);return;}
            check(AppUpdater.compareVersions("1.1.0","1.0.2")>0,"New minor update detected");
            check(AppUpdater.compareVersions("1.10.0","1.9.9")>0,"Versions compared numerically");
            check(AppUpdater.compareVersions("v1.1.0","1.1.0")==0,"Same version is not an update");
            java.lang.reflect.Method trust=AppUpdater.class.getDeclaredMethod("allowed",java.net.URL.class);trust.setAccessible(true);
            check((Boolean)trust.invoke(null,new java.net.URL("https://github.com/shahriarjahin/my-daily-hishab/releases/download/v1.1.0/test.apk")),"GitHub download allowed");
            check(!(Boolean)trust.invoke(null,new java.net.URL("http://github.com/update.apk")),"Cleartext update blocked");
            check(!(Boolean)trust.invoke(null,new java.net.URL("https://github.com.evil.test/update.apk")),"Lookalike update domain blocked");
            check(!(Boolean)trust.invoke(null,new java.net.URL("https://user:password@github.com/update.apk")),"Credential-bearing update URL blocked");
            store=new Store(getTargetContext());
            String a="instrumentation-account-a",b="instrumentation-account-b";
            if(expectUpgrade)check(store.load(a).getJSONObject("workspace").getString("label").equals("device choice"),"Legacy encrypted workspace survives Capacitor upgrade");
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
            Runtime runtime=Runtime.get(getTargetContext());runtime.session(null);
            JSONObject offline=runtime.call("offline",new JSONObject().put("name","Offline tester")) instanceof JSONObject?(JSONObject)runtime.call("status",new JSONObject()):new JSONObject();
            check(offline.getBoolean("offline")&&offline.getBoolean("signed_in"),"Offline mode needs no cloud session");
            check(runtime.user().equals("__offline__"),"Offline account is isolated");
            check(runtime.store.load(runtime.user()).getBoolean("exists"),"Offline workspace exists without network");
            runtime.sync();check(runtime.offline(),"Offline sync remains offline");
            check(((JSONObject)runtime.call("providers",new JSONObject())).getJSONArray("providers").length()==0,"No AI providers in offline mode");
            runtime.call("logout",new JSONObject());check(!runtime.offline(),"Mode switching leaves local records preserved");
            check(runtime.store.load("__offline__").getBoolean("exists"),"Offline records survive mode switching");
            String aal1="x."+android.util.Base64.encodeToString("{\"aal\":\"aal1\"}".getBytes("UTF-8"),android.util.Base64.URL_SAFE|android.util.Base64.NO_PADDING|android.util.Base64.NO_WRAP)+".x";
            JSONObject factor=new JSONObject().put("status","verified").put("factor_type","totp");
            JSONObject mfa=new JSONObject().put("access_token",aal1).put("user",new JSONObject().put("factors",new org.json.JSONArray().put(factor)));
            check(runtime.needsMfa(mfa),"Verified MFA requires step-up");
            mfa.getJSONObject("user").put("factors",new org.json.JSONArray());check(!runtime.needsMfa(mfa),"MFA stays optional for unenrolled users");
            android.content.Intent launch=new android.content.Intent(getTargetContext(),MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            MainActivity activity=(MainActivity)startActivitySync(launch);
            boolean loginReady=false;
            for(int retry=0;retry<100&&!loginReady;retry++){
                java.util.concurrent.CountDownLatch latch=new java.util.concurrent.CountDownLatch(1);
                java.util.concurrent.atomic.AtomicReference<String> result=new java.util.concurrent.atomic.AtomicReference<>();
                runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript("Boolean(document.querySelector('.welcome-options')&&window.Capacitor&&window.Capacitor.isNativePlatform())",value->{result.set(value);latch.countDown();}));
                latch.await(2,java.util.concurrent.TimeUnit.SECONDS);loginReady="true".equals(result.get());
                if(!loginReady)Thread.sleep(200);
            }
            check(loginReady,"React UI, Capacitor transport and sign-in controls must load");
            check(activity.getBridge().getPlugin("Hishab")!=null,"Typed Capacitor plugin registered");
            if(offlineAi){
                java.io.File source=new java.io.File(getTargetContext().getExternalFilesDir(null),"offline-test-model.gguf");
                check(source.isFile(),"Synthetic test model is available");
                JSONObject cfg;try(java.io.InputStream in=getTargetContext().getAssets().open("offline-ai.json")){cfg=new JSONObject(Runtime.read(in));}
                java.security.MessageDigest hash=java.security.MessageDigest.getInstance("SHA-256");
                try(java.io.InputStream in=new java.io.FileInputStream(source)){byte[] bytes=new byte[65536];int n;while((n=in.read(bytes))!=-1)hash.update(bytes,0,n);}
                StringBuilder digest=new StringBuilder();for(byte v:hash.digest())digest.append(String.format("%02x",v&255));
                check(digest.toString().equals(cfg.getString("model_sha256")),"Test model checksum verified");
                java.io.File dir=new java.io.File(getTargetContext().getNoBackupFilesDir(),"offline-ai");dir.mkdirs();java.io.File destination=new java.io.File(dir,"finance-q6.gguf");
                java.nio.file.Files.copy(source.toPath(),destination.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                getTargetContext().getSharedPreferences("hishab-offline-ai",0).edit().putString("installed_sha",cfg.getString("model_sha256")).putBoolean("enabled",false).commit();
                OfflineAi ai=OfflineAi.get(getTargetContext());check(ai.status().getBoolean("ready")&&!ai.status().getBoolean("enabled"),"Offline model remains optional");
                ai.call(new JSONObject().put("action","enable").put("enabled",true));runtime.call("offline",new JSONObject().put("name","Offline AI tester"));
                long before=runtime.store.load(runtime.user()).getLong("seq");
                for(String text:new String[]{"Lunch 250 tk","70 tk cash paisi","চা ২০ টাকা"}){
                    long began=System.currentTimeMillis();
                    String raw=((JSONObject)ai.call(new JSONObject().put("action","generate").put("text",text))).getString("raw");
                    org.json.JSONArray output=new org.json.JSONArray(raw.trim());check(output.length()==1,"Native inference returns a transaction");
                    double expected=text.startsWith("Lunch")?250:text.startsWith("70")?70:20;
                    check(output.getJSONObject(0).getDouble("amount")==expected,"English/Banglish/Bangla amount parsed offline");
                    check(output.getJSONObject(0).getString("type").equals(text.startsWith("70")?"income":"expense"),"Native model distinguishes income and expense");
                    report.putString("stream",report.getString("stream","")+"Offline sample: "+expected+" in "+(System.currentTimeMillis()-began)+" ms\n");
                }
                check(runtime.store.load(runtime.user()).getLong("seq")==before,"Inference never saves ledger records");
                ai.call(new JSONObject().put("action","enable").put("enabled",false));check(!ai.status().getBoolean("enabled"),"Offline AI can be disabled");
                ai.call(new JSONObject().put("action","remove"));check(!ai.status().getBoolean("ready"),"Model removal clears downloaded weights");
                check(runtime.store.load(runtime.user()).getLong("seq")==before,"Model removal preserves financial records");
                runtime.call("logout",new JSONObject());
            }
            report.putString("stream",report.getString("stream","")+"PASS: "+checks+" native checks\n");finish(RESULT_OK,report);
        }catch(Throwable error){report.putString("stream","FAIL: "+error.toString()+"\n");finish(RESULT_CANCELED,report);}
        finally{if(store!=null)store.close();}
    }
}
