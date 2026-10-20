package com.digitxbd.hishab;
import androidx.credentials.*;
import androidx.credentials.exceptions.*;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import org.json.JSONObject;
/** Native passkey UI; the OS owns biometrics and private keys. */
final class Passkeys {
 static void begin(HishabPlugin plugin,PluginCall call,boolean registration){
  try{Runtime runtime=Runtime.get(plugin.getContext());runtime.network.execute(()->{
   try{JSONObject options=runtime.passkeyOptions(registration);String challenge=options.getString("challenge_id"),json=options.getJSONObject("options").toString();
    plugin.getActivity().runOnUiThread(()->{try{CredentialManager manager=CredentialManager.create(plugin.getContext());
     if(registration){manager.createCredentialAsync(plugin.getActivity(),new CreatePublicKeyCredentialRequest(json,null,false),null,ContextCompat.getMainExecutor(plugin.getContext()),new CredentialManagerCallback<CreateCredentialResponse,CreateCredentialException>(){
      public void onResult(CreateCredentialResponse response){if(response instanceof CreatePublicKeyCredentialResponse)finish(runtime,call,true,challenge,((CreatePublicKeyCredentialResponse)response).getRegistrationResponseJson());else call.reject("Passkey creation was unavailable.");}
      public void onError(CreateCredentialException error){call.reject("Passkey request cancelled or unavailable.");}
     });}else{GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(new GetPublicKeyCredentialOption(json)).build();manager.getCredentialAsync(plugin.getActivity(),request,null,ContextCompat.getMainExecutor(plugin.getContext()),new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
      public void onResult(GetCredentialResponse response){if(response.getCredential() instanceof PublicKeyCredential)finish(runtime,call,false,challenge,((PublicKeyCredential)response.getCredential()).getAuthenticationResponseJson());else call.reject("No passkey was returned.");}
      public void onError(GetCredentialException error){call.reject("Passkey request cancelled or unavailable.");}
     });}
    }catch(Exception error){call.reject("Passkeys are unavailable on this device.");}});
   }catch(Exception error){call.reject(error.getMessage());}
  });}catch(Exception error){call.reject("Could not start passkey sign-in.");}
 }
 private static void finish(Runtime runtime,PluginCall call,boolean registration,String challenge,String credential){runtime.network.execute(()->{try{JSONObject result=runtime.passkeyFinish(registration,challenge,credential);call.resolve(new JSObject().put("data",result));}catch(Exception error){call.reject(error.getMessage());}});}
}
