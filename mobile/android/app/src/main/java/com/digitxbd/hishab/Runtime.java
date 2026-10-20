package com.digitxbd.hishab;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class Runtime {
    private static Runtime instance;
    final Context context;
    final Store store;
    final ExecutorService network=Executors.newSingleThreadExecutor();
    final ExecutorService disk=Executors.newSingleThreadExecutor();
    private final SharedPreferences preferences;
    private final JSONObject config;
    volatile String syncState="offline",syncMessage="";
    volatile Runnable listener;
    final java.util.concurrent.atomic.AtomicBoolean syncQueued=new java.util.concurrent.atomic.AtomicBoolean();
    private Runtime(Context c) throws Exception {
        context=c.getApplicationContext();store=new Store(context);preferences=context.getSharedPreferences("session",0);
        try(InputStream in=context.getAssets().open("mobile-config.json")){config=new JSONObject(read(in));}
    }
    static synchronized Runtime get(Context c) throws Exception {if(instance==null)instance=new Runtime(c);return instance;}
    static String read(InputStream input) throws Exception {
        java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;
        while((n=input.read(buffer))!=-1){if(output.size()+n>12000000)throw new IllegalStateException("Response is too large.");output.write(buffer,0,n);}return output.toString("UTF-8");
    }
    JSONObject session() throws Exception {String value=preferences.getString("tokens",null);return value==null?null:new JSONObject(store.vault.open(value));}
    void session(JSONObject value) throws Exception {
        if(value==null)preferences.edit().remove("tokens").commit();
        else preferences.edit().putString("tokens",store.vault.seal(value.toString())).commit();
    }
    String user() throws Exception {JSONObject s=session();if(s==null)throw new IllegalStateException("Sign in first.");return s.getJSONObject("user").getString("id");}
    static final class HttpError extends Exception {final int status; final String code;HttpError(int s,String c,String message){super(message);status=s;code=c;}}
    JSONObject http(String base,String path,String method,JSONObject body,String token) throws Exception {
        URL url=new URL(base+path);
        if(!url.getProtocol().equals("https"))throw new IllegalArgumentException("HTTPS is required.");
        HttpURLConnection c=(HttpURLConnection)url.openConnection();c.setConnectTimeout(12000);c.setReadTimeout(45000);c.setInstanceFollowRedirects(false);c.setRequestMethod(method);
        c.setRequestProperty("Content-Type","application/json");
        if(base.equals(config.getString("supabase_url")))c.setRequestProperty("apikey",config.getString("supabase_anon_key"));
        if(token!=null)c.setRequestProperty("Authorization","Bearer "+token);
        try{
            if(body!=null){c.setDoOutput(true);try(java.io.OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes("UTF-8"));}}
            int code=c.getResponseCode();InputStream input=code>=400?c.getErrorStream():c.getInputStream();
            String text="";if(input!=null)try(InputStream in=input){text=read(in);}
            Object parsed=text.isEmpty()?JSONObject.NULL:new org.json.JSONTokener(text).nextValue();
            if(code>=300){JSONObject e=parsed instanceof JSONObject?(JSONObject)parsed:new JSONObject();String message=e.optString("detail",e.optString("msg",e.optString("message","Cloud request failed ("+code+").")));throw new HttpError(code,e.optString("code"),message);}
            return new JSONObject().put("data",parsed);
        }finally{c.disconnect();}
    }
    String token() throws Exception {
        JSONObject saved=session();if(saved==null)throw new IllegalStateException("Sign in first.");
        if(saved.optLong("expires_at")<System.currentTimeMillis()/1000+90){
            JSONObject refreshed=http(config.getString("supabase_url"),"/auth/v1/token?grant_type=refresh_token","POST",new JSONObject().put("refresh_token",saved.getString("refresh_token")),null).getJSONObject("data");
            if(!refreshed.getJSONObject("user").getString("id").equals(saved.getJSONObject("user").getString("id")))throw new IllegalStateException("Account changed. Sign in again.");
            session(refreshed);saved=refreshed;
        }return saved.getString("access_token");
    }
    JSONObject status() throws Exception {
        JSONObject s=session(),row=s==null?new JSONObject():store.load(user());
        return new JSONObject().put("configured",true).put("cloud_mode",true).put("signed_in",s!=null).put("email",s==null?JSONObject.NULL:s.getJSONObject("user").optString("email"))
            .put("setup_required",false).put("revision",row.optLong("seq")).put("has_backup",row.optBoolean("exists")).put("sync_state",row.optBoolean("conflict")?"conflict":syncState)
            .put("dirty",row.optBoolean("dirty")).put("synced_at",row.opt("synced_at")).put("message",syncMessage).put("backend_url",preferences.getString("backend_url",config.optString("backend_url","")));
    }
    JSONObject login(JSONObject body,boolean signup) throws Exception {
        JSONObject result=http(config.getString("supabase_url"),signup?"/auth/v1/signup?redirect_to="+java.net.URLEncoder.encode(preferences.getString("backend_url",config.optString("backend_url","https://mydailyhishab.vercel.app"))+"/auth/callback","UTF-8"):"/auth/v1/token?grant_type=password","POST",body,null).getJSONObject("data");
        if(!result.has("access_token"))return new JSONObject().put("signed_in",false).put("message","Check your email, then sign in.");
        session(result);syncState="pending";syncMessage="";
        try{sync();}catch(Exception e){syncMessage=e.getMessage();}
        scheduleSync();return new JSONObject().put("signed_in",true);
    }
    /** Serial cloud worker; compare-and-swap prevents another device from being overwritten. */
    synchronized void sync() throws Exception {
        if(session()==null)return;
        String account=user();JSONObject local=store.load(account);syncState="syncing";notifyChange();
        try{
            String bearer=token();
            String base=preferences.getString("backend_url",config.optString("backend_url",""));
            if(base.isEmpty())throw new IllegalStateException("Set the Hishab server URL to sync encrypted cloud records.");
            JSONObject cloud=http(base,"/api/cloud/workspace","GET",null,bearer).getJSONObject("data");
            long revision=cloud.optLong("revision",0);
            JSONObject remote=cloud.optJSONObject("data");
            if(!local.optBoolean("exists")){
                if(remote!=null)store.pulled(account,remote,revision,0);
                else {try(InputStream in=context.getAssets().open("empty-workspace.json")){store.save(account,new JSONObject(read(in)),0);}local=store.load(account);}
            }
            local=store.load(account);
            if(local.optBoolean("conflict")){syncState="conflict";return;}
            if(local.optBoolean("dirty")){
                if(revision!=local.optLong("revision")){
                    if(remote==null)throw new IllegalStateException("Cloud workspace was removed. Local records are preserved.");
                    store.conflict(account,remote,revision);syncState="conflict";return;
                }
                try{
                    Object saved=http(base,"/api/cloud/workspace","POST",new JSONObject().put("expected_revision",revision).put("data",local.getJSONObject("workspace")),bearer).getJSONObject("data").get("revision");
                    store.uploaded(account,local.getLong("seq"),((Number)saved).longValue());
                }catch(HttpError e){if(e.status==409||e.code.equals("40001")){syncState="pending";throw new IllegalStateException("Another device saved changes. Sync again to review.");}throw e;}
            }else if(remote!=null&&revision!=local.optLong("revision"))store.pulled(account,remote,revision,local.optLong("seq"));
            syncState=store.load(account).optBoolean("dirty")?"pending":"synced";syncMessage="";
        }catch(Exception e){syncState="offline";syncMessage=e instanceof HttpError&&((HttpError)e).status==401?"Sign in again to resume sync. Your device records are safe.":"Sync unavailable. Changes stay on this device.";throw e;}
        finally{notifyChange();}
    }
    JSONObject providers() throws Exception {
        if(session()==null)return new JSONObject().put("providers",new JSONArray()).put("automatic_failover",true);
        String cached=preferences.getString("providers:"+user(),null);
        return cached==null?new JSONObject().put("providers",new JSONArray()).put("automatic_failover",true):new JSONObject(store.vault.open(cached));
    }
    void cacheProviders(JSONObject value) throws Exception {preferences.edit().putString("providers:"+user(),store.vault.seal(value.toString())).commit();}
    void refreshProviders(){try{if(session()==null)return;String base=preferences.getString("backend_url",config.optString("backend_url",""));if(base.isEmpty())return;JSONObject value=http(base,"/api/ai/providers","GET",null,token()).getJSONObject("data");cacheProviders(value);notifyChange();}catch(Exception ignored){}}
    void scheduleSync(){if(!syncQueued.compareAndSet(false,true))return;network.execute(()->{try{sync();refreshProviders();}catch(Exception ignored){}finally{syncQueued.set(false);}});}
    void notifyChange(){Runnable r=listener;if(r!=null)r.run();}
    Object remote(JSONObject body) throws Exception {
        String base=preferences.getString("backend_url",config.optString("backend_url",""));
        if(base.isEmpty())throw new IllegalStateException("Add your deployed Hishab URL in Settings → Sync & device to use AI.");
        sync();JSONObject local=store.load(user());
        if(local.optBoolean("dirty")||local.optBoolean("conflict"))throw new IllegalStateException("Resolve sync before using cloud AI.");
        String path=body.getString("path"),method=body.optString("method","GET");
        if(!path.matches("/(ai/providers(?:/[a-z]+)?|ai/retry|extract|advisor|plan/preview)"))throw new IllegalArgumentException("Unsupported cloud action.");
        Object result=http(base,"/api"+path,method,body.optJSONObject("body"),token()).get("data");
        if(path.startsWith("/ai/")&&result instanceof JSONObject)cacheProviders((JSONObject)result);
        sync();return result;
    }
    Object call(String op,JSONObject body) throws Exception {
        switch(op){
            case "status":return status();
            case "providers":return providers();
            case "load":{JSONObject row=store.load(user());if(!row.optBoolean("exists"))throw new IllegalStateException("Connect once to download your workspace, then use it offline.");return row;}
            case "save":{String account=user();JSONObject workspace=body.getJSONObject("workspace");if(workspace.toString().length()>8000000)throw new IllegalArgumentException("Workspace is too large.");JSONObject saved=store.save(account,workspace,body.getLong("seq"));syncState="pending";scheduleSync();return saved;}
            case "login":return login(body,false);
            case "signup":return login(body,true);
            case "forgot-password":{String base=preferences.getString("backend_url",config.optString("backend_url","https://mydailyhishab.vercel.app"));context.startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse(base+"/?forgot=1")).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));return new JSONObject().put("opened",true);}
            case "password":http(config.getString("supabase_url"),"/auth/v1/user","PUT",body,token());return new JSONObject().put("saved",true);
            case "logout":session(null);syncState="offline";return new JSONObject().put("signed_in",false);
            case "sync":sync();return status();
            case "resolve":store.resolve(user(),body.getString("choice"));sync();return status();
            case "recoveries":return store.recoveries(user());
            case "remote":return remote(body);
            case "config":{String base=body.getString("backend_url").trim().replaceAll("/+$","");if(!base.isEmpty()){URL u=new URL(base);if(!u.getProtocol().equals("https")||u.getHost().isEmpty()||u.getUserInfo()!=null||!u.getPath().isEmpty()||u.getQuery()!=null||u.getRef()!=null)throw new IllegalArgumentException("Use an HTTPS website origin, such as https://your-app.vercel.app");}preferences.edit().putString("backend_url",base).commit();return status();}
            default:throw new IllegalArgumentException("Unknown device action.");
        }
    }
}
