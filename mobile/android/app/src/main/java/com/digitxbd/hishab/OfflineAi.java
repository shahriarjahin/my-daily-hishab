package com.digitxbd.hishab;

import android.app.ActivityManager;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Optional CPU inference. Only the pinned model download uses the network. */
final class OfflineAi {
    static { System.loadLibrary("hishab_ai"); }
    private static OfflineAi instance;
    static synchronized OfflineAi get(Context c) throws Exception {if(instance==null)instance=new OfflineAi(c.getApplicationContext());return instance;}
    final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Context context;
    private final JSONObject config;
    private final File model,partial;
    private final SharedPreferences prefs;
    private final AtomicBoolean busy=new AtomicBoolean(),cancelled=new AtomicBoolean();
    private volatile long received;
    private volatile String failure="";
    private final boolean supported;
    static native byte[] generate(byte[] path,byte[] prompt);
    static native void release();
    private static final String SYSTEM="You are Hishab, a Bangladeshi personal-finance assistant. The user writes in English, Bangla or Banglish (Bangla in Latin letters), often mixed. Extract every financial transaction they mention as a JSON array of objects with keys description, amount, category, type. Amounts are BDT numbers (expand shorthand like 1.5k or 2 lakh). category is one of: food, grocery, rent, utilities, mobile_recharge, transport, tuition, salary, gift, loan, shopping, medical, entertainment, other. type is income or expense. If there is no transaction, the array is empty. Reply with the JSON array only.";
    private OfflineAi(Context c) throws Exception {
        context=c;prefs=c.getSharedPreferences("hishab-offline-ai",Context.MODE_PRIVATE);
        try(InputStream in=c.getAssets().open("offline-ai.json")){config=new JSONObject(Runtime.read(in));}
        File dir=new File(c.getNoBackupFilesDir(),"offline-ai");if(!dir.exists()&&!dir.mkdirs())throw new IOException("Could not prepare offline AI storage.");
        model=new File(dir,"finance-q6.gguf");partial=new File(dir,"finance-q6.part");
        ActivityManager.MemoryInfo memory=new ActivityManager.MemoryInfo();((ActivityManager)c.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(memory);
        supported=android.os.Process.is64Bit()&&memory.totalMem>=3L*1024*1024*1024;
    }
    private boolean ready(){return model.isFile()&&model.length()==config.optLong("model_bytes")&&prefs.getString("installed_sha","").equals(config.optString("model_sha256"));}
    JSONObject status() throws Exception {return new JSONObject().put("name",config.getString("name")).put("supported",supported).put("ready",ready()).put("enabled",ready()&&prefs.getBoolean("enabled",false)).put("busy",busy.get()).put("downloaded_bytes",received).put("model_bytes",config.getLong("model_bytes")).put("error",failure).put("source",config.getString("source")).put("license",config.getString("license"));}
    void cancel(){cancelled.set(true);}
    Object call(JSONObject b) throws Exception {
        String action=b.optString("action","status");
        if(action.equals("status"))return status();
        if(!busy.compareAndSet(false,true))throw new IllegalStateException("Offline AI is busy.");
        try {
            failure="";
            switch(action){
                case "download": download();return status();
                case "enable": if(b.getBoolean("enabled")&&!ready())throw new IllegalStateException("Download the offline model first.");prefs.edit().putBoolean("enabled",b.getBoolean("enabled")).commit();if(!b.getBoolean("enabled"))release();return status();
                case "remove":release();Files.deleteIfExists(model.toPath());Files.deleteIfExists(partial.toPath());prefs.edit().clear().commit();received=0;return status();
                case "generate":{
                    Runtime.get(context).user();
                    if(!ready()||!prefs.getBoolean("enabled",false))throw new IllegalStateException("Enable offline AI in Settings first.");
                    String text=b.getString("text");if(text.isBlank()||text.length()>1000||text.contains("<|"))throw new IllegalArgumentException("Use a short plain-text entry, up to 1000 characters.");
                    String prompt="<|im_start|>system\n"+SYSTEM+"<|im_end|>\n<|im_start|>user\n"+text+"<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n";
                    return new JSONObject().put("raw",new String(generate(model.getAbsolutePath().getBytes(StandardCharsets.UTF_8),prompt.getBytes(StandardCharsets.UTF_8)),StandardCharsets.UTF_8));
                }
                default:throw new IllegalArgumentException("Unknown offline AI action.");
            }
        }catch(Exception e){failure=e.getMessage()==null?"Offline AI failed.":e.getMessage();throw e;}
        finally{busy.set(false);}
    }
    private static boolean trusted(URL url){String h=url.getHost().toLowerCase(java.util.Locale.ROOT);return url.getProtocol().equals("https")&&url.getUserInfo()==null&&(h.equals("huggingface.co")||h.endsWith(".huggingface.co")||h.endsWith(".hf.co"));}
    private void download() throws Exception {
        if(ready())return;
        if(!supported)throw new IllegalStateException("Offline AI requires a 64-bit phone with at least 3 GB RAM.");
        long size=config.getLong("model_bytes");if(model.getParentFile().getUsableSpace()<size+250L*1024*1024)throw new IOException("Free at least 900 MB of storage first.");
        cancelled.set(false);received=0;URL url=new URL(config.getString("model_url"));HttpURLConnection connection=null;
        try {
            for(int redirects=0;redirects<8;redirects++){
                if(!trusted(url))throw new IOException("Untrusted model download host.");
                connection=(HttpURLConnection)url.openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(20000);connection.setRequestProperty("Accept-Encoding","identity");
                int code=connection.getResponseCode();
                if(code>=300&&code<400){String location=connection.getHeaderField("Location");connection.disconnect();url=new URL(url,location);connection=null;continue;}
                if(code!=200)throw new IOException("Model download is unavailable. Try again later.");break;
            }
            if(connection==null||connection.getResponseCode()!=200)throw new IOException("Too many model download redirects.");
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            try(InputStream in=connection.getInputStream();OutputStream out=new FileOutputStream(partial)){
                byte[] buffer=new byte[65536];int n;
                while((n=in.read(buffer))!=-1){if(cancelled.get())throw new IOException("Model download cancelled.");received+=n;if(received>size)throw new IOException("Unexpected model size.");digest.update(buffer,0,n);out.write(buffer,0,n);}
            }
            StringBuilder hash=new StringBuilder();for(byte v:digest.digest())hash.append(String.format("%02x",v&255));
            if(received!=size||!hash.toString().equals(config.getString("model_sha256")))throw new IOException("Model integrity check failed. Please download again.");
            release();Files.move(partial.toPath(),model.toPath(),StandardCopyOption.REPLACE_EXISTING);
            prefs.edit().putString("installed_sha",hash.toString()).putBoolean("enabled",false).commit();
        }finally{if(connection!=null)connection.disconnect();Files.deleteIfExists(partial.toPath());}
    }
}
