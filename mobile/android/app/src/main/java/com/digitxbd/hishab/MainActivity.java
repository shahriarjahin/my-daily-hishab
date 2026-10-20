package com.digitxbd.hishab;

import android.app.Activity;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.InputStream;

/** Only APK-owned HTTPS assets can access the native bridge. External links open outside it. */
public final class MainActivity extends Activity {
    private static final String ORIGIN="https://appassets.androidplatform.net";
    WebView web;Runtime runtime;AppUpdater updater;
    ValueCallback<Uri[]> fileChooser;
    String exportContent;
    @Override public void onCreate(Bundle state){super.onCreate(state);
        try{
            runtime=Runtime.get(this);updater=new AppUpdater(this);web=new WebView(this);setContentView(web);
            if(android.os.Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
            getWindow().setStatusBarColor(0xff12110f);getWindow().setNavigationBarColor(0xff12110f);
            web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
            WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(false);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(true);
            CookieManager.getInstance().setAcceptCookie(false);
            WebView.setWebContentsDebuggingEnabled(false);
            web.addJavascriptInterface(new Bridge(),"HishabDevice");
            web.setWebChromeClient(new WebChromeClient(){
                @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                    if(fileChooser!=null)fileChooser.onReceiveValue(null);fileChooser=callback;
                    Intent select=new Intent(Intent.ACTION_OPEN_DOCUMENT);select.addCategory(Intent.CATEGORY_OPENABLE);
                    String[] types=params.getAcceptTypes();select.setType(types.length>0&&types[0].startsWith("image/")?"image/*":"*/*");
                    try{startActivityForResult(select,10);return true;}catch(Exception e){fileChooser=null;return false;}
                }
            });
            web.setWebViewClient(new WebViewClient(){
                @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                    Uri uri=request.getUrl();if(!ORIGIN.equals(uri.getScheme()+"://"+uri.getAuthority()))return empty(403);
                    String path=uri.getPath();if(path==null||path.equals("/"))path="/index.html";
                    if(path.contains("..")||path.contains("\\"))return empty(403);
                    if(path.equals("/mobile-config.json")||path.equals("/empty-workspace.json"))return empty(403);
                    try{String mime=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".html")?"text/html":path.endsWith(".png")?"image/png":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".ttf")?"font/ttf":"application/octet-stream";
                        WebResourceResponse response=new WebResourceResponse(mime,"UTF-8",getAssets().open(path.substring(1)));
                        java.util.Map<String,String> headers=new java.util.HashMap<>();headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");response.setResponseHeaders(headers);return response;
                    }catch(Exception e){return empty(404);}
                }
                @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){Uri uri=request.getUrl();if(ORIGIN.equals(uri.getScheme()+"://"+uri.getAuthority()))return false;if(uri.getScheme().equals("https"))try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}return true;}
            });
            runtime.listener=()->runOnUiThread(()->{if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('device-sync'))",null);});
            web.loadUrl(ORIGIN+"/");
            JobScheduler jobs=(JobScheduler)getSystemService(JOB_SCHEDULER_SERVICE);
            jobs.schedule(new JobInfo.Builder(1,new ComponentName(this,SyncJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15*60*1000).build());
        }catch(Exception e){android.widget.TextView error=new android.widget.TextView(this);error.setText("Hishab could not open its secure database. Reopen the app. Your records have not been deleted.");setContentView(error);}
    }
    static WebResourceResponse empty(int code){return new WebResourceResponse("text/plain","UTF-8",code,code==404?"Not found":"Blocked",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    final class Bridge {
        @JavascriptInterface public void postMessage(String id,String op,String raw){
            if(id.length()>60||raw.length()>9000000)return;
            if(op.equals("export")){runOnUiThread(()->{JSONObject response=new JSONObject();try{JSONObject body=new JSONObject(raw);if(exportContent!=null)throw new IllegalStateException("Finish the current export first.");exportContent=body.getString("content");Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);save.addCategory(Intent.CATEGORY_OPENABLE);save.setType(body.optString("mime","application/json"));save.putExtra(Intent.EXTRA_TITLE,body.optString("name","hishab-backup.json"));startActivityForResult(save,11);response.put("ok",true).put("data",new JSONObject().put("opened",true));}catch(Exception e){exportContent=null;try{response.put("ok",false).put("error","Could not open the export location.");}catch(Exception ignored){}}web.evaluateJavascript("window.AndroidTransport.resolve("+JSONObject.quote(id)+","+response+")",null);});return;}
            if(op.equals("updates")){runOnUiThread(()->{try{JSONObject body=new JSONObject(raw);if(body.has("automatic"))updater.setAutomatic(body.getBoolean("automatic"));if(body.optBoolean("check"))updater.check(true);JSONObject data=new JSONObject().put("automatic",updater.automatic()).put("version",getPackageManager().getPackageInfo(getPackageName(),0).versionName);web.evaluateJavascript("window.AndroidTransport.resolve("+JSONObject.quote(id)+",{\"ok\":true,\"data\":"+data+"})",null);}catch(Exception ignored){}});return;}
            if(op.equals("exit")){runOnUiThread(()->moveTaskToBack(true));return;}
            java.util.concurrent.ExecutorService executor=(op.equals("load")||op.equals("save")||op.equals("status")||op.equals("providers")||op.equals("config")||op.equals("recoveries"))?runtime.disk:runtime.network;
            executor.execute(()->{JSONObject envelope=new JSONObject();try{envelope.put("ok",true).put("data",runtime.call(op,new JSONObject(raw)));}catch(Exception e){try{envelope.put("ok",false).put("error",e.getMessage()==null?"Device action failed.":e.getMessage());}catch(Exception ignored){}}
                String js="window.AndroidTransport.resolve("+JSONObject.quote(id)+","+envelope.toString()+")";runOnUiThread(()->{if(web!=null)web.evaluateJavascript(js,null);});});
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
        if(request==12&&getPackageManager().canRequestPackageInstalls()&&updater!=null)updater.install();
        if(request==10&&fileChooser!=null){fileChooser.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileChooser=null;}
        if(request==11){String content=exportContent;exportContent=null;if(result==RESULT_OK&&data!=null&&content!=null){runtime.disk.execute(()->{try(java.io.OutputStream output=getContentResolver().openOutputStream(data.getData())){output.write(content.getBytes("UTF-8"));runOnUiThread(()->android.widget.Toast.makeText(this,"Export saved",android.widget.Toast.LENGTH_SHORT).show());}catch(Exception e){runOnUiThread(()->android.widget.Toast.makeText(this,"Export failed. Try again.",android.widget.Toast.LENGTH_LONG).show());}});}}
    }
    @Override protected void onResume(){super.onResume();if(runtime!=null)runtime.scheduleSync();if(updater!=null)updater.maybeCheck();}
    void handleBack(){if(web!=null)web.evaluateJavascript("if(document.querySelector('dialog[open]'))document.querySelector('dialog[open]').close();else if(location.hash&&location.hash!=='#home')goBack();else HishabDevice.postMessage('exit','exit','{}')",null);}
    @Override public void onBackPressed(){handleBack();}
    @Override protected void onDestroy(){if(updater!=null)updater.close();if(runtime!=null)runtime.listener=null;if(web!=null){web.removeJavascriptInterface("HishabDevice");web.destroy();web=null;}super.onDestroy();}
}
