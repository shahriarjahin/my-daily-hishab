package com.digitxbd.hishab;

import android.os.Bundle;
import android.content.Intent;
import android.app.job.*;
import android.content.ComponentName;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

/** Capacitor owns the WebView; the existing private database and key aliases stay unchanged. */
public final class MainActivity extends BridgeActivity {
    private static final Object LAUNCH_LOCK=new Object();
    private static JSONObject pendingLaunch;
    AppUpdater updater;
    static JSONObject consumePendingLaunch(){synchronized(LAUNCH_LOCK){JSONObject out=pendingLaunch;pendingLaunch=null;return out;}}
    private void captureIntent(Intent intent){
        if(intent==null)return;
        JSONObject next=null;
        try{
            String action=intent.getAction();
            if(Intent.ACTION_SEND.equals(action)&&"text/plain".equals(intent.getType())){
                String shared=intent.getStringExtra(Intent.EXTRA_TEXT);
                if(shared!=null){
                    shared=shared.trim();
                    if(!shared.isEmpty()){
                        if(shared.length()>2000)shared=shared.substring(0,2000);
                        next=new JSONObject().put("action","share").put("text",shared);
                    }
                }
            }else{
                String hishabAction=intent.getStringExtra("hishab_action");
                if("add".equals(hishabAction)||"sms".equals(hishabAction)||"transfer".equals(hishabAction)){
                    next=new JSONObject().put("action",hishabAction);
                    intent.removeExtra("hishab_action");
                }
            }
        }catch(Exception ignored){}
        if(next==null)return;
        synchronized(LAUNCH_LOCK){pendingLaunch=next;}
        if(getBridge()!=null&&getBridge().getWebView()!=null){
            runOnUiThread(()->{if(getBridge()!=null&&getBridge().getWebView()!=null)getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('hishab-launch'))",null);});
        }
    }
    @Override public void onCreate(Bundle state){
        registerPlugin(HishabPlugin.class);
        super.onCreate(state);
        captureIntent(getIntent());
        updater=new AppUpdater(this);
        if(android.os.Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
        getWindow().setStatusBarColor(0xff12110f);getWindow().setNavigationBarColor(0xff12110f);
        WebView.setWebContentsDebuggingEnabled(false);
        if(getBridge()!=null){getBridge().getWebView().getSettings().setAllowFileAccess(false);getBridge().getWebView().getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);}
        try{Runtime runtime=Runtime.get(this);runtime.listener=()->runOnUiThread(()->{if(getBridge()!=null)getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('device-sync'))",null);});}catch(Exception ignored){}
        ((JobScheduler)getSystemService(JOB_SCHEDULER_SERVICE)).schedule(new JobInfo.Builder(1,new ComponentName(this,SyncJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15*60*1000).build());
    }
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);captureIntent(intent);}
    @Override public void onResume(){super.onResume();try{Runtime.get(this).scheduleSync();}catch(Exception ignored){}try{Runtime runtime=Runtime.get(this);if(updater!=null&&!runtime.offline()&&runtime.session()!=null)updater.maybeCheck();}catch(Exception ignored){}}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==12&&getPackageManager().canRequestPackageInstalls()&&updater!=null)updater.install();}
    void handleBack(){if(getBridge()!=null)getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('hishab-back'))",null);}
    @Override public void onBackPressed(){handleBack();}
    @Override public void onDestroy(){if(updater!=null)updater.close();try{Runtime.get(this).listener=null;}catch(Exception ignored){}super.onDestroy();}
}
