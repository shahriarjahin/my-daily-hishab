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
    boolean offline(){return preferences.getBoolean("offline_mode",false);}
    String user() throws Exception {if(offline())return "__offline__";JSONObject s=session();if(s==null)throw new IllegalStateException("Sign in first.");if(needsMfa(s))throw new IllegalStateException("Complete two-step verification first.");return s.getJSONObject("user").getString("id");}
    boolean needsMfa(JSONObject saved) throws Exception {
        if(saved==null)return false;boolean verified=false;JSONArray factors=saved.optJSONObject("user")==null?null:saved.getJSONObject("user").optJSONArray("factors");
        if(factors!=null)for(int i=0;i<factors.length();i++)if(factors.getJSONObject(i).optString("status").equals("verified"))verified=true;
        String aal="aal1";try{aal=new JSONObject(new String(android.util.Base64.decode(saved.getString("access_token").split("\\.")[1],android.util.Base64.URL_SAFE),"UTF-8")).optString("aal","aal1");}catch(Exception ignored){}
        return verified&&!aal.equals("aal2");
    }
    void applyWelcomeName() throws Exception {
        String label=preferences.getString("welcome_name","");if(label.isEmpty())return;
        JSONObject row=store.load(user());if(!row.optBoolean("exists"))return;
        JSONObject workspace=row.getJSONObject("workspace");if(workspace.getJSONObject("settings").optString("name").isEmpty()){workspace.getJSONObject("settings").put("name",label);store.save(user(),workspace,row.getLong("seq"));scheduleSync();}
        preferences.edit().remove("welcome_name").commit();
    }
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
        if(offline())return new JSONObject().put("configured",true).put("cloud_mode",false).put("offline",true).put("signed_in",true).put("sync_state","offline").put("email",JSONObject.NULL);
        JSONObject s=session();
        if(needsMfa(s))return new JSONObject().put("configured",true).put("signed_in",true).put("mfa_required",true).put("factors",s.getJSONObject("user").optJSONArray("factors")).put("email",s.getJSONObject("user").optString("email"));
        JSONObject row=s==null?new JSONObject():store.load(user());
        return new JSONObject().put("configured",true).put("cloud_mode",true).put("signed_in",s!=null).put("email",s==null?JSONObject.NULL:s.getJSONObject("user").optString("email"))
            .put("name",preferences.getString("welcome_name",s==null?"":s.getJSONObject("user").optJSONObject("user_metadata")==null?"":s.getJSONObject("user").getJSONObject("user_metadata").optString("name"))).put("setup_required",false).put("revision",row.optLong("seq")).put("has_backup",row.optBoolean("exists")).put("sync_state",row.optBoolean("conflict")?"conflict":syncState)
            .put("dirty",row.optBoolean("dirty")).put("synced_at",row.opt("synced_at")).put("message",syncMessage).put("backend_url",preferences.getString("backend_url",config.optString("backend_url","")));
    }
    JSONObject login(JSONObject body,boolean signup) throws Exception {
        preferences.edit().putBoolean("offline_mode",false).commit();
        String display=body.optString("name",preferences.getString("welcome_name",""));
        if(!display.isEmpty())preferences.edit().putString("welcome_name",display).commit();
        JSONObject credentials=new JSONObject().put("email",body.getString("email")).put("password",body.getString("password"));if(signup)credentials.put("data",new JSONObject().put("name",display).put("hishab_name",display));
        JSONObject result=http(config.getString("supabase_url"),signup?"/auth/v1/signup?redirect_to="+java.net.URLEncoder.encode(preferences.getString("backend_url",config.optString("backend_url","https://mydailyhishab.vercel.app"))+"/auth/callback","UTF-8"):"/auth/v1/token?grant_type=password","POST",credentials,null).getJSONObject("data");
        if(!result.has("access_token"))return new JSONObject().put("signed_in",false).put("message","Check your email, then sign in.");
        session(result);syncState="pending";syncMessage="";
        try{if(!needsMfa(result)){sync();applyWelcomeName();}}catch(Exception e){syncMessage=e.getMessage();}
        scheduleSync();return new JSONObject().put("signed_in",true);
    }
    /** Serial cloud worker; compare-and-swap prevents another device from being overwritten. */
    synchronized void sync() throws Exception {
        if(offline()||session()==null)return;
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
        if(offline()||session()==null)return new JSONObject().put("providers",new JSONArray()).put("automatic_failover",true);
        String cached=preferences.getString("providers:"+user(),null);
        return cached==null?new JSONObject().put("providers",new JSONArray()).put("automatic_failover",true):new JSONObject(store.vault.open(cached));
    }
    void cacheProviders(JSONObject value) throws Exception {preferences.edit().putString("providers:"+user(),store.vault.seal(value.toString())).commit();}
    void refreshProviders(){try{if(offline()||session()==null)return;String base=preferences.getString("backend_url",config.optString("backend_url",""));if(base.isEmpty())return;JSONObject value=http(base,"/api/ai/providers","GET",null,token()).getJSONObject("data");cacheProviders(value);notifyChange();}catch(Exception ignored){}}
    void scheduleSync(){if(!syncQueued.compareAndSet(false,true))return;network.execute(()->{try{sync();refreshProviders();}catch(Exception ignored){}finally{syncQueued.set(false);}});}
    void notifyChange(){Runnable r=listener;if(r!=null)r.run();}
    Object remote(JSONObject body) throws Exception {
        if(offline())throw new IllegalStateException("AI needs a cloud account. Your offline records stay on this device.");
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
    JSONObject passkeyOptions(boolean registration) throws Exception {
        if(offline())throw new IllegalStateException("Passkeys need cloud mode.");
        if(registration&&needsMfa(session()))throw new IllegalStateException("Complete two-step verification first.");
        return http(config.getString("supabase_url"),"/auth/v1/passkeys/"+(registration?"registration":"authentication")+"/options","POST",new JSONObject(),registration?token():null).getJSONObject("data");
    }
    JSONObject passkeyFinish(boolean registration,String challenge,String credential) throws Exception {
        JSONObject result=http(config.getString("supabase_url"),"/auth/v1/passkeys/"+(registration?"registration":"authentication")+"/verify","POST",new JSONObject().put("challenge_id",challenge).put("credential",new JSONObject(credential)),registration?token():null).getJSONObject("data");
        if(!registration){session(result);preferences.edit().putBoolean("offline_mode",false).commit();if(!needsMfa(result)){sync();applyWelcomeName();scheduleSync();}}
        return new JSONObject().put(registration?"registered":"signed_in",true);
    }
    Object security(JSONObject request) throws Exception {
        if(offline())throw new IllegalStateException("Account security is available in cloud mode.");
        String path=request.getString("path"),method=request.optString("method","GET"),bearer=token();JSONObject body=request.optJSONObject("body");String base=config.getString("supabase_url");
        if(needsMfa(session())&&!path.equals("/auth/mfa/verify")&&!path.equals("/auth/security"))throw new IllegalStateException("Complete two-step verification first.");
        if(path.equals("/auth/security")&&method.equals("GET")){JSONObject profile=http(base,"/auth/v1/user","GET",null,bearer).getJSONObject("data");return new JSONObject().put("factors",profile.optJSONArray("factors")==null?new JSONArray():profile.getJSONArray("factors"));}
        if(path.equals("/auth/mfa/enroll")&&method.equals("POST"))return http(base,"/auth/v1/factors","POST",new JSONObject().put("factor_type","totp").put("friendly_name","Hishab authenticator").put("issuer","Hishab"),bearer).get("data");
        if(path.equals("/auth/mfa/verify")&&method.equals("POST")){String id=java.util.UUID.fromString(body.getString("factor_id")).toString();String factor="/auth/v1/factors/"+id;JSONObject challenge=http(base,factor+"/challenge","POST",new JSONObject(),bearer).getJSONObject("data");JSONObject result=http(base,factor+"/verify","POST",new JSONObject().put("challenge_id",challenge.getString("id")).put("code",body.getString("code")),bearer).getJSONObject("data");session(result);sync();applyWelcomeName();scheduleSync();return new JSONObject().put("verified",true);}
        if(path.matches("/auth/mfa/[0-9a-fA-F-]{36}")&&method.equals("DELETE")){http(base,"/auth/v1/factors/"+java.util.UUID.fromString(path.substring(path.lastIndexOf('/')+1)),"DELETE",null,bearer);JSONObject profile=http(base,"/auth/v1/user","GET",null,bearer).getJSONObject("data");JSONObject saved=session();saved.put("user",profile);session(saved);return new JSONObject().put("removed",true);}
        if((path.equals("/auth/passkeys")&&method.equals("GET"))||(path.matches("/auth/passkeys/[0-9a-fA-F-]{36}")&&method.equals("DELETE")))return http(base,path.replace("/auth/passkeys","/auth/v1/passkeys"),method,null,bearer).get("data");
        throw new IllegalArgumentException("Unsupported account security action.");
    }
    Object call(String op,JSONObject body) throws Exception {
        switch(op){
            case "welcome-name":{String label=body.getString("name").trim();if(label.isEmpty()||label.length()>60)throw new IllegalArgumentException("Check your name.");preferences.edit().putString("welcome_name",label).commit();return new JSONObject().put("saved",true);}
            case "security":return security(body);
            case "offline":{
                preferences.edit().putBoolean("offline_mode",true).commit();
                JSONObject current=store.load(user());
                if(!current.optBoolean("exists")){try(InputStream in=context.getAssets().open("empty-workspace.json")){JSONObject workspace=new JSONObject(read(in));workspace.getJSONObject("settings").put("name",body.optString("name","")).put("ai_enabled",false);store.save(user(),workspace,0);}}
                syncState="offline";return status();}
            case "status":return status();
            case "providers":return providers();
            case "load":{JSONObject row=store.load(user());if(!row.optBoolean("exists"))throw new IllegalStateException("Connect once to download your workspace, then use it offline.");return row;}
            case "save":{String account=user();JSONObject workspace=body.getJSONObject("workspace");if(workspace.toString().length()>8000000)throw new IllegalArgumentException("Workspace is too large.");JSONObject saved=store.save(account,workspace,body.getLong("seq"));syncState=offline()?"offline":"pending";if(!offline())scheduleSync();return saved;}
            case "login":return login(body,false);
            case "signup":return login(body,true);
            case "forgot-password":{String base=preferences.getString("backend_url",config.optString("backend_url","https://mydailyhishab.vercel.app"));context.startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse(base+"/?forgot=1")).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));return new JSONObject().put("opened",true);}
            case "password":http(config.getString("supabase_url"),"/auth/v1/user","PUT",body,token());return new JSONObject().put("saved",true);
            case "logout":if(offline()){preferences.edit().putBoolean("offline_mode",false).commit();return new JSONObject().put("signed_in",false);}session(null);syncState="offline";return new JSONObject().put("signed_in",false);
            case "sync":sync();return status();
            case "resolve":store.resolve(user(),body.getString("choice"));sync();return status();
            case "recoveries":return store.recoveries(user());
            case "remote":return remote(body);
            case "config":{String base=body.getString("backend_url").trim().replaceAll("/+$","");if(!base.isEmpty()){URL u=new URL(base);if(!u.getProtocol().equals("https")||u.getHost().isEmpty()||u.getUserInfo()!=null||!u.getPath().isEmpty()||u.getQuery()!=null||u.getRef()!=null)throw new IllegalArgumentException("Use an HTTPS website origin, such as https://your-app.vercel.app");}preferences.edit().putString("backend_url",base).commit();return status();}
            default:throw new IllegalArgumentException("Unknown device action.");
        }
    }
}
