package com.digitxbd.hishab;

import android.os.Bundle;
import android.content.Intent;
import android.app.job.*;
import android.content.ComponentName;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/** Capacitor owns the WebView; the existing private database and key aliases stay unchanged. */
public final class MainActivity extends BridgeActivity {
    AppUpdater updater;
    @Override public void onCreate(Bundle state){
        registerPlugin(HishabPlugin.class);
        super.onCreate(state);
        updater=new AppUpdater(this);
        if(android.os.Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
        getWindow().setStatusBarColor(0xff12110f);getWindow().setNavigationBarColor(0xff12110f);
        WebView.setWebContentsDebuggingEnabled(false);
        if(getBridge()!=null){getBridge().getWebView().getSettings().setAllowFileAccess(false);getBridge().getWebView().getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);}
        try{Runtime runtime=Runtime.get(this);runtime.listener=()->runOnUiThread(()->{if(getBridge()!=null)getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('device-sync'))",null);});}catch(Exception ignored){}
        ((JobScheduler)getSystemService(JOB_SCHEDULER_SERVICE)).schedule(new JobInfo.Builder(1,new ComponentName(this,SyncJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15*60*1000).build());
    }
    @Override public void onResume(){super.onResume();try{Runtime.get(this).scheduleSync();}catch(Exception ignored){}if(updater!=null)updater.maybeCheck();}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==12&&getPackageManager().canRequestPackageInstalls()&&updater!=null)updater.install();}
    void handleBack(){if(getBridge()!=null)getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('hishab-back'))",null);}
    @Override public void onBackPressed(){handleBack();}
    @Override public void onDestroy(){if(updater!=null)updater.close();try{Runtime.get(this).listener=null;}catch(Exception ignored){}super.onDestroy();}
}
