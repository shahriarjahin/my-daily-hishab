package com.digitxbd.hishab;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONObject;

/** Typed Capacitor transport. Token encryption, workspace schema and CAS are unchanged. */
@CapacitorPlugin(name="Hishab")
public final class HishabPlugin extends Plugin {
    @PluginMethod public void execute(PluginCall call){
        String op=call.getString("op","");JSONObject body=call.getObject("body",new JSObject());
        if(body.toString().length()>9000000){call.reject("Request is too large.");return;}
        if(op.equals("passkey")){Passkeys.begin(this,call,body.optBoolean("registration"));return;}
        if(op.equals("exit")){getActivity().runOnUiThread(()->{getActivity().moveTaskToBack(true);call.resolve(new JSObject().put("data",true));});return;}
        if(op.equals("updates")){getActivity().runOnUiThread(()->{try{MainActivity activity=(MainActivity)getActivity();if(body.has("automatic"))activity.updater.setAutomatic(body.getBoolean("automatic"));if(body.optBoolean("check"))activity.updater.check(true);call.resolve(new JSObject().put("data",new JSONObject().put("automatic",activity.updater.automatic()).put("version",getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0).versionName)));}catch(Exception e){call.reject("Could not check app updates.");}});return;}
        if(op.equals("export")){Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(body.optString("mime","application/json"));intent.putExtra(Intent.EXTRA_TITLE,body.optString("name","hishab-backup.json"));getActivity().runOnUiThread(()->{try{startActivityForResult(call,intent,"saveExport");}catch(Exception e){call.reject("No document picker is available.");}});return;}
        try{Runtime runtime=Runtime.get(getContext());java.util.concurrent.ExecutorService executor=(op.equals("load")||op.equals("save")||op.equals("status")||op.equals("providers")||op.equals("config")||op.equals("recoveries"))?runtime.disk:runtime.network;
            executor.execute(()->{try{Object data=runtime.call(op,body);call.resolve(new JSObject().put("data",data==null?JSONObject.NULL:data));}catch(Exception e){call.reject(e.getMessage()==null?"Device request failed.":e.getMessage());}});
        }catch(Exception e){call.reject("Could not open the encrypted database.");}
    }
    @ActivityCallback private void saveExport(PluginCall call,ActivityResult result){if(call==null)return;if(result.getResultCode()!=android.app.Activity.RESULT_OK||result.getData()==null){call.reject("Export cancelled.");return;}try{JSONObject body=call.getObject("body",new JSObject());try(java.io.OutputStream out=getContext().getContentResolver().openOutputStream(result.getData().getData())){out.write(body.getString("content").getBytes(java.nio.charset.StandardCharsets.UTF_8));}call.resolve(new JSObject().put("data",new JSONObject().put("saved",true)));}catch(Exception e){call.reject("Could not save the exported file.");}}
}
