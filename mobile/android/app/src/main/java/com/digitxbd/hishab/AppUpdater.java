package com.digitxbd.hishab;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import org.json.JSONArray;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.net.URL;
import java.security.MessageDigest;
import java.util.*;

/** Direct GitHub releases only. No account tokens or ledger data leave the phone. */
final class AppUpdater {
    static final String REPO="https://api.github.com/repos/shahriarjahin/my-daily-hishab/releases/latest";
    private final MainActivity activity;
    private final java.util.concurrent.ExecutorService worker=java.util.concurrent.Executors.newSingleThreadExecutor();
    private boolean checking=false;
    private File pending;
    AppUpdater(MainActivity activity){this.activity=activity;}
    void check(boolean manual){
        synchronized(this){if(checking)return;checking=true;}
        worker.execute(()->{try{
            JSONObject release=new JSONObject(new String(read(REPO,2*1024*1024),java.nio.charset.StandardCharsets.UTF_8));
            if(release.optBoolean("draft")||release.optBoolean("prerelease"))throw new IOException("No stable release available.");
            JSONArray assets=release.getJSONArray("assets");JSONObject apk=null,checksum=null;
            for(int i=0;i<assets.length();i++){JSONObject item=assets.getJSONObject(i);String name=item.getString("name");if(name.matches("hishab-[0-9]+\\.[0-9]+\\.[0-9]+-release\\.apk"))apk=item;}
            if(apk==null)throw new IOException("The latest release has no Android APK.");
            for(int i=0;i<assets.length();i++){JSONObject item=assets.getJSONObject(i);if(item.getString("name").equals(apk.getString("name")+".sha256"))checksum=item;}
            if(checksum==null)throw new IOException("This release has no verification checksum.");
            String version=apk.getString("name").replace("hishab-","").replace("-release.apk","");
            if(compareVersions(version,activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionName)<=0){if(manual)message("You’re up to date","Hishab "+version+" is the latest release.");return;}
            final JSONObject selected=apk,hash=checksum;String notes=release.optString("body","");if(notes.length()>1800)notes=notes.substring(0,1800);
            final String details="Hishab "+version+" is available.\n\n"+notes;
            activity.runOnUiThread(()->{if(activity.isFinishing())return;new AlertDialog.Builder(activity).setTitle("Update available").setMessage(details).setNegativeButton("Later",null).setPositiveButton("Download",(d,w)->download(selected,hash)).show();});
        }catch(Exception e){if(manual)message("Update check failed",safeError(e));}finally{synchronized(this){checking=false;}}});
    }
    void maybeCheck(){android.content.SharedPreferences prefs=activity.getSharedPreferences("updates",0);if(!prefs.getBoolean("automatic",true))return;long now=System.currentTimeMillis();if(now-prefs.getLong("last_check",0)<86400000L)return;prefs.edit().putLong("last_check",now).apply();check(false);}
    boolean automatic(){return activity.getSharedPreferences("updates",0).getBoolean("automatic",true);}
    void setAutomatic(boolean enabled){activity.getSharedPreferences("updates",0).edit().putBoolean("automatic",enabled).apply();}
    private void download(JSONObject apk,JSONObject checksum){
        activity.runOnUiThread(()->android.widget.Toast.makeText(activity,"Downloading update…",android.widget.Toast.LENGTH_LONG).show());
        worker.execute(()->{File part=new File(activity.getCacheDir(),"update.part");try{
            byte[] bytes=read(apk.getString("browser_download_url"),30*1024*1024);
            if(bytes.length!=apk.getLong("size"))throw new IOException("Incomplete download. Try again.");
            String sum=new String(read(checksum.getString("browser_download_url"),2048),java.nio.charset.StandardCharsets.UTF_8).trim();
            String[] fields=sum.split("\\s+");if(fields.length!=2||!fields[0].matches("[a-fA-F0-9]{64}")||!fields[1].equals(apk.getString("name"))||!hex(MessageDigest.getInstance("SHA-256").digest(bytes)).equalsIgnoreCase(fields[0]))throw new IOException("Update checksum did not match. Installation blocked.");
            try(FileOutputStream out=new FileOutputStream(part)){out.write(bytes);}
            verify(part);
            File output=new File(activity.getCacheDir(),"hishab-update.apk");if(output.exists()&&!output.delete())throw new IOException("Could not replace previous update.");if(!part.renameTo(output))throw new IOException("Could not save update.");pending=output;
            activity.runOnUiThread(()->{if(activity.isFinishing())return;new AlertDialog.Builder(activity).setTitle("Update ready").setMessage("The APK matches this app’s signing certificate. Android will ask you to confirm installation. Your records stay in place.").setNegativeButton("Later",null).setPositiveButton("Install",(d,w)->install()).show();});
        }catch(Exception e){part.delete();message("Update download failed",safeError(e));}});
    }
    void install(){try{
        if(pending==null||!pending.exists())throw new IOException("Download the update again.");verify(pending);
        if(!activity.getPackageManager().canRequestPackageInstalls()){
            new AlertDialog.Builder(activity).setTitle("Allow app updates").setMessage("Enable ‘Allow from this source’ for Hishab, then return to continue installing this update.").setNegativeButton("Cancel",null).setPositiveButton("Open settings",(d,w)->activity.startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())),12)).show();return;
        }
        Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse("content://"+activity.getPackageName()+".updates/hishab-update.apk"),"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);activity.startActivity(intent);
    }catch(Exception e){message("Could not install update",safeError(e));}}
    @SuppressWarnings("deprecation") private void verify(File file)throws Exception{
        PackageManager pm=activity.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo own=pm.getPackageInfo(activity.getPackageName(),flags),next=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags);
        if(next==null||!own.packageName.equals(next.packageName))throw new IOException("This update belongs to another app.");
        long current=Build.VERSION.SDK_INT>=28?own.getLongVersionCode():own.versionCode,version=Build.VERSION.SDK_INT>=28?next.getLongVersionCode():next.versionCode;
        if(version<=current)throw new IOException("This update is not newer than the installed app.");
        android.content.pm.Signature[] a=Build.VERSION.SDK_INT>=28?own.signingInfo.getApkContentsSigners():own.signatures,b=Build.VERSION.SDK_INT>=28?next.signingInfo.getApkContentsSigners():next.signatures;
        Set<String> first=new HashSet<>(),second=new HashSet<>();for(android.content.pm.Signature s:a)first.add(hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray())));for(android.content.pm.Signature s:b)second.add(hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray())));
        if(first.isEmpty()||!first.equals(second))throw new IOException("Signing certificate mismatch. Installation blocked.");
    }
    static int compareVersions(String a,String b){String[] x=a.replaceFirst("^v","").split("\\."),y=b.replaceFirst("^v","").split("\\.");for(int i=0;i<Math.max(x.length,y.length);i++){int left=i<x.length?Integer.parseInt(x[i]):0,right=i<y.length?Integer.parseInt(y[i]):0;if(left!=right)return Integer.compare(left,right);}return 0;}
    private static boolean allowed(URL u){String h=u.getHost();return "https".equals(u.getProtocol())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)&&(h.equals("api.github.com")||h.equals("github.com")||h.equals("release-assets.githubusercontent.com")||h.equals("objects.githubusercontent.com"));}
    private static byte[] read(String address,int max)throws Exception{URL url=new URL(address);for(int redirects=0;redirects<6;redirects++){
        if(!allowed(url))throw new IOException("Update download address is not trusted.");
        HttpsURLConnection c=(HttpsURLConnection)url.openConnection();c.setConnectTimeout(12000);c.setReadTimeout(20000);c.setInstanceFollowRedirects(false);c.setRequestProperty("User-Agent","Hishab-Android-Updater");c.setRequestProperty("Accept","application/vnd.github+json");
        try{int code=c.getResponseCode();if(code>=300&&code<400){url=new URL(url,c.getHeaderField("Location"));continue;}if(code!=200)throw new IOException(code==403||code==429?"GitHub rate limit reached. Try later.":"GitHub update service returned HTTP "+code+".");if(c.getContentLengthLong()>max)throw new IOException("Update file is too large.");try(InputStream input=c.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){byte[] buffer=new byte[16384];int n;while((n=input.read(buffer))!=-1){if(output.size()+n>max)throw new IOException("Update file is too large.");output.write(buffer,0,n);}return output.toByteArray();}}finally{c.disconnect();}
    }throw new IOException("Too many update redirects.");}
    private static String hex(byte[] bytes){StringBuilder b=new StringBuilder();for(byte x:bytes)b.append(String.format(java.util.Locale.ROOT,"%02x",x&255));return b.toString();}
    private static String safeError(Exception e){return e instanceof IOException?e.getMessage():"Check your internet connection and try again.";}
    private void message(String title,String text){activity.runOnUiThread(()->{if(!activity.isFinishing())new AlertDialog.Builder(activity).setTitle(title).setMessage(text).setPositiveButton("OK",null).show();});}
    void close(){worker.shutdownNow();}
}
